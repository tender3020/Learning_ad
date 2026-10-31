import { and, eq } from "drizzle-orm";
import {
  promptTemplates,
  promptTemplateItems,
  promptComponents,
  promptVersions,
  aiGenerationLogs,
  type PromptTemplate,
} from "@db/schema";
import { allocatePhases, formatPhaseRoadmap, formatPhaseOutlineGuide, getPhaseForDay } from "@shared/outlinePhases";
import type { LearningType } from "@shared/typeEngine";
import { getDb } from "../queries/connection";

export type PromptPurpose = "detect" | "assessment" | "outline" | "content" | "qa";

export interface AssembleContext {
  dayNumber?: number;
  phaseOrder?: number;
}

export interface AssembledPrompt {
  templateId: number;
  version: number;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "json_object" | "text" | "stream";
}

export type PromptVars = Record<string, string | number | undefined>;

const LEVEL_HINTS: Record<string, string> = {
  l1: "零基础，从最基础概念讲起，详细铺垫",
  l2: "入门，简要回顾基础聚焦核心知识",
  l3: "中级，跳过基础进阶内容+实战案例",
  l4: "进阶，深入高级主题前沿技术",
  l5: "高级，专家级内容最佳实践架构设计",
};

type ComponentPart = {
  sortOrder: number;
  slot: "system" | "user";
  content: string;
  componentKey: string;
};

