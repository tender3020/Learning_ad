/**
 * ============================================================================
 * Learning Type Engine - 学习类型定义与解析
 * ============================================================================
 *
 * 7种类型：
 * 1. abstract_logic     - 抽象逻辑型（数学/物理/统计）
 * 2. operation_logic    - 操作逻辑型（编程/软件/工具）
 * 3. language           - 语言学习型（英语/日语等）
 * 4. network_assoc      - 网络关联型（历史/法律/政治）
 * 5. model_apply        - 模型应用型（金融/经济/管理）
 * 6. perception         - 感知表达型（绘画/摄影/写作）
 * 7. practical          - 实践技艺型（烹饪/驾驶/急救）
 *
 * 注意：所有 AI Prompt（类型判定/评估题/大纲/内容/QA）均已迁移到数据库，
 * 由 api/services/promptService.ts 组装。本文件只保留类型定义、
 * AI 响应解析、token 预算与配图策略。
 * ============================================================================
 */

export type LearningType =
  | "abstract_logic"
  | "operation_logic"
  | "language"
  | "network_assoc"
  | "model_apply"
  | "perception"
  | "practical";

export const TYPE_NAMES: Record<LearningType, string> = {
  abstract_logic: "抽象逻辑型",
  operation_logic: "操作逻辑型",
  language: "语言学习型",
  network_assoc: "网络关联型",
  model_apply: "模型应用型",
  perception: "感知表达型",
  practical: "实践技艺型",
};

export const TYPE_LABELS: Record<LearningType, { name: string; color: string; icon: string; desc: string }> = {
  abstract_logic: { name: "抽象逻辑", color: "#A78BFA", icon: "🔢", desc: "数学/物理/统计等需推导的纯理论" },
  operation_logic: { name: "操作逻辑", color: "#0A84FF", icon: "💻", desc: "编程/软件/工具等需动手操作的内容" },
  language: { name: "语言学习", color: "#34C759", icon: "🗣️", desc: "英语/日语等自然语言的综合学习" },
  network_assoc: { name: "网络关联", color: "#FF9500", icon: "🕸️", desc: "历史/法律/政治等叙事因果关联型" },
  model_apply: { name: "模型应用", color: "#6E56CF", icon: "📊", desc: "金融/经济/管理等模型套用现实" },
  perception: { name: "感知表达", color: "#FF69B4", icon: "🎨", desc: "绘画/摄影/写作等审美创作型" },
  practical: { name: "实践技艺", color: "#5AC8FA", icon: "🔧", desc: "烹饪/驾驶/急救等安全操作流程" },
};

/** 将AI返回的字符串解析为 LearningType */
const LEARNING_TYPE_PATTERN =
  "abstract_logic|operation_logic|language|network_assoc|model_apply|perception|practical";

export function parseTypeFromAIResponse(response: string): LearningType {
  const text = response.trim();
  const pipeMatches = [
    ...text.matchAll(new RegExp(`([1-7])\\s*\\|\\s*(${LEARNING_TYPE_PATTERN})`, "gi")),
  ];
  if (pipeMatches.length > 0) {
    return pipeMatches[pipeMatches.length - 1][2].toLowerCase() as LearningType;
  }

  const nameMatches = [...text.matchAll(new RegExp(`(${LEARNING_TYPE_PATTERN})`, "gi"))];
  if (nameMatches.length > 0) {
    return nameMatches[nameMatches.length - 1][1].toLowerCase() as LearningType;
  }

  return "abstract_logic";
}

/** 大纲每天预估输出 token（紧凑 JSON），用于动态计算 max_tokens 上限 */
export function getOutlineTokensPerDay(type: LearningType): number {
  const perDay: Record<LearningType, number> = {
    abstract_logic: 70,
    operation_logic: 65,
    language: 55,
    network_assoc: 60,
    model_apply: 65,
    perception: 55,
    practical: 55,
  };
  return perDay[type] ?? 60;
}

export type VisualMedium = "wanxiang" | "mermaid";

/** 按学习类型限制万相 / Mermaid 配图数量 */
export function applyIllustrationQuotas<T extends { visualMedium: VisualMedium }>(
  type: LearningType,
  plans: T[],
): T[] {
  const neverMermaid: LearningType[] = [
    "language",
    "network_assoc",
    "perception",
    "practical",
  ];
  const wanxiangMax: Record<LearningType, number> = {
    abstract_logic: 1,
    operation_logic: 1,
    model_apply: 2,
    language: 3,
    network_assoc: 3,
    perception: 3,
    practical: 3,
  };
  const mermaidMax: Record<LearningType, number> = {
    abstract_logic: 2,
    operation_logic: 1,
    model_apply: 1,
    language: 0,
    network_assoc: 0,
    perception: 0,
    practical: 0,
  };

  let wanxiang = 0;
  let mermaid = 0;
  const result: T[] = [];

  for (const plan of plans) {
    if (plan.visualMedium === "mermaid") {
      if (neverMermaid.includes(type) || mermaid >= mermaidMax[type]) continue;
      mermaid += 1;
      result.push(plan);
    } else if (plan.visualMedium === "wanxiang") {
      if (wanxiang >= wanxiangMax[type]) continue;
      wanxiang += 1;
      result.push(plan);
    }
  }

  return result;
}

