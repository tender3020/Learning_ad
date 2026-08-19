import type { LearningType } from "./typeEngine";

export type OutlineDifficulty = "basic" | "intermediate" | "advanced";

export interface OutlinePhaseTemplate {
  order: number;
  name: string;
  goal: string;
  weight: number;
  difficulty: OutlineDifficulty;
  topicHints: string[];
}

export interface AllocatedPhase extends OutlinePhaseTemplate {
  dayCount: number;
  startDay: number;
  endDay: number;
}

const PHASE_TEMPLATES: Record<LearningType, OutlinePhaseTemplate[]> = {
  abstract_logic: [
    { order: 1, name: "基础定义与直觉", goal: "建立核心概念与直观理解", weight: 15, difficulty: "basic", topicHints: ["基本定义", "直观比喻", "简单例子"] },
    { order: 2, name: "核心概念深化", goal: "掌握关键概念及其关系", weight: 20, difficulty: "basic", topicHints: ["概念联系", "典型例题", "常见误区"] },
    { order: 3, name: "定理推导", goal: "逐步完成核心定理的推导", weight: 25, difficulty: "intermediate", topicHints: ["分步推导", "证明技巧", "推导练习"] },
    { order: 4, name: "综合应用", goal: "将理论应用于综合问题", weight: 25, difficulty: "intermediate", topicHints: ["综合题", "跨章节应用", "变式训练"] },
    { order: 5, name: "高级拓展", goal: "探索进阶主题与思想方法", weight: 15, difficulty: "advanced", topicHints: ["拓展定理", "思想方法", "开放问题"] },
  ],
  operation_logic: [
    { order: 1, name: "环境与基础语法", goal: "完成环境搭建并掌握基本语法", weight: 13, difficulty: "basic", topicHints: ["环境配置", "变量与类型", "控制流"] },
    { order: 2, name: "核心语法与结构", goal: "掌握函数、数据结构等核心语法", weight: 27, difficulty: "basic", topicHints: ["函数", "数据结构", "模块导入"] },
    { order: 3, name: "标准库与工具", goal: "熟悉常用库与开发工具", weight: 20, difficulty: "intermediate", topicHints: ["标准库", "调试", "测试入门"] },
    { order: 4, name: "小项目实战", goal: "通过小项目整合已学知识", weight: 20, difficulty: "intermediate", topicHints: ["迷你项目", "代码组织", "错误处理"] },
    { order: 5, name: "综合实战", goal: "完成贴近目标的综合练习", weight: 20, difficulty: "advanced", topicHints: ["综合项目", "最佳实践", "性能与优化"] },
  ],
  language: [
    { order: 1, name: "语音基础", goal: "掌握发音规则与语调", weight: 10, difficulty: "basic", topicHints: ["音标", "连读弱读", "语调"] },
    { order: 2, name: "核心词汇", goal: "积累高频与主题词汇", weight: 15, difficulty: "basic", topicHints: ["高频词", "主题词汇", "词根词缀"] },
    { order: 3, name: "语法体系", goal: "系统学习核心语法", weight: 20, difficulty: "intermediate", topicHints: ["时态", "从句", "句型"] },
    { order: 4, name: "场景听说", goal: "在真实场景中运用表达", weight: 25, difficulty: "intermediate", topicHints: ["日常对话", "职场表达", "旅行场景"] },
    { order: 5, name: "读写提升", goal: "提升阅读与写作能力", weight: 15, difficulty: "intermediate", topicHints: ["短文阅读", "邮件写作", "段落结构"] },
    { order: 6, name: "综合运用", goal: "流利表达与文化理解", weight: 15, difficulty: "advanced", topicHints: ["主题演讲", "文化理解", "综合对话"] },
  ],
  network_assoc: [
    { order: 1, name: "背景与基础", goal: "建立时代背景与基础概念", weight: 15, difficulty: "basic", topicHints: ["历史背景", "关键概念", "时间线起点"] },
    { order: 2, name: "核心叙事", goal: "理解核心事件与人物关系", weight: 35, difficulty: "intermediate", topicHints: ["关键事件", "人物动机", "因果链条"] },
    { order: 3, name: "深度分析", goal: "多视角分析原因与影响", weight: 30, difficulty: "intermediate", topicHints: ["深层原因", "多视角", "比较分析"] },
    { order: 4, name: "综合影响", goal: "评估长远影响与当代意义", weight: 20, difficulty: "advanced", topicHints: ["历史影响", "当代关联", "延伸思考"] },
  ],
  model_apply: [
    { order: 1, name: "基础模型", goal: "理解核心模型与假设", weight: 15, difficulty: "basic", topicHints: ["模型定义", "基本假设", "变量关系"] },
    { order: 2, name: "模型应用", goal: "将模型应用于标准案例", weight: 25, difficulty: "intermediate", topicHints: ["标准案例", "参数估计", "结果解读"] },
    { order: 3, name: "案例拆解", goal: "深度拆解复杂现实案例", weight: 25, difficulty: "intermediate", topicHints: ["案例拆解", "计算练习", "敏感性分析"] },
    { order: 4, name: "综合决策", goal: "运用模型支持综合决策", weight: 20, difficulty: "advanced", topicHints: ["决策框架", "多模型对比", "情景分析"] },
    { order: 5, name: "局限与前沿", goal: "认识模型局限与前沿发展", weight: 15, difficulty: "advanced", topicHints: ["模型局限", "修正方法", "前沿应用"] },
  ],
  perception: [
    { order: 1, name: "基础技法", goal: "掌握基本技法与工具", weight: 20, difficulty: "basic", topicHints: ["工具认知", "基础技法", "观察方法"] },
    { order: 2, name: "专项练习", goal: "针对单项技能刻意练习", weight: 30, difficulty: "intermediate", topicHints: ["专项训练", "模仿练习", "反馈改进"] },
    { order: 3, name: "模仿与拆解", goal: "拆解优秀作品并模仿", weight: 25, difficulty: "intermediate", topicHints: ["作品拆解", "风格分析", "模仿创作"] },
    { order: 4, name: "综合创作", goal: "完成个人风格化创作", weight: 25, difficulty: "advanced", topicHints: ["综合创作", "风格探索", "审美提升"] },
  ],
  practical: [
    { order: 1, name: "安全与基础", goal: "掌握安全须知与基础认知", weight: 20, difficulty: "basic", topicHints: ["安全规范", "工具材料", "基础认知"] },
    { order: 2, name: "标准流程", goal: "按标准流程分步操作", weight: 35, difficulty: "intermediate", topicHints: ["标准步骤", "操作要领", "常见失误"] },
    { order: 3, name: "关键技巧", goal: "掌握提升质量的关键技巧", weight: 25, difficulty: "intermediate", topicHints: ["技巧要点", "质量判断", "变式操作"] },
    { order: 4, name: "综合与应急", goal: "综合操作与应急处理", weight: 20, difficulty: "advanced", topicHints: ["综合操作", "应急处理", "熟练提升"] },
  ],
};