/** {{var}} 变量替换；未提供的变量保留原样，便于排查 */
function substitute(text: string, vars: PromptVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

type PhaseContext = {
  phaseOrder: number;
  phaseName: string;
  phaseGoal: string;
  phaseHints: string;
  /** 阶段内第几天（从 1 起）；无法推算时为 1 */
  dayInPhase: number;
  /** 模型应用型 A/B 轮换；其他类型忽略 */
  phaseVariant: "A" | "B";
};

function resolvePhaseContext(
  typeKey: string | undefined,
  vars: PromptVars,
  ctx: AssembleContext,
): PhaseContext {
  const dayNumber = ctx.dayNumber ?? Number(vars.dayNumber ?? 1);
  const totalDays = Number(vars.totalDays ?? 0);
  let phaseOrder = ctx.phaseOrder ?? Number(vars.phaseOrder ?? 0);

  if (typeKey && totalDays > 0) {
    const phases = allocatePhases(typeKey as LearningType, totalDays);
    const phase =
      phaseOrder > 0
        ? phases.find((p) => p.order === phaseOrder)
        : getPhaseForDay(phases, dayNumber);
    if (phase) {
      const dayInPhase = Math.max(1, dayNumber - phase.startDay + 1);
      return {
        phaseOrder: phase.order,
        phaseName: String(vars.phaseName ?? phase.name),
        phaseGoal: String(vars.phaseGoal ?? phase.goal),
        phaseHints: phase.topicHints.join("、"),
        dayInPhase,
        phaseVariant: dayInPhase % 2 === 1 ? "A" : "B",
      };
    }
  }

  return {
    phaseOrder: phaseOrder > 0 ? phaseOrder : 1,
    phaseName: String(vars.phaseName ?? "当前阶段"),
    phaseGoal: String(vars.phaseGoal ?? ""),
    phaseHints: "",
    dayInPhase: 1,
    phaseVariant: "A",
  };
}

/** 运行时派生变量：levelHint / roadmap / phase 等由代码计算，不存数据库 */
function deriveVars(
  purpose: PromptPurpose,
  typeKey: string | undefined,
  vars: PromptVars,
  ctx: AssembleContext,
): PromptVars {
  const derived: PromptVars = { ...vars };
  const skillLevel = String(vars.skillLevel ?? "l1");
  derived.levelHint = LEVEL_HINTS[skillLevel] ?? LEVEL_HINTS.l3;

  if (purpose === "outline" && typeKey && vars.totalDays !== undefined) {
    const phases = allocatePhases(typeKey as LearningType, Number(vars.totalDays));
    derived.roadmap = formatPhaseRoadmap(phases);
    derived.phaseOutlineGuide = formatPhaseOutlineGuide(phases);
  }

  if (purpose === "content") {
    const phase = resolvePhaseContext(typeKey, vars, ctx);
    derived.phaseOrder = phase.phaseOrder;
    derived.phaseName = phase.phaseName;
    derived.phaseGoal = phase.phaseGoal;
    derived.phaseHints = phase.phaseHints;
  }

  return derived;
}

/** 从 component_key 解析阶段序号，如 phase:content:model_apply:3 或 ...:3:A → 3 */
function parsePhaseFromKey(componentKey: string): number | null {
  const match = componentKey.match(/^phase:content:[^:]+:(\d+)(?::[AB])?$/);
  return match ? Number(match[1]) : null;
}

/** 解析 A/B 变体；无后缀则返回 null（非轮换片段） */
function parsePhaseVariantFromKey(componentKey: string): "A" | "B" | null {
  const match = componentKey.match(/^phase:content:[^:]+:\d+:([AB])$/);
  return match ? (match[1] as "A" | "B") : null;
}

/**
 * phase:content:* 仅保留当前阶段；
 * 带 :A/:B 后缀的片段再按阶段内天数奇偶过滤（奇数 A、偶数 B）。
 */
function filterByPhase(
  parts: ComponentPart[],
  phaseOrder: number,
  phaseVariant: "A" | "B" = "A",
): ComponentPart[] {
  return parts.filter((part) => {
    const keyPhase = parsePhaseFromKey(part.componentKey);
    if (keyPhase === null) return true;
    if (keyPhase !== phaseOrder) return false;
    const keyVariant = parsePhaseVariantFromKey(part.componentKey);
    if (keyVariant === null) return true;
    return keyVariant === phaseVariant;
  });
}

type RawBundle = {
  template: PromptTemplate;
  rows: Array<{
    sortOrder: number;
    slot: "system" | "user";
    overrideContent: string | null;
    content: string;
    componentKey: string;
  }>;
};

const CACHE_TTL_MS = 60_000;
const rawBundleCache = new Map<string, { bundle: RawBundle; expires: number }>();

/** 片段/模板改动后调用，清空缓存 */
export function invalidatePromptCache(typeKey?: string, purpose?: PromptPurpose): void {
  if (!typeKey && !purpose) {
    rawBundleCache.clear();
    return;
  }
  for (const key of rawBundleCache.keys()) {
    const [kType, kPurpose] = key.split(":");
    if (typeKey && kType !== typeKey) continue;
    if (purpose && kPurpose !== purpose) continue;
    rawBundleCache.delete(key);
  }
}

async function loadRawBundle(typeKey: string | null, purpose: PromptPurpose): Promise<RawBundle | null> {
  const db = getDb();

  const conditions = [eq(promptTemplates.purpose, purpose), eq(promptTemplates.isActive, "true")];
  if (typeKey) {
    conditions.push(eq(promptTemplates.typeKey, typeKey));
  }
  const templates = await db
    .select()
    .from(promptTemplates)
    .where(and(...conditions))
    .limit(1);
  const template = templates[0];
  if (!template) return null;

  const rows = await db
    .select({
      sortOrder: promptTemplateItems.sortOrder,
      slot: promptTemplateItems.slot,
      overrideContent: promptTemplateItems.overrideContent,
      content: promptComponents.content,
      componentKey: promptComponents.componentKey,
    })
    .from(promptTemplateItems)
    .innerJoin(promptComponents, eq(promptTemplateItems.componentId, promptComponents.id))
    .where(
      and(
        eq(promptTemplateItems.templateId, template.id),
        eq(promptTemplateItems.isActive, "true"),
        eq(promptComponents.isActive, "true"),
      ),
    )
    .orderBy(promptTemplateItems.slot, promptTemplateItems.sortOrder);

  return { template, rows };
}

function assemblePartsFromRows(
  rows: Array<{
    sortOrder: number;
    slot: "system" | "user";
    overrideContent: string | null;
    content: string;
    componentKey: string;
  }>,
  purpose: PromptPurpose,
  typeKey: string | undefined,
  vars: PromptVars,
  ctx: AssembleContext,
): { systemParts: string[]; userParts: string[] } {
  let parts: ComponentPart[] = rows.map((r) => ({
    sortOrder: r.sortOrder,
    slot: r.slot,
    content: r.overrideContent ?? r.content,
    componentKey: r.componentKey,
  }));

  if (purpose === "content") {
    const { phaseOrder, phaseVariant } = resolvePhaseContext(typeKey, vars, ctx);
    parts = filterByPhase(parts, phaseOrder, phaseVariant);
  }

  parts.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    systemParts: parts.filter((r) => r.slot === "system").map((r) => r.content),
    userParts: parts.filter((r) => r.slot === "user").map((r) => r.content),
  };
}