/** 各学习类型优先配图的章节标题关键词 */
export function getImageSectionKeywords(type: LearningType): string[] {
  const keywords: Record<LearningType, string[]> = {
    abstract_logic: ["核心概念", "直观理解", "推导过程", "生活化"],
    operation_logic: ["今日概念", "代码示例", "运行结果", "动手练习"],
    language: ["今日场景", "场景对话", "核心句型", "词汇"],
    network_assoc: ["今日叙事", "关键要素", "影响与意义", "因果"],
    model_apply: ["今日模型", "手算案例", "现实套用", "商业"],
    perception: ["今日目标", "示范与拆解", "分步操作", "作品"],
    practical: ["准备工作", "分步操作", "安全须知", "关键技巧"],
  };
  return keywords[type] ?? keywords.abstract_logic;
}

/** 各类型默认配图策略：diagram 优先章节 vs scene 优先章节 */
export function getImageMediumForSection(
  type: LearningType,
  sectionTitle: string | null,
): VisualMedium {
  const neverMermaid: LearningType[] = [
    "language",
    "network_assoc",
    "perception",
    "practical",
  ];
  if (neverMermaid.includes(type)) return "wanxiang";

  const title = sectionTitle ?? "";
  const diagramKeywords: Record<LearningType, string[]> = {
    abstract_logic: ["推导", "核心概念", "直观理解"],
    operation_logic: ["代码", "概念", "语法", "流程"],
    language: [],
    network_assoc: [],
    model_apply: ["模型", "关系"],
    perception: [],
    practical: [],
  };
  const keys = diagramKeywords[type] ?? [];
  if (keys.some((k) => title.includes(k))) return "mermaid";
  return "wanxiang";
}

const sectionGuides: Record<LearningType, string> = {
  abstract_logic: `优先章节：「今日核心概念」「推导过程」「直观理解验证」
- 推导/概念关系 → visualMedium: mermaid（flowchart 或 graph，节点用正文术语；服务端会插入 \`\`\`mermaid 代码块，非 PNG）
- 生活比喻场景 → visualMedium: wanxiang（abstract_logic 最多 1 张万相）`,
  operation_logic: `优先章节：「今日概念」「完整代码示例」「运行结果」
- 代码执行流程/模块调用 → visualMedium: mermaid（flowchart 或 sequenceDiagram，插入正文代码块）
- 终端/编辑器界面场景 → visualMedium: wanxiang（最多 1 张）`,
  language: `优先章节：「今日场景」「场景对话」「核心句型」
- 全部使用 visualMedium: wanxiang`,
  network_assoc: `优先章节：「今日叙事」「关键要素卡」「影响与意义」
- 全部使用 visualMedium: wanxiang（历史场景，不要流程图）`,
  model_apply: `优先章节：「今日模型」「手算案例」「现实套用」
- 模型关系 → visualMedium: mermaid
- 商业/生活案例 → visualMedium: wanxiang`,
  perception: `优先章节：「今日目标」「示范与拆解」「分步操作」
- 全部使用 visualMedium: wanxiang`,
  practical: `优先章节：「准备工作」「分步操作」「安全须知」
- 全部使用 visualMedium: wanxiang`,
};

/** 分段结构化场景摘要提取（Stage A） */
export function getImageSceneBriefExtractionPrompt(
  type: LearningType,
  dayTitle: string,
): string {
  return `你是教育内容配图策划。学习类型：${TYPE_NAMES[type]}。今日主题：${dayTitle}

${sectionGuides[type]}

用户将提供若干 Markdown 章节片段。为每个章节输出一条结构化配图摘要。

要求：
- 输出 2-3 条（优先 3 条）
- anchorText：必须是该章节正文中的**完整句子**（20-40 个汉字），与章节 Markdown 完全一致，不要标题
- uniqueIdentifiers：从该章节正文摘取 2-4 个专有名词/具体动作/工具/人名/地点，禁止只用「${dayTitle}」
- visualMedium 为 wanxiang 或 mermaid（见上方类型指引）
- visualMedium 为 mermaid 时只填 mermaidCode，不要填 wanxiang 的 subjects/style；mermaid 会以 \`\`\`mermaid 代码块插入正文，由客户端渲染
- visualMedium 为 wanxiang 时填写 subjects/setting/action/style/avoid
- mermaidCode 使用 flowchart TD、graph LR 或 sequenceDiagram，节点标签用正文中的具体术语（中文），至少 4 个节点，不要 markdown 代码块包裹
- mermaid 语法：含括号、冒号的标签用双引号；第一行必须是图表类型声明
- 禁止空泛描述如「某某主题的教育插画」
- style 统一：清晰教育风格，柔和配色，3:2 横向构图
- avoid 必须包含「画面中出现任何文字、水印、logo」（wanxiang 时）
- 只返回 JSON 数组，不要 markdown 代码块：
[{"sectionTitle":"章节标题","anchorText":"正文完整句子","visualMedium":"wanxiang","sceneType":"dialogue","subjects":["..."],"setting":"...","action":"...","uniqueIdentifiers":["..."],"style":"...","avoid":["..."]}]
或
[{"sectionTitle":"章节标题","anchorText":"正文完整句子","visualMedium":"mermaid","uniqueIdentifiers":["..."],"mermaidCode":"flowchart TD\\n  A[概念A] --> B[概念B]"}]`;
}

/** @deprecated 保留兼容，请使用 getImageSceneBriefExtractionPrompt */
export function getImagePromptExtractionPrompt(
  type: LearningType,
  dayTitle: string,
): string {
  return getImageSceneBriefExtractionPrompt(type, dayTitle);
}