/** 按权重将 totalDays 分配到各阶段，保证总和精确且每阶段至少 1 天（当 totalDays >= 阶段数） */
export function distributeDays(totalDays: number, weights: number[]): number[] {
  if (totalDays <= 0 || weights.length === 0) return [];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (totalDays * w) / totalWeight);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = totalDays - floors.reduce((a, b) => a + b, 0);
  const fractions = raw.map((r, i) => ({ i, frac: r - floors[i] }));
  fractions.sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let j = 0; j < remainder; j++) {
    result[fractions[j % fractions.length].i]++;
  }
  if (totalDays >= weights.length) {
    for (let i = 0; i < result.length; i++) {
      if (result[i] === 0) {
        const maxIdx = result.indexOf(Math.max(...result));
        if (result[maxIdx] > 1) {
          result[maxIdx]--;
          result[i] = 1;
        }
      }
    }
  }
  return result;
}

/** 根据学习类型与总天数，生成带 dayRange 的阶段计划 */
export function allocatePhases(type: LearningType, totalDays: number): AllocatedPhase[] {
  const templates = PHASE_TEMPLATES[type] ?? PHASE_TEMPLATES.abstract_logic;
  const dayCounts = distributeDays(totalDays, templates.map((t) => t.weight));
  let dayCursor = 1;
  return templates.map((template, index) => {
    const dayCount = dayCounts[index] ?? 1;
    const startDay = dayCursor;
    const endDay = dayCursor + dayCount - 1;
    dayCursor = endDay + 1;
    return { ...template, dayCount, startDay, endDay };
  });
}

/** 生成用于 prompt 的阶段路线图描述 */
export function formatPhaseRoadmap(phases: AllocatedPhase[]): string {
  return phases
    .map(
      (p) =>
        `第${p.order}阶段「${p.name}」（第${p.startDay}-${p.endDay}天，共${p.dayCount}天，难度：${p.difficulty}）：${p.goal}\n  建议子主题方向：${p.topicHints.join("、")}`,
    )
    .join("\n");
}

/** 获取某 dayNumber 所属阶段 */
export function getPhaseForDay(phases: AllocatedPhase[], dayNumber: number): AllocatedPhase | undefined {
  return phases.find((p) => dayNumber >= p.startDay && dayNumber <= p.endDay);
}

export function getPhaseTemplates(type: LearningType): OutlinePhaseTemplate[] {
  return PHASE_TEMPLATES[type] ?? PHASE_TEMPLATES.abstract_logic;
}