/**
 * 组装完整 Prompt：按 type + purpose 查模板，拼接片段并替换变量。
 * 带 60s 内存缓存；返回 null 表示未配置，调用方应回退到代码内置 Prompt。
 */
export async function assemblePrompt(
  typeKey: string | null,
  purpose: PromptPurpose,
  vars: PromptVars = {},
  ctx: AssembleContext = {},
): Promise<AssembledPrompt | null> {
  const cacheKey = `${typeKey ?? "_"}:${purpose}`;
  const cached = rawBundleCache.get(cacheKey);
  let rawBundle: RawBundle | null;

  if (cached && cached.expires > Date.now()) {
    rawBundle = cached.bundle;
  } else {
    rawBundle = await loadRawBundle(typeKey, purpose);
    if (!rawBundle) return null;
    rawBundleCache.set(cacheKey, { bundle: rawBundle, expires: Date.now() + CACHE_TTL_MS });
  }

  const { systemParts, userParts } = assemblePartsFromRows(
    rawBundle.rows,
    purpose,
    typeKey ?? undefined,
    vars,
    ctx,
  );
  const fullVars = deriveVars(purpose, typeKey ?? undefined, vars, ctx);

  return {
    templateId: rawBundle.template.id,
    version: rawBundle.template.currentVersion,
    system: systemParts.map((p) => substitute(p, fullVars)).join("\n\n"),
    user: userParts.map((p) => substitute(p, fullVars)).join("\n\n"),
    temperature: rawBundle.template.temperature,
    maxTokens: rawBundle.template.maxTokens,
    responseFormat: rawBundle.template.responseFormat,
  };
}

/** 发布新版本：把当前组装结果快照存入 prompt_versions */
export async function publishPromptVersion(
  templateId: number,
  changeNote: string,
  createdBy?: number,
): Promise<number> {
  const db = getDb();
  const templates = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, templateId))
    .limit(1);
  const template = templates[0];
  if (!template) throw new Error(`模板不存在: ${templateId}`);

  const bundle = await loadRawBundle(template.typeKey, template.purpose);
  if (!bundle) throw new Error(`模板组装失败: ${templateId}`);

  const { systemParts, userParts } = assemblePartsFromRows(
    bundle.rows,
    template.purpose,
    template.typeKey ?? undefined,
    {},
    {},
  );

  const nextVersion = template.currentVersion + 1;
  await db.insert(promptVersions).values({
    templateId,
    version: nextVersion,
    assembledSystem: systemParts.join("\n\n"),
    assembledUser: userParts.join("\n\n"),
    temperature: template.temperature,
    maxTokens: template.maxTokens,
    changeNote,
    createdBy,
  });
  await db
    .update(promptTemplates)
    .set({ currentVersion: nextVersion })
    .where(eq(promptTemplates.id, templateId));

  invalidatePromptCache(template.typeKey ?? undefined, template.purpose);
  return nextVersion;
}

export interface GenerationLogEntry {
  userId?: number;
  planId?: number;
  taskType: PromptPurpose;
  typeKey?: string;
  templateId?: number;
  templateVersion?: number;
  inputVars?: PromptVars;
  outputRaw?: string;
  outputParsed?: unknown;
  parseSuccess?: boolean;
  retryCount?: number;
  status: "success" | "failed";
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
}

/** 写 AI 调用日志；日志失败不影响主流程 */
export async function logAIGeneration(entry: GenerationLogEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(aiGenerationLogs).values({
      userId: entry.userId,
      planId: entry.planId,
      taskType: entry.taskType,
      typeKey: entry.typeKey,
      templateId: entry.templateId,
      templateVersion: entry.templateVersion,
      inputVars: entry.inputVars as Record<string, unknown>,
      outputRaw: entry.outputRaw,
      outputParsed: entry.outputParsed as Record<string, unknown>,
      parseSuccess: entry.parseSuccess === undefined ? undefined : entry.parseSuccess ? "true" : "false",
      retryCount: entry.retryCount ?? 0,
      status: entry.status,
      errorMessage: entry.errorMessage,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      durationMs: entry.durationMs,
    });
  } catch (error) {
    console.warn("[logAIGeneration] 日志写入失败（已忽略）:", error);
  }
}
