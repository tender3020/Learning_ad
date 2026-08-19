import {
  type LearningType,
  getTypeDetectionPrompt,
  parseTypeFromAIResponse,
  getTypeSystemPrompt,
  getTypeAssessmentPrompt,
} from "@shared/typeEngine";
import { allocatePhases, type AllocatedPhase } from "@shared/outlinePhases";
import { validateOutline } from "@shared/outlineValidation";
import type { OutlineItem } from "@shared/outlineTypes";
import { chatCompletion } from "../lib/deepseek";

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
): Promise<{ type: LearningType; reason: string }> {
  const response = await chatCompletion({
    messages: [
      { role: "system", content: getTypeDetectionPrompt(goal) },
      { role: "user", content: goal },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  if (!response.ok) {
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

  return { type, reason };
}

export async function generateOutline(
  goal: string,
  totalDays: number,
  learningType: LearningType = "abstract_logic",
  skillLevel: string = "l1",
): Promise<OutlineItem[]> {
  const phases = allocatePhases(learningType, totalDays);
  let outline = await expandAllPhasesSequential(goal, learningType, skillLevel, phases);

  let validation = validateOutline(outline, totalDays);
  if (!validation.valid) {
    console.warn("[generateOutline] 校验未通过，重试:", validation.errors.join("; "));
    outline = await expandAllPhasesSequential(goal, learningType, skillLevel, phases, 0.35);
    validation = validateOutline(outline, totalDays);
    if (!validation.valid) {
      console.warn("[generateOutline] 重试后仍有问题:", validation.errors.join("; "));
    }
  }

  if (outline.length === 0) {
    throw new Error("大纲生成失败：AI 未返回有效数据，请重试");
  }

  return outline.slice(0, totalDays);
}

async function expandAllPhasesSequential(
  goal: string,
  learningType: LearningType,
  skillLevel: string,
  phases: AllocatedPhase[],
  temperature = 0.4,
): Promise<OutlineItem[]> {
  const phaseResults: OutlineItem[][] = [];
  let prevLastTitle: string | undefined;

  for (const phase of phases) {
    const items = await expandPhaseOutline(
      goal,
      learningType,
      skillLevel,
      phase,
      prevLastTitle,
      temperature,
    );
    phaseResults.push(items);
    if (items.length > 0) prevLastTitle = items[items.length - 1]?.title;
  }

  return mergePhaseOutlines(phases, phaseResults, phases.reduce((s, p) => s + p.dayCount, 0));
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

async function expandPhaseOutline(
  goal: string,
  learningType: LearningType,
  skillLevel: string,
  phase: AllocatedPhase,
  prevPhaseLastTitle?: string,
  temperature = 0.4,
): Promise<OutlineItem[]> {
  const prevHint = prevPhaseLastTitle
    ? `\n上一阶段最后一天主题：「${prevPhaseLastTitle}」。本阶段第 ${phase.startDay} 天应在此基础上递进，不要重复相同主题。`
    : "";
  const dayRange =
    phase.dayCount === 1
      ? `第 ${phase.startDay} 天（仅 1 天）`
      : `第 ${phase.startDay} 至 ${phase.endDay} 天（共 ${phase.dayCount} 天）`;

  const response = await chatCompletion({
    messages: [
      {
        role: "system",
        content: `你是课程大纲设计专家。为学习目标「${goal}」展开一个学习阶段的大纲。
学习类型：${learningType}，学习者水平：${skillLevel}。

【输出格式】只返回 JSON 数组，不要 markdown 代码块：
[{"dayNumber": ${phase.startDay}, "title": "具体主题", "goal": "当日目标", "keywords": "词1, 词2", "estimatedMinutes": 30, "learningObjective": "可测量的当日目标", "prerequisites": "前置天编号", "phaseName": "${phase.name}", "phaseOrder": ${phase.order}, "difficulty": "${phase.difficulty}"}]

【要求】
1. 必须输出恰好 ${phase.dayCount} 条，dayNumber 从 ${phase.startDay} 到 ${phase.endDay}
2. title 必须具体唯一，禁止「第N天学习」「继续学习」等笼统标题
3. 相邻天主题递进，同一阶段内由浅入深
4. prerequisites 填写前置 dayNumber（逗号分隔）或前置知识点短语`,
      },
      {
        role: "user",
        content: `阶段「${phase.name}」(${dayRange})
阶段目标：${phase.goal}
建议子主题方向：${phase.topicHints.join("、")}${prevHint}

请生成该阶段 ${phase.dayCount} 天的完整大纲 JSON。`,
      },
    ],
    temperature,
    max_tokens: Math.min(8192, 400 + phase.dayCount * 280),
  });

  if (!response.ok) {
    return buildFallbackPhaseOutline(goal, phase);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = parseOutlineJson(content);

  if (parsed.length >= phase.dayCount) {
    return parsed
      .filter((item) => item.dayNumber >= phase.startDay && item.dayNumber <= phase.endDay)
      .slice(0, phase.dayCount)
      .map((item) => normalizeOutlineItem(item, phase));
  }

  return buildFallbackPhaseOutline(goal, phase);
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
    const outline = Array.isArray(parsed) ? parsed : parsed.outline;
    if (!Array.isArray(outline)) return [];
    return outline.map((item: Record<string, unknown>, index: number) => ({
      dayNumber: (item.dayNumber as number) || index + 1,
      title: String(item.title || ""),
      goal: String(item.goal || item.learningObjective || ""),
      keywords: String(item.keywords || ""),
      estimatedMinutes: (item.estimatedMinutes as number) || 30,
      phaseName: item.phaseName as string | undefined,
      phaseOrder: item.phaseOrder as number | undefined,
      difficulty: item.difficulty as OutlineItem["difficulty"],
      prerequisites: item.prerequisites as string | undefined,
      learningObjective: String(item.learningObjective || item.goal || ""),
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

function buildFallbackPhaseOutline(goal: string, phase: AllocatedPhase): OutlineItem[] {
  const items: OutlineItem[] = [];
  for (let d = phase.startDay; d <= phase.endDay; d++) {
    const idx = d - phase.startDay;
    const topic = phase.topicHints[idx % phase.topicHints.length];
    items.push({
      dayNumber: d,
      title: `${topic}`,
      goal: `${goal} — ${phase.goal}`,
      keywords: phase.topicHints.join(", "),
      estimatedMinutes: 30,
      phaseName: phase.name,
      phaseOrder: phase.order,
      difficulty: phase.difficulty,
      prerequisites: d > 1 ? String(d - 1) : undefined,
      learningObjective: `掌握${topic}相关要点`,
    });
  }
  return items;
}

export async function generateAssessmentQuestions(
  goal: string,
  learningType: LearningType = "abstract_logic",
): Promise<AssessmentQuestion[]> {
  const typePrompt = getTypeAssessmentPrompt(learningType, goal);

  const response = await chatCompletion({
    messages: [
      {
        role: "system",
        content: `${typePrompt}

请严格按以下 JSON 格式返回，不要包含任何其他内容：
[{"questionIndex": 1, "question": "题目", "optionsA": "A选项", "optionsB": "B选项", "optionsC": "C选项", "optionsD": "D选项", "correctAnswer": "A", "explanation": "解析", "difficulty": "basic"}]

注意：
1. 只返回 JSON 数组
2. 题目要覆盖目标知识领域的核心概念
3. 选项要有迷惑性，不能太明显
4. explanation 要详细说明为什么正确、为什么其他选项错误
5. 难度梯度：第1-2题basic，第3题intermediate，第4题advanced，第5题expert`,
      },
      { role: "user", content: `请为「${goal}」设计 5 道能力评估测试题` },
    ],
    temperature: 0.6,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  if (!response.ok) {
    return getDefaultAssessmentQuestions(goal);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions || parsed.data || [];

    if (Array.isArray(questions) && questions.length >= 3) {
      return questions.slice(0, 5).map((q: Record<string, unknown>, i: number) => ({
        questionIndex: (q.questionIndex as number) || i + 1,
        question: (q.question as string) || `题目 ${i + 1}`,
        optionsA: (q.optionsA as string) || (q.optionA as string) || (q.a as string) || "",
        optionsB: (q.optionsB as string) || (q.optionB as string) || (q.b as string) || "",
        optionsC: (q.optionsC as string) || (q.optionC as string) || (q.c as string) || "",
        optionsD: (q.optionsD as string) || (q.optionD as string) || (q.d as string) || "",
        correctAnswer: (q.correctAnswer as string) || (q.correct as string) || "A",
        explanation: (q.explanation as string) || "",
        difficulty: ((q.difficulty as string) || "basic") as AssessmentQuestion["difficulty"],
      }));
    }
  } catch {
    // JSON 解析失败
  }

  return getDefaultAssessmentQuestions(goal);
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

export function buildQASystemPrompt(ctx: DayQAContext): string {
  const typeLabel =
    ({
      abstract_logic: "抽象逻辑型",
      operation_logic: "操作逻辑型",
      language: "语言学习型",
      network_assoc: "网络关联型",
      model_apply: "模型应用型",
      perception: "感知表达型",
      practical: "实践技艺型",
    } as Record<string, string>)[ctx.learningType] || ctx.learningType;

  return `你是一位耐心的 AI 学习导师，正在辅导学习者完成今日课程。

【学习定位】
- 整体目标：${ctx.planGoal}
- 当前进度：第 ${ctx.dayNumber} 天
- 今日主题：${ctx.dayTitle}
- 今日目标：${ctx.dayGoal || "（见下方学习材料）"}
- 学习类型：${typeLabel}

【今日学习材料 — 回答必须以此为准】
${ctx.markdownContent}

【回答规则】
1. 所有回答必须优先基于【今日学习材料】，引用材料中的概念、例题、步骤进行讲解
2. 若问题超出材料范围，先说明「今日材料中未涉及」，再简要补充，并建议回到材料中的相关章节
3. 结合对话历史理解「这个」「刚才那个」「再解释一下」等指代
4. 采用引导式教学：先定位到材料中的相关部分，再分步解释，必要时举例
5. 用清晰、完整的中文回答，可以使用 Markdown 格式（公式用 $...$ 或 $$...$$）`;
}

export async function askAIWithContext(
  question: string,
  dayContext: DayQAContext,
  history: ChatMessage[],
): Promise<string> {
  try {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildQASystemPrompt(dayContext) },
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
    { role: "system", content: buildQASystemPrompt(dayContext) },
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

export async function streamContent(
  prompt: string,
  learningType: LearningType = "abstract_logic",
  skillLevel: string = "l1",
  signal?: AbortSignal,
): Promise<Response> {
  const systemPrompt = getTypeSystemPrompt(learningType, skillLevel);

  return chatCompletion(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 8192,
    },
    { signal },
  );
}

function getDefaultAssessmentQuestions(goal: string): AssessmentQuestion[] {
  return [
    {
      questionIndex: 1,
      question: `关于「${goal}」的基础认知，以下哪个描述最准确？`,
      optionsA: "这是一个完全陌生的领域，没有任何实际用途",
      optionsB: "这是一个需要系统学习和实践的技能领域",
      optionsC: "这是一个已经过时的技术，不值得学习",
      optionsD: "这与日常生活毫无关联",
      correctAnswer: "B",
      explanation: `${goal} 是一个需要系统学习和实践的技能领域。通过循序渐进的学习和反复练习，可以逐步掌握其核心概念和应用方法。`,
      difficulty: "basic",
    },
    {
      questionIndex: 2,
      question: `学习「${goal}」时，最有效的方法是什么？`,
      optionsA: "只看理论书籍，从不动手实践",
      optionsB: "理解核心概念并动手实践，反复练习巩固",
      optionsC: "只看视频教程，不做任何练习",
      optionsD: "完全依赖他人的指导，不主动思考",
      correctAnswer: "B",
      explanation: "理解核心概念并通过实际练习来巩固知识，是学习任何技能最有效的方法。理论和实践相结合才能真正掌握。",
      difficulty: "basic",
    },
    {
      questionIndex: 3,
      question: `在「${goal}」的学习过程中，遇到困难时应该怎么做？`,
      optionsA: "立即放弃，认为这个领域不适合自己",
      optionsB: "查阅资料、寻求帮助并通过实验验证",
      optionsC: "跳过困难的部分，假装已经学会了",
      optionsD: "等待别人主动来教自己",
      correctAnswer: "B",
      explanation: "遇到困难时，应该主动查阅资料、向社区寻求帮助，并通过反复实验来验证和加深理解。这是最有效的学习方式。",
      difficulty: "intermediate",
    },
    {
      questionIndex: 4,
      question: `关于「${goal}」的进阶应用，以下哪项是正确的？`,
      optionsA: "只需要掌握基础概念就足够了",
      optionsB: "需要深入理解原理，并能灵活运用到不同场景中",
      optionsC: "背诵所有知识点就能成为专家",
      optionsD: "进阶阶段不需要再学习了",
      correctAnswer: "B",
      explanation: "进阶阶段需要深入理解底层原理，并能够灵活地将所学知识应用到各种不同的场景中，而不是仅仅停留在表面记忆。",
      difficulty: "advanced",
    },
    {
      questionIndex: 5,
      question: `在「${goal}」的高级阶段，最有价值的提升方向是什么？`,
      optionsA: "停留在已经掌握的知识上，不再学习新内容",
      optionsB: "深入理解底层原理，结合实际场景进行创新和优化",
      optionsC: "只关注理论，完全忽视实践应用",
      optionsD: "重复做已经会的内容，不再挑战自己",
      correctAnswer: "B",
      explanation: "高级阶段应该深入理解底层原理，结合实际业务场景进行创新和优化。真正的掌握体现在能够创造性地解决问题，而不是仅仅重复已有的知识。",
      difficulty: "expert",
    },
  ];
}
