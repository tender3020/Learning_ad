import type { LearningType } from "./typeEngine";

export type OutlineDifficulty = "basic" | "intermediate" | "advanced";

export interface OutlinePhaseTemplate {
  order: number;
  name: string;
  goal: string;
  weight: number;
  difficulty: OutlineDifficulty;
  topicHints: string[];
  /** 该阶段每日 title 应长什么样 */
  outlineTitleGuide: string;
  /** 该阶段大纲禁止出现的主题类型 */
  outlineAvoid: string;
}

export interface AllocatedPhase extends OutlinePhaseTemplate {
  dayCount: number;
  startDay: number;
  endDay: number;
}

const PHASE_TEMPLATES: Record<LearningType, OutlinePhaseTemplate[]> = {
  abstract_logic: [
    { order: 1, name: "基础定义与直觉", goal: "建立核心概念与直观理解", weight: 15, difficulty: "basic", topicHints: ["基本定义", "直观比喻", "简单例子"],
      outlineTitleGuide: "核心概念/定义 + 直观理解点，如「极限的 ε-δ 定义」「向量点积的几何意义」",
      outlineAvoid: "长篇定理证明、综合压轴题、拓展定理" },
    { order: 2, name: "核心概念深化", goal: "掌握关键概念及其关系", weight: 20, difficulty: "basic", topicHints: ["概念联系", "典型例题", "常见误区"],
      outlineTitleGuide: "概念关系或典型基础题，如「矩阵秩与线性无关」「勾股定理的逆命题」",
      outlineAvoid: "完整推导证明、跨章节综合题" },
    { order: 3, name: "定理推导", goal: "逐步完成核心定理的推导", weight: 25, difficulty: "intermediate", topicHints: ["分步推导", "证明技巧", "推导练习"],
      outlineTitleGuide: "定理名称 + 推导/证明要点，如「拉格朗日中值定理的证明」「贝叶斯公式推导」",
      outlineAvoid: "仅从定义讲起、综合应用题" },
    { order: 4, name: "综合应用", goal: "将理论应用于综合问题", weight: 25, difficulty: "intermediate", topicHints: ["综合题", "跨章节应用", "变式训练"],
      outlineTitleGuide: "综合问题类型或应用场景，如「利用导数求极值综合题」「力学能量守恒综合应用」",
      outlineAvoid: "基础定义复述、单一定理证明" },
    { order: 5, name: "高级拓展", goal: "探索进阶主题与思想方法", weight: 15, difficulty: "advanced", topicHints: ["拓展定理", "思想方法", "开放问题"],
      outlineTitleGuide: "拓展定理/思想方法/开放问题，如「傅里叶级数初步」「反证法的典型运用」",
      outlineAvoid: "入门定义、基础计算题" },
  ],
  operation_logic: [
    { order: 1, name: "环境与基础语法", goal: "完成环境搭建并掌握基本语法", weight: 13, difficulty: "basic", topicHints: ["环境配置", "变量与类型", "控制流"],
      outlineTitleGuide: "环境/语法点，如「Python 环境配置」「if-else 与循环」",
      outlineAvoid: "项目实战、标准库高级用法、架构设计" },
    { order: 2, name: "核心语法与结构", goal: "掌握函数、数据结构等核心语法", weight: 27, difficulty: "basic", topicHints: ["函数", "数据结构", "模块导入"],
      outlineTitleGuide: "语法结构或数据类型，如「列表推导式」「函数参数与返回值」",
      outlineAvoid: "完整项目、调试工具链、性能优化" },
    { order: 3, name: "标准库与工具", goal: "熟悉常用库与开发工具", weight: 20, difficulty: "intermediate", topicHints: ["标准库", "调试", "测试入门"],
      outlineTitleGuide: "库/工具名 + 用途，如「json 模块读写」「pdb 断点调试」",
      outlineAvoid: "基础语法复述、大型综合项目" },
    { order: 4, name: "小项目实战", goal: "通过小项目整合已学知识", weight: 20, difficulty: "intermediate", topicHints: ["迷你项目", "代码组织", "错误处理"],
      outlineTitleGuide: "迷你功能/小模块，如「命令行待办清单」「文件批量重命名脚本」",
      outlineAvoid: "单一语法点、企业级架构" },
    { order: 5, name: "综合实战", goal: "完成贴近目标的综合练习", weight: 20, difficulty: "advanced", topicHints: ["综合项目", "最佳实践", "性能与优化"],
      outlineTitleGuide: "贴近学习目标的综合练习，如「爬虫数据采集小项目」「REST API 接口实战」",
      outlineAvoid: "基础语法、环境配置" },
  ],
  language: [
    { order: 1, name: "语音基础", goal: "掌握发音规则与语调", weight: 10, difficulty: "basic", topicHints: ["音标", "连读弱读", "语调"],
      outlineTitleGuide: "发音/语调规则，如「元音 /æ/ 与 /ʌ/ 辨析」「陈述句降调」",
      outlineAvoid: "长篇阅读、写作任务、复杂语法" },
    { order: 2, name: "核心词汇", goal: "积累高频与主题词汇", weight: 15, difficulty: "basic", topicHints: ["高频词", "主题词汇", "词根词缀"],
      outlineTitleGuide: "词汇主题域，如「商务会议高频词」「表因果的连接词」",
      outlineAvoid: "语法体系、完整对话场景" },
    { order: 3, name: "语法体系", goal: "系统学习核心语法", weight: 20, difficulty: "intermediate", topicHints: ["时态", "从句", "句型"],
      outlineTitleGuide: "语法点名称，如「现在完成时」「定语从句与关系代词」",
      outlineAvoid: "发音练习、长篇写作" },
    { order: 4, name: "场景听说", goal: "在真实场景中运用表达", weight: 25, difficulty: "intermediate", topicHints: ["日常对话", "职场表达", "旅行场景"],
      outlineTitleGuide: "具体场景 + 交际功能，如「机场入境与海关对话」「餐厅点餐常用表达」",
      outlineAvoid: "孤立词汇表、语法规则讲解" },
    { order: 5, name: "读写提升", goal: "提升阅读与写作能力", weight: 15, difficulty: "intermediate", topicHints: ["短文阅读", "邮件写作", "段落结构"],
      outlineTitleGuide: "阅读体裁或写作类型，如「新闻短文阅读技巧」「商务邮件开头与结尾」",
      outlineAvoid: "口语场景、基础发音" },
    { order: 6, name: "综合运用", goal: "流利表达与文化理解", weight: 15, difficulty: "advanced", topicHints: ["主题演讲", "文化理解", "综合对话"],
      outlineTitleGuide: "综合任务，如「3 分钟自我介绍演讲」「文化差异与得体表达」",
      outlineAvoid: "单一词汇、基础语法点" },
  ],
  network_assoc: [
    { order: 1, name: "背景与基础", goal: "建立时代背景与基础概念", weight: 15, difficulty: "basic", topicHints: ["历史背景", "关键概念", "时间线起点"],
      outlineTitleGuide: "背景/概念/时间线节点，如「工业革命前的英国社会」「封建制度核心特征」",
      outlineAvoid: "完整事件叙事、多视角深度分析" },
    { order: 2, name: "核心叙事", goal: "理解核心事件与人物关系", weight: 35, difficulty: "intermediate", topicHints: ["关键事件", "人物动机", "因果链条"],
      outlineTitleGuide: "事件/人物/关系，如「戊戌变法关键人物」「丝绸之路的兴起」",
      outlineAvoid: "纯背景介绍、当代影响评价" },
    { order: 3, name: "深度分析", goal: "多视角分析原因与影响", weight: 30, difficulty: "intermediate", topicHints: ["深层原因", "多视角", "比较分析"],
      outlineTitleGuide: "分析角度或比较命题，如「一战爆发的深层经济原因」「明治维新与洋务运动比较」",
      outlineAvoid: "基础事实罗列、单纯叙事" },
    { order: 4, name: "综合影响", goal: "评估长远影响与当代意义", weight: 20, difficulty: "advanced", topicHints: ["历史影响", "当代关联", "延伸思考"],
      outlineTitleGuide: "影响/意义/当代关联，如「法国大革命对现代政治的影响」「全球化下的文化认同」",
      outlineAvoid: "事件经过复述、基础概念定义" },
  ],
  model_apply: [
    { order: 1, name: "基础模型", goal: "理解核心模型与假设", weight: 15, difficulty: "basic", topicHints: ["模型定义", "基本假设", "变量关系"],
      outlineTitleGuide: "模型名 + 定义/假设/变量，如「供需模型：基本假设」「DCF 模型：现金流折现原理」",
      outlineAvoid: "完整案例拆解、综合决策、模型批判" },
    { order: 2, name: "模型应用", goal: "将模型应用于标准案例", weight: 25, difficulty: "intermediate", topicHints: ["标准案例", "参数估计", "结果解读"],
      outlineTitleGuide: "模型 + 标准应用场景，如「供需模型：价格管制分析」「波特五力：互联网行业应用」",
      outlineAvoid: "模型定义复述、复杂多变量案例、决策建议" },
    { order: 3, name: "案例拆解", goal: "深度拆解复杂现实案例", weight: 25, difficulty: "intermediate", topicHints: ["案例拆解", "计算练习", "敏感性分析"],
      outlineTitleGuide: "具体案例/事件 + 拆解角度，如「瑞幸咖啡财务模型拆解」「加息周期下的债券定价案例」",
      outlineAvoid: "模型基础定义、纯理论公式" },
    { order: 4, name: "综合决策", goal: "运用模型支持综合决策", weight: 20, difficulty: "advanced", topicHints: ["决策框架", "多模型对比", "情景分析"],
      outlineTitleGuide: "决策场景 + 模型运用，如「并购估值：DCF 与可比公司法」「扩张决策的情景分析」",
      outlineAvoid: "入门定义、单一参数计算" },
    { order: 5, name: "局限与前沿", goal: "认识模型局限与前沿发展", weight: 15, difficulty: "advanced", topicHints: ["模型局限", "修正方法", "前沿应用"],
      outlineTitleGuide: "局限/修正/前沿，如「CAPM 模型的实证局限」「行为金融对传统模型的修正」",
      outlineAvoid: "基础教学、标准案例套用" },
  ],
  perception: [
    { order: 1, name: "基础技法", goal: "掌握基本技法与工具", weight: 20, difficulty: "basic", topicHints: ["工具认知", "基础技法", "观察方法"],
      outlineTitleGuide: "工具/基础技法，如「铅笔排线基础」「相机光圈与快门」",
      outlineAvoid: "综合创作、大师作品深度拆解" },
    { order: 2, name: "专项练习", goal: "针对单项技能刻意练习", weight: 30, difficulty: "intermediate", topicHints: ["专项训练", "模仿练习", "反馈改进"],
      outlineTitleGuide: "专项练习名，如「三点透视建筑练习」「色彩冷暖对比训练」",
      outlineAvoid: "工具介绍、完整作品创作" },
    { order: 3, name: "模仿与拆解", goal: "拆解优秀作品并模仿", weight: 25, difficulty: "intermediate", topicHints: ["作品拆解", "风格分析", "模仿创作"],
      outlineTitleGuide: "作品/风格 + 拆解维度，如「莫奈光影技法拆解」「短视频叙事节奏模仿」",
      outlineAvoid: "基础工具认知、自由创作" },
    { order: 4, name: "综合创作", goal: "完成个人风格化创作", weight: 25, difficulty: "advanced", topicHints: ["综合创作", "风格探索", "审美提升"],
      outlineTitleGuide: "创作任务/主题，如「静物素描综合创作」「个人摄影系列策划」",
      outlineAvoid: "单一基础技法、工具介绍" },
  ],
  practical: [
    { order: 1, name: "安全与基础", goal: "掌握安全须知与基础认知", weight: 20, difficulty: "basic", topicHints: ["安全规范", "工具材料", "基础认知"],
      outlineTitleGuide: "安全规则/工具认知，如「厨房刀具安全规范」「急救包物品识别」",
      outlineAvoid: "完整操作流程、应急处理" },
    { order: 2, name: "标准流程", goal: "按标准流程分步操作", weight: 35, difficulty: "intermediate", topicHints: ["标准步骤", "操作要领", "常见失误"],
      outlineTitleGuide: "流程/步骤名，如「手冲咖啡标准流程」「心肺复苏标准步骤」",
      outlineAvoid: "纯安全常识、高级技巧变式" },
    { order: 3, name: "关键技巧", goal: "掌握提升质量的关键技巧", weight: 25, difficulty: "intermediate", topicHints: ["技巧要点", "质量判断", "变式操作"],
      outlineTitleGuide: "技巧/质量要点，如「面团揉制筋度判断」「焊接接头质量检验」",
      outlineAvoid: "安全入门、完整流程复述" },
    { order: 4, name: "综合与应急", goal: "综合操作与应急处理", weight: 20, difficulty: "advanced", topicHints: ["综合操作", "应急处理", "熟练提升"],
      outlineTitleGuide: "综合任务/应急情景，如「完整三道菜联做」「断电应急处置」",
      outlineAvoid: "基础安全介绍、单步操作" },
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

/**
 * 生成大纲专用的分阶段综合规划指引。
 * 一次性生成全部天数前，AI 须按此逐阶段评估并分配每日 title/obj。
 */
export function formatPhaseOutlineGuide(phases: AllocatedPhase[]): string {
  const totalDays = phases.at(-1)?.endDay ?? 0;
  const header = `【分阶段大纲规划 · 生成前必须通读】
生成全部 ${totalDays} 天大纲时，请按以下阶段逐段综合评估并规划（一次输出全部天数，但须先通读各阶段约束再分配每日主题）：
- 第 d 天的 title/obj 只能属于 d 所在阶段，严禁跨阶段主题
- 每个阶段内各天应覆盖该阶段建议方向，相邻天递进、不重复
- 阶段切换时：下一阶段第 1 天必须承接上一阶段最后一天的认知`;

  const blocks = phases.map((p) => {
    const dayList =
      p.dayCount <= 6
        ? Array.from({ length: p.dayCount }, (_, i) => `第${p.startDay + i}天`).join("、")
        : `第${p.startDay}-${p.endDay}天（共${p.dayCount}天）`;
    const hintSpread =
      p.dayCount <= p.topicHints.length
        ? `建议每天对应一个方向：${p.topicHints.slice(0, p.dayCount).map((h, i) => `第${p.startDay + i}天→${h}`).join("；")}`
        : `在 ${p.topicHints.join("、")} 等方向中轮换展开，共 ${p.dayCount} 天互不重复`;

    return `▸ 第${p.order}阶段「${p.name}」${dayList}
  阶段目标：${p.goal}
  每日标题应：${p.outlineTitleGuide}
  本阶段禁止：${p.outlineAvoid}
  ${hintSpread}`;
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}

/** 获取某 dayNumber 所属阶段 */
export function getPhaseForDay(phases: AllocatedPhase[], dayNumber: number): AllocatedPhase | undefined {
  return phases.find((p) => dayNumber >= p.startDay && dayNumber <= p.endDay);
}

export function getPhaseTemplates(type: LearningType): OutlinePhaseTemplate[] {
  return PHASE_TEMPLATES[type] ?? PHASE_TEMPLATES.abstract_logic;
}
