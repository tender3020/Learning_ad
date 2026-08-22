import {
  type LearningType,
  parseTypeFromAIResponse,
  getOutlineTokensPerDay,
} from "@shared/typeEngine";
import { allocatePhases, type AllocatedPhase } from "@shared/outlinePhases";
import { validateOutline } from "@shared/outlineValidation";
import type { OutlineItem } from "@shared/outlineTypes";
import { chatCompletion } from "../lib/deepseek";
import { assemblePrompt, logAIGeneration } from "./promptService";

export type { OutlineItem } from "@shared/outlineTypes";

export type AssessmentQuestion = {
  questionIndex: number;
  question: string;
  optionsA: string;
  optionsB: string;
  optionsC: string;
  optionsD: string;
  correctAnswer: string;
  explanation: string;
  difficulty: "basic" | "intermediate" | "advanced" | "expert";
};

export async function detectLearningType(
  goal: string,
  userId?: number,
): Promise<{ type: LearningType; reason: string }> {
  const startedAt = Date.now();
  const assembled = await assemblePrompt(null, "detect", { goal });
  if (!assembled) {
    throw new Error("类型判定 Prompt 未配置：请在 prompt_templates 中配置 purpose=detect 的模板");
  }

  const response = await chatCompletion({
    messages: [
      { role: "system", content: assembled.system },
      { role: "user", content: assembled.user || `学习目标：${goal}\n只输出一行：编号|英文名|理由` },
    ],
    temperature: assembled.temperature,
    max_tokens: assembled.maxTokens,
  });

  if (!response.ok) {
    void logAIGeneration({
      userId, taskType: "detect", status: "failed",
      templateId: assembled?.templateId, templateVersion: assembled?.version,
      inputVars: { goal }, errorMessage: `HTTP ${response.status}`, durationMs: Date.now() - startedAt,
    });
    return { type: "abstract_logic", reason: "默认类型" };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";
  const type = parseTypeFromAIResponse(content);
  const parts = content.split("|");
  const reason =
    parts.length >= 3
      ? parts[2].trim()
      : parts.length >= 2
        ? parts[1].trim()
        : "基于关键词匹配";

  void logAIGeneration({
    userId, taskType: "detect", typeKey: type, status: "success",
    templateId: assembled?.templateId, templateVersion: assembled?.version,
    inputVars: { goal }, outputRaw: content, durationMs: Date.now() - startedAt,
  });

  return { type, reason };
}

export async function generateOutline(
  goal: string,
  totalDays: number,
  learningType: LearningType = "abstract_logic",
  skillLevel: string = "l1",
  userId?: number,
  planId?: number,
): Promise<OutlineItem[]> {
  const phases = allocatePhases(learningType, totalDays);
  let outline = await generateFullOutlineOnce(goal, learningType, skillLevel, totalDays, phases, userId, planId);

  if (outline.length < Math.ceil(totalDays * 0.6)) {
    const repaired = await repairMissingOutlineDays(
      goal,
      learningType,
      skillLevel,
      phases,
      outline,
      totalDays,
    );
    if (repaired.length > outline.length) outline = repaired;
  }

  outline = fillMissingOutlineDays(outline, phases, totalDays);

  if (outline.length === 0) {
    throw new Error("大纲生成失败：AI 未返回有效数据，请重试");
  }

  const validation = validateOutline(outline, totalDays);
  if (!validation.valid) {
    console.warn("[generateOutline] 校验告警:", validation.errors.join("; "));
  }

  return outline.slice(0, totalDays);
}

async function generateFullOutlineOnce(
  goal: string,
  learningType: LearningType,
  skillLevel: string,
  totalDays: number,
  phases: AllocatedPhase[],
  userId?: number,
  planId?: number,
): Promise<OutlineItem[]> {
  const startedAt = Date.now();
  const assembled = await assemblePrompt(learningType, "outline", { goal, totalDays, skillLevel });
  if (!assembled) {
    throw new Error(`大纲 Prompt 未配置：请在 prompt_templates 中配置 outline:${learningType} 模板`);
  }

  let response: Response;
  try {
    response = await chatCompletion(
      {
        messages: [
          {
            role: "system",
            content: assembled.system,
          },
          {
            role: "user",
            content:
              assembled.user ||
              `为「${goal}」生成 ${totalDays} 天紧凑大纲。

请先通读 system 中的「分阶段大纲规划」，按每个阶段综合评估并分配该阶段内每天的主题，再一次输出全部 ${totalDays} 天 JSON。
第 d 天的 title/obj 必须属于 d 所在阶段；阶段内递进、阶段间衔接。第 N 天承接第 N-1 天。`,
          },
        ],
        temperature: assembled.temperature,
        max_tokens: Math.min(assembled.maxTokens, 400 + totalDays * getOutlineTokensPerDay(learningType)),
        response_format: { type: "json_object" },
      },
      { signal: abortAfter(120_000) },
    );
  } catch {
    void logAIGeneration({
      userId, planId, taskType: "outline", typeKey: learningType, status: "failed",
      templateId: assembled?.templateId, templateVersion: assembled?.version,
      inputVars: { goal, totalDays, skillLevel }, errorMessage: "请求异常/超时", durationMs: Date.now() - startedAt,
    });
    return [];
  }

  if (!response.ok) {
    void logAIGeneration({
      userId, planId, taskType: "outline", typeKey: learningType, status: "failed",
      templateId: assembled?.templateId, templateVersion: assembled?.version,
      inputVars: { goal, totalDays, skillLevel }, errorMessage: `HTTP ${response.status}`, durationMs: Date.now() - startedAt,
    });
    return [];
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseOutlineJson(rawContent);
  const result = parsed
    .filter((item) => item.dayNumber >= 1 && item.dayNumber <= totalDays)
    .map((item) => {
      const phase = phases.find((p) => item.dayNumber >= p.startDay && item.dayNumber <= p.endDay);
      return phase ? normalizeOutlineItem(item, phase) : item;
    });

  void logAIGeneration({
    userId, planId, taskType: "outline", typeKey: learningType,
    status: result.length > 0 ? "success" : "failed",
    templateId: assembled?.templateId, templateVersion: assembled?.version,
    inputVars: { goal, totalDays, skillLevel },
    outputRaw: rawContent.slice(0, 8000),
    outputParsed: { days: result.length },
    parseSuccess: parsed.length > 0,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

function abortAfter(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

function fillMissingOutlineDays(
  outline: OutlineItem[],
  phases: AllocatedPhase[],
  totalDays: number,
): OutlineItem[] {
  return mergePhaseOutlines(phases, [outline], totalDays);
}

async function repairMissingOutlineDays(
  goal: string,
  learningType: LearningType,
  skillLevel: string,
  phases: AllocatedPhase[],
  existing: OutlineItem[],
  totalDays: number,
): Promise<OutlineItem[]> {
  const have = new Set(existing.map((item) => item.dayNumber));
  const missing: number[] = [];
  for (let day = 1; day <= totalDays; day++) {
    if (!have.has(day)) missing.push(day);
  }
  if (missing.length === 0) return existing;

  const missingByPhase = missing.map((day) => {
    const phase = phases.find((p) => day >= p.startDay && day <= p.endDay);
    return phase ? `第${day}天→阶段「${phase.name}」（${phase.outlineTitleGuide}；禁止：${phase.outlineAvoid}）` : `第${day}天`;
  });

  const known = existing
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(0, 12)
    .map((item) => `D${item.dayNumber}:${item.title}`)
    .join("；");

  let response: Response;
  try {
    response = await chatCompletion(
      {
        messages: [
          {
            role: "system",
            content: `为「${goal}」（${learningType}，水平 ${skillLevel}）补全缺失学习天。只返回 JSON：{"o":[{"d":1,"t":"主题","obj":"目标","k":"关键词"}]}
必须衔接已有主题，禁止重复。缺失天须符合其所属阶段约束：
${missingByPhase.join("\n")}`,
          },
          {
            role: "user",
            content: `已有：${known || "无"}\n请只生成这些天：${missing.join(",")} `,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.min(2048, 200 + missing.length * getOutlineTokensPerDay(learningType)),
        response_format: { type: "json_object" },
      },
      { signal: abortAfter(60_000) },
    );
  } catch {
    return existing;
  }

  if (!response.ok) return existing;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const extra = parseOutlineJson(data.choices?.[0]?.message?.content || "").map((item) => {
    const phase = phases.find((p) => item.dayNumber >= p.startDay && item.dayNumber <= p.endDay);
    return phase ? normalizeOutlineItem(item, phase) : item;
  });
  return [...existing, ...extra];
}

function mergePhaseOutlines(
  phases: AllocatedPhase[],
  phaseResults: OutlineItem[][],
  totalDays: number,
): OutlineItem[] {
  const flat = phaseResults.flat();
  const byDay = new Map<number, OutlineItem>();
  for (const item of flat) {
    byDay.set(item.dayNumber, item);
  }

  const merged: OutlineItem[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const existing = byDay.get(day);
    const phase = phases.find((p) => day >= p.startDay && day <= p.endDay);
    if (existing) {
      merged.push({
        ...existing,
        phaseName: existing.phaseName ?? phase?.name,
        phaseOrder: existing.phaseOrder ?? phase?.order,
        difficulty: existing.difficulty ?? phase?.difficulty,
      });
    } else if (phase) {
      merged.push({
        dayNumber: day,
        title: `${phase.name}：${phase.topicHints[0]}`,
        goal: phase.goal,
        keywords: phase.topicHints.join(", "),
        estimatedMinutes: 30,
        phaseName: phase.name,
        phaseOrder: phase.order,
        difficulty: phase.difficulty,
        learningObjective: phase.goal,
        prerequisites: day > 1 ? String(day - 1) : undefined,
      });
    }
  }
  return merged;
}

function parseOutlineJson(content: string): OutlineItem[] {
  try {
    let jsonStr = content.trim();
    if (!jsonStr) return [];
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
    const lastArrayEnd = jsonStr.lastIndexOf("]");
    if (lastArrayEnd > 0 && jsonStr.startsWith("[")) {
      jsonStr = jsonStr.slice(0, lastArrayEnd + 1);
    }
    const parsed = JSON.parse(jsonStr);
    const outline = Array.isArray(parsed)
      ? parsed
      : parsed.o || parsed.outline || parsed.days || parsed.data;
    if (!Array.isArray(outline)) return [];
    return outline.map((item: Record<string, unknown>, index: number) => ({
      dayNumber: Number(item.d ?? item.dayNumber ?? index + 1),
      title: String(item.t || item.title || ""),
      goal: String(item.obj || item.goal || item.learningObjective || ""),
      keywords: String(item.k || item.keywords || ""),
      estimatedMinutes: (item.estimatedMinutes as number) || 30,
      phaseName: item.phaseName as string | undefined,
      phaseOrder: item.phaseOrder as number | undefined,
      difficulty: item.difficulty as OutlineItem["difficulty"],
      prerequisites: item.prerequisites as string | undefined,
      learningObjective: String(item.obj || item.learningObjective || item.goal || ""),
    }));
  } catch {
    return [];
  }
}

function normalizeOutlineItem(item: OutlineItem, phase: AllocatedPhase): OutlineItem {
  return {
    dayNumber: item.dayNumber,
    title: item.title || `第 ${item.dayNumber} 天`,
    goal: item.goal || phase.goal,
    keywords: item.keywords || phase.topicHints.slice(0, 3).join(", "),
    estimatedMinutes: item.estimatedMinutes || 30,
    phaseName: item.phaseName || phase.name,
    phaseOrder: item.phaseOrder ?? phase.order,
    difficulty: item.difficulty || phase.difficulty,
    prerequisites:
      item.prerequisites ||
      (item.dayNumber > phase.startDay ? String(item.dayNumber - 1) : undefined),
    learningObjective: item.learningObjective || item.goal || phase.goal,
  };
}

export async function generateAssessmentQuestions(
  goal: string,
  learningType: LearningType = "abstract_logic",
  userId?: number,
): Promise<AssessmentQuestion[]> {
  const questions = await requestAssessmentQuestions(goal, learningType, 0.2, userId);
  if (questions) return questions;

  const retry = await requestAssessmentQuestions(goal, learningType, 0.1, userId, 1);
  if (!retry) {
    throw new Error("评估题目生成失败，请重试");
  }
  return retry;
}

async function requestAssessmentQuestions(
  goal: string,
  learningType: LearningType,
  temperature: number,
  userId?: number,
  retryCount = 0,
): Promise<AssessmentQuestion[] | null> {
  const startedAt = Date.now();
  const assembled = await assemblePrompt(learningType, "assessment", { goal });
  if (!assembled) {
    throw new Error(`评估题 Prompt 未配置：请在 prompt_templates 中配置 assessment:${learningType} 模板`);
  }

  const log = (fields: { status: "success" | "failed"; parseSuccess?: boolean; outputRaw?: string; errorMessage?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }) =>
    logAIGeneration({
      userId, taskType: "assessment", typeKey: learningType,
      status: fields.status,
      templateId: assembled?.templateId, templateVersion: assembled?.version,
      inputVars: { goal }, outputRaw: fields.outputRaw?.slice(0, 8000),
      parseSuccess: fields.parseSuccess, retryCount,
      errorMessage: fields.errorMessage,
      promptTokens: fields.usage?.prompt_tokens,
      completionTokens: fields.usage?.completion_tokens,
      durationMs: Date.now() - startedAt,
    });

  let response: Response;
  try {
    response = await chatCompletion(
      {
        messages: [
          {
            role: "system",
            content: assembled.system,
          },
          {
            role: "user",
            content: assembled.user || `为「${goal}」出 5 道短选择题，只考该目标知识点。`,
          },
        ],
        temperature,
        max_tokens: assembled.maxTokens,
        response_format: { type: "json_object" },
      },
      { signal: abortAfter(90_000) },
    );
  } catch {
    void log({ status: "failed", errorMessage: "请求异常/超时" });
    return null;
  }

  if (!response.ok) {
    void log({ status: "failed", errorMessage: `HTTP ${response.status}` });
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed)
      ? parsed
      : parsed.q || parsed.questions || parsed.data || [];

    if (!Array.isArray(raw) || raw.length < 5) {
      void log({ status: "failed", parseSuccess: false, outputRaw: content, errorMessage: "题目数量不足", usage: data.usage });
      return null;
    }

    const questions = raw.slice(0, 5).map((item: Record<string, unknown>, i: number) => ({
      questionIndex: Number(item.i ?? item.questionIndex ?? i + 1),
      question: String(item.q || item.question || ""),
      optionsA: String(item.a || item.optionsA || item.optionA || ""),
      optionsB: String(item.b || item.optionsB || item.optionB || ""),
      optionsC: String(item.c || item.optionsC || item.optionC || ""),
      optionsD: String((item as { d?: unknown }).d || item.optionsD || item.optionD || ""),
      correctAnswer: String(item.ans || item.correctAnswer || item.correct || "A"),
      explanation: String(item.e || item.explanation || ""),
      difficulty: String(item.lv || item.difficulty || "basic") as AssessmentQuestion["difficulty"],
    }));

    const offTopic = /如何学习|遇到困难|理论结合实践|最有效的方法|完全陌生的领域/;
    if (questions.some((q) => !q.question.trim() || offTopic.test(q.question))) {
      void log({ status: "failed", parseSuccess: true, outputRaw: content, errorMessage: "检测到偏题/空题", usage: data.usage });
      return null;
    }
    if (questions.some((q) => !q.optionsA || !q.optionsB || !q.optionsC || !q.optionsD)) {
      void log({ status: "failed", parseSuccess: true, outputRaw: content, errorMessage: "选项缺失", usage: data.usage });
      return null;
    }

    void log({ status: "success", parseSuccess: true, outputRaw: content, usage: data.usage });
    return questions;
  } catch {
    void log({ status: "failed", parseSuccess: false, outputRaw: content, errorMessage: "JSON 解析失败", usage: data.usage });
    return null;
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface DayQAContext {
  planGoal: string;
  dayNumber: number;
  dayTitle: string;
  dayGoal: string;
  learningType: string;
  markdownContent: string;
}

const TYPE_LABEL_MAP: Record<string, string> = {
  abstract_logic: "抽象逻辑型",
  operation_logic: "操作逻辑型",
  language: "语言学习型",
  network_assoc: "网络关联型",
  model_apply: "模型应用型",
  perception: "感知表达型",
  practical: "实践技艺型",
};

/** 从数据库组装 QA 系统 Prompt（qa:day 模板） */
export async function buildQASystemPrompt(ctx: DayQAContext): Promise<string> {
  const assembled = await assemblePrompt(null, "qa", {
    planGoal: ctx.planGoal,
    dayNumber: ctx.dayNumber,
    dayTitle: ctx.dayTitle,
    dayGoal: ctx.dayGoal || "（见下方学习材料）",
    typeLabel: TYPE_LABEL_MAP[ctx.learningType] || ctx.learningType,
    markdownContent: ctx.markdownContent,
  });
  if (!assembled) {
    throw new Error("QA Prompt 未配置：请在 prompt_templates 中配置 purpose=qa 的模板");
  }
  return assembled.system;
}

export async function askAIWithContext(
  question: string,
  dayContext: DayQAContext,
  history: ChatMessage[],
): Promise<string> {
  try {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: await buildQASystemPrompt(dayContext) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    const response = await chatCompletion({
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    if (!response.ok) {
      return "抱歉，AI服务暂时不可用，请稍后再试。";
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || "抱歉，没有获得有效回答。";
  } catch {
    return "抱歉，请求出错了，请稍后再试。";
  }
}

/** @deprecated 请使用 askAIWithContext 或 qa.askAndAnswer */
export async function askAI(question: string, context: string): Promise<string> {
  return askAIWithContext(
    question,
    {
      planGoal: "",
      dayNumber: 0,
      dayTitle: "",
      dayGoal: "",
      learningType: "abstract_logic",
      markdownContent: context,
    },
    [],
  );
}

export async function streamQAWithContext(
  question: string,
  dayContext: DayQAContext,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<Response> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: await buildQASystemPrompt(dayContext) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  return chatCompletion(
    {
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
    },
    { signal },
  );
}

export type StreamContentMeta = {
  dayNumber?: number;
  phaseOrder?: number;
  totalDays?: number;
  phaseName?: string;
  phaseGoal?: string;
  signal?: AbortSignal;
};

export async function streamContent(
  prompt: string,
  learningType: LearningType = "abstract_logic",
  skillLevel: string = "l1",
  meta: StreamContentMeta = {},
): Promise<Response> {
  const dayNumber = meta.dayNumber ?? 1;
  const assembled = await assemblePrompt(
    learningType,
    "content",
    {
      skillLevel,
      dayNumber,
      phaseOrder: meta.phaseOrder,
      totalDays: meta.totalDays,
      phaseName: meta.phaseName,
      phaseGoal: meta.phaseGoal,
    },
    { dayNumber, phaseOrder: meta.phaseOrder },
  );
  if (!assembled) {
    throw new Error(`内容生成 Prompt 未配置：请在 prompt_templates 中配置 content:${learningType} 模板`);
  }

  return chatCompletion(
    {
      messages: [
        { role: "system", content: assembled.system },
        { role: "user", content: prompt },
      ],
      stream: true,
      temperature: assembled.temperature,
      max_tokens: assembled.maxTokens,
    },
    { signal: meta.signal },
  );
}

