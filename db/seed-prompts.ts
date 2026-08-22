import "dotenv/config";
import { createPool } from "mysql2/promise";
import { PHASE_CONTENT_SEEDS, PHASE_COUNT_BY_TYPE } from "./seed-content-phases";

/**
 * 种子脚本：学习类型 + Prompt 片段 + 模板组装 初始数据
 * 数据来源：shared/typeEngine.ts 现有 Prompt，拆解为「公共片段 + 类型片段」
 * 变量约定：{{goal}} {{totalDays}} {{skillLevel}} {{levelHint}} {{roadmap}} 等，运行时替换
 * 运行：npx tsx db/seed-prompts.ts（幂等，可重复运行）
 */

const TYPES = [
  { key: "abstract_logic", name: "抽象逻辑型", icon: "🔢", color: "#A78BFA", sort: 1,
    desc: "数学/物理/统计等需推导的纯理论",
    keywords: ["数学", "物理", "统计", "推导", "证明", "公式", "定理"] },
  { key: "operation_logic", name: "操作逻辑型", icon: "💻", color: "#0A84FF", sort: 2,
    desc: "编程/软件/工具等需动手操作的内容",
    keywords: ["编程", "代码", "软件", "命令行", "Python", "JavaScript", "开发"] },
  { key: "language", name: "语言学习型", icon: "🗣️", color: "#34C759", sort: 3,
    desc: "英语/日语等自然语言的综合学习",
    keywords: ["英语", "日语", "词汇", "口语", "语法", "托福", "雅思"] },
  { key: "network_assoc", name: "网络关联型", icon: "🕸️", color: "#FF9500", sort: 4,
    desc: "历史/法律/政治等叙事因果关联型",
    keywords: ["历史", "地理", "法律", "政治", "文学", "事件", "人物"] },
  { key: "model_apply", name: "模型应用型", icon: "📊", color: "#6E56CF", sort: 5,
    desc: "金融/经济/管理等模型套用现实",
    keywords: ["经济", "金融", "管理", "营销", "模型", "商业", "投资"] },
  { key: "perception", name: "感知表达型", icon: "🎨", color: "#FF69B4", sort: 6,
    desc: "绘画/摄影/写作等审美创作型",
    keywords: ["绘画", "摄影", "写作", "设计", "创作", "审美"] },
  { key: "practical", name: "实践技艺型", icon: "🔧", color: "#5AC8FA", sort: 7,
    desc: "烹饪/驾驶/急救等安全操作流程",
    keywords: ["烹饪", "驾驶", "急救", "运动", "操作", "安全"] },
];

const DEFAULT_PHASE_STRATEGY = {
  phases: [
    { name: "基础入门", ratio: 0.3, difficulty: "basic" },
    { name: "核心进阶", ratio: 0.4, difficulty: "intermediate" },
    { name: "综合应用", ratio: 0.3, difficulty: "advanced" },
  ],
};

// ============================================================================
// Prompt 片段定义
// ============================================================================

type ComponentSeed = {
  key: string;
  category: "role" | "rule" | "constraint" | "format" | "example" | "context";
  scope: "common" | "type" | "purpose";
  typeKey?: string;
  purpose?: "detect" | "assessment" | "outline" | "content" | "qa";
  title: string;
  content: string;
  variables?: string[];
};

const COMMON_COMPONENTS: ComponentSeed[] = [
  {
    key: "common:content:section_format",
    category: "format",
    scope: "common",
    purpose: "content",
    title: "章节 Markdown 结构（二级标题 = 目录项）",
    content: `【章节结构 · 必须遵守】
阅读页「本章目录」从 Markdown 二级标题（##）解析，因此：

1. 上方「本阶段内容结构」中的每一条（1. 2. 3. …）必须单独输出为一个 ## 二级标题章节
2. 标题用简明中文（如「认知缺口开场」「今日核心定义」「今日小结」），不要用「1.」「2.」编号作标题
3. 禁止用单个 ## 包裹全文；禁止只用 # 一级标题；不要用 ### 代替应出现的 ##
4. 每个 ## 标题下写该节正文，章节之间空一行；子小节可用 ###
5. 全文至少输出 4 个 ## 章节（与结构条目一一对应，可含「今日小结」）`,
  },
  {
    key: "common:content:constraints",
    category: "rule",
    scope: "common",
    purpose: "content",
    title: "内容生成通用约束（禁字数提示/公式格式/配图标记）",
    content: `【绝对禁止 - 必须遵守】
1. 标题中禁止出现"200字以上""150字""300字"等字数提示文字
2. 标题中禁止出现英文"Quiz"，练习部分直接用"练习题"即可
3. 禁止输出任何本提示词中的格式标记、字数要求等指令性文字
4. 只输出纯学习内容，不要让用户看到任何系统指令痕迹

【公式格式要求 - 必须遵守】
- 行内公式（短公式）：用 $...$ 包裹，如 $E = mc^2$
- 块级公式（独立显示的公式）：用 $$...$$ 包裹
- 禁止用 \\[...\\] 或 \\(...\\) 或普通方括号 [ ... ] 包裹公式
- 禁止在公式外额外加普通方括号 [ ]

【配图意图标记 - 必须遵守】
在 2-3 个最适合配图的章节末尾，各插入一行 HTML 注释（用户不可见，必须原样保留）：
<!-- illustration: {"anchor":"正文中的完整句子20-40字","intent":"该段核心画面一句话","medium":"wanxiang或mermaid"} -->
- anchor 必须是该章节正文中的完整句子，与 Markdown 完全一致
- medium 为 wanxiang（场景插画）或 mermaid（概念/流程图）；抽象推导、代码流程用 mermaid，生活场景/对话/操作画面用 wanxiang
- 每个关键章节最多 1 条，全文共 2-3 条`,
  },
  {
    key: "common:content:mermaid",
    category: "rule",
    scope: "common",
    purpose: "content",
    title: "Mermaid 语法要求",
    content: `【Mermaid 语法要求】
在推导/概念/流程相关章节内，用标准 \`\`\`mermaid 代码块输出 flowchart 或 graph：
- 第一行必须是 flowchart TD 或 graph LR（或 sequenceDiagram）
- 含括号、冒号、斜杠的节点文字必须用双引号包裹，如 A["勾股定理"]
- 不要使用 HTML 标签`,
  },
  {
    key: "common:content:quiz_format",
    category: "format",
    scope: "common",
    purpose: "content",
    title: "内嵌练习题 HTML 注释格式",
    content: `【以下HTML注释格式是内容的一部分，必须原样输出到内容中】练习题使用以下格式嵌入（注意：<!-- 和 --> 是格式标记，必须保留）：
<!-- quiz
question: ...
A: ...
B: ...
C: ...
D: ...
correct: A
explanation: ...
-->

要求：Markdown格式输出。在内容末尾自然地嵌入3-5道选择题`,
  },
  {
    key: "common:assessment:domain_lock",
    category: "rule",
    scope: "common",
    purpose: "assessment",
    title: "评估题领域锁定",
    variables: ["goal"],
    content: `【领域锁定 · 最高优先级】
学习目标：「{{goal}}」
1. 5 道题必须直接考查该目标的具体知识（术语、步骤、公式、史实、技法、代码行为、模型结论等）
2. 禁止元问题：如何学习、学习态度、遇到困难怎么办、要不要理论结合实践
3. 禁止跑题到其他学科；下面的类型只约束出题形式，不改变考查领域
4. 每个选项都应是该领域内的合理干扰项，不能是玩笑或正确废话`,
  },
  {
    key: "common:assessment:length",
    category: "constraint",
    scope: "common",
    purpose: "assessment",
    title: "评估题篇幅约束",
    content: `【篇幅约束 · 加快生成】
- 每题题干不超过 40 字（代码题另行限制）
- 每个选项不超过 20 字
- explanation 只写一句考点，不要逐项分析错误选项`,
  },
  {
    key: "common:assessment:format",
    category: "format",
    scope: "common",
    purpose: "assessment",
    title: "评估题 JSON 输出格式",
    content: `【输出格式】只返回 JSON 对象，不要输出任何其他文字：
{"q":[{"i":1,"q":"题干","a":"选项A","b":"选项B","c":"选项C","d":"选项D","ans":"A","e":"一句考点","lv":"basic"}]}

规则：
- 必须恰好 5 道题
- lv 依次为 basic, basic, intermediate, advanced, expert
- ans 只能是 A/B/C/D 之一`,
  },
  {
    key: "common:outline:phase_planning",
    category: "rule",
    scope: "common",
    purpose: "outline",
    title: "分阶段大纲综合规划",
    variables: ["phaseOutlineGuide"],
    content: `{{phaseOutlineGuide}}`,
  },
  {
    key: "common:outline:title_rules",
    category: "rule",
    scope: "common",
    purpose: "outline",
    title: "大纲标题与递进规则",
    variables: ["goal"],
    content: `【标题要求】（必须遵守）
1. 每天的 title 必须是其所在阶段内的具体子主题，且必须属于「{{goal}}」
2. 生成前须对照上方「分阶段大纲规划」，确认第 d 天落在正确阶段且符合该阶段「每日标题应/禁止」
3. 相邻两天标题不能重复、不能相似
4. 禁止写成笼统表述（如「第1天学习」「继续学习」「基础词汇2」）
5. 每天需设置可测量的 obj（learningObjective），不超过 20 字

【知识递进 · 必须严密】
1. 第 N 天必须建立在第 N-1 天已铺垫的概念之上，禁止跳到尚未引入的高级主题
2. 阶段衔接：下一阶段第 1 天是上一阶段最后一天的直接延伸，不要另起炉灶换学科
3. 按学习者水平控制起点：零基础从最基本定义/操作开始，进阶水平可跳过入门重复`,
  },
  {
    key: "common:outline:format",
    category: "format",
    scope: "common",
    purpose: "outline",
    title: "大纲 JSON 输出格式",
    variables: ["totalDays"],
    content: `【输出格式】只返回 JSON 对象，不要输出任何其他文字：
{"o":[{"d":1,"t":"具体主题","obj":"可测量目标","k":"词1, 词2"}]}

规则：
- o 恰好 {{totalDays}} 条；d 从 1 到 {{totalDays}}
- t/obj/k 尽量短；keywords 最多 3 个词
- 不要输出 phaseName、phaseOrder、difficulty、estimatedMinutes（服务端会补齐）`,
  },
  {
    key: "detect:main",
    category: "rule",
    scope: "purpose",
    purpose: "detect",
    title: "学习类型判定规则",
    variables: ["goal"],
    content: `你是一个学习内容分类引擎。请判断以下用户输入属于哪种学习类型，只输出类型编号(1-7)和一句话理由。

类型定义：
- 1=抽象逻辑型：数学、理论物理、统计学等需要纸笔推导的纯理论
- 2=操作逻辑型：编程、软件操作、命令行等需要在电脑上动手运行的内容
- 3=语言学习型：任何自然语言的学习(英语、日语等)
- 4=网络关联型：历史、地理、法律、政治、文学等以叙事和因果关联为主的内容
- 5=模型应用型：经济学、金融、管理学、营销等以模型套用现实案例为主的内容
- 6=感知表达型：绘画、摄影、写作、设计等以审美和创作为主的内容
- 7=实践技艺型：烹饪、驾驶、急救、运动等以完成安全操作流程为主的内容

判定优先级：
- 含"代码/编程/软件/命令行"等词 → 优先判为2
- 含"推导/证明/公式/定理"且不涉及编程 → 优先判为1
- 自然语言学习 → 直接判为3
- 涉及物理操作且强调安全 → 优先判为7
- 核心是审美和创作 → 判为6
- 核心是用模型分析现实 → 判为5
- 核心是叙事和因果 → 判为4

用户输入：{{goal}}

输出格式（严格，只输出一行，不要复述类型列表）：
编号|类型英文名|一句话理由
示例：2|operation_logic|目标含编程实践，需在电脑上动手运行
类型英文名只能是：abstract_logic / operation_logic / language / network_assoc / model_apply / perception / practical`,
  },
  {
    key: "qa:main",
    category: "rule",
    scope: "purpose",
    purpose: "qa",
    title: "每日问答导师规则",
    variables: ["planGoal", "dayNumber", "dayTitle", "dayGoal", "typeLabel", "markdownContent"],
    content: `你是一位耐心的 AI 学习导师，正在辅导学习者完成今日课程。

【学习定位】
- 整体目标：{{planGoal}}
- 当前进度：第 {{dayNumber}} 天
- 今日主题：{{dayTitle}}
- 今日目标：{{dayGoal}}
- 学习类型：{{typeLabel}}

【今日学习材料 — 回答必须以此为准】
{{markdownContent}}

【回答规则】
1. 所有回答必须优先基于【今日学习材料】，引用材料中的概念、例题、步骤进行讲解
2. 若问题超出材料范围，先说明「今日材料中未涉及」，再简要补充，并建议回到材料中的相关章节
3. 结合对话历史理解「这个」「刚才那个」「再解释一下」等指代
4. 采用引导式教学：先定位到材料中的相关部分，再分步解释，必要时举例
5. 用清晰、完整的中文回答，可以使用 Markdown 格式（公式用 $...$ 或 $$...$$）`,
  },
];

// ---- 评估题：7 类专属片段（角色 + 难度梯度 + 出题形式） ----
const ASSESSMENT_COMPONENTS: ComponentSeed[] = [
  {
    key: "type:assessment:abstract_logic",
    category: "rule", scope: "type", typeKey: "abstract_logic", purpose: "assessment",
    title: "抽象逻辑型评估出题规则",
    variables: ["goal"],
    content: `你是一位数学/物理评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础概念题，检验最基本的定义理解
- 第2题(basic)：基础应用题，检验简单公式使用
- 第3题(intermediate)：进阶题，检验对定理的理解和推导能力
- 第4题(advanced)：高级题，检验综合运用多个概念的能力
- 第5题(expert)：专家级题，检验深入理解和创新应用能力

每道题需要是计算/推导类题目，选项应该是不同的答案/结论。公式用 $...$，不要写出完整推导过程。
类型篇幅约束：公式用 $...$，不要写证明步骤；选项给结论或数值。`,
  },
  {
    key: "type:assessment:operation_logic",
    category: "rule", scope: "type", typeKey: "operation_logic", purpose: "assessment",
    title: "操作逻辑型评估出题规则",
    variables: ["goal"],
    content: `你是一位编程技术评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础语法题，检验最基本的语法知识
- 第2题(basic)：简单编程逻辑题，检验基本逻辑思维
- 第3题(intermediate)：进阶题，检验对核心概念的理解
- 第4题(advanced)：高级题，检验综合运用多个知识点的能力
- 第5题(expert)：专家级题，检验对底层原理的理解

每道题应该是代码阅读/程序输出类题目，选项写输出结果或行为。代码不超过 5 行，不要贴完整程序。
类型篇幅约束：代码最多 5 行；选项只写运行结果或行为，不要再贴代码。`,
  },
  {
    key: "type:assessment:language",
    category: "rule", scope: "type", typeKey: "language", purpose: "assessment",
    title: "语言学习型评估出题规则",
    variables: ["goal"],
    content: `你是一位语言评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础词汇题，检验最基本的单词/短语理解
- 第2题(basic)：基础语法题，检验基本句型结构
- 第3题(intermediate)：进阶题，检验语法和词汇的综合运用
- 第4题(advanced)：高级题，检验对语境和文化差异的理解
- 第5题(expert)：专家级题，检验地道的表达和高级语法

每道题应该是一词/一句/短对话的填空或辨析，不要出长阅读。
类型篇幅约束：一句对话或一个空，不要短文阅读。`,
  },
  {
    key: "type:assessment:network_assoc",
    category: "rule", scope: "type", typeKey: "network_assoc", purpose: "assessment",
    title: "网络关联型评估出题规则",
    variables: ["goal"],
    content: `你是一位综合知识评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础事实题，检验最基本的历史/文化常识
- 第2题(basic)：基础关系题，检验简单的因果关联
- 第3题(intermediate)：进阶题，检验对复杂因果链的理解
- 第4题(advanced)：高级题，检验多视角分析和比较能力
- 第5题(expert)：专家级题，检验深度理解和批判性思维

每道题一问一事实或一层因果，不要附长材料。
类型篇幅约束：一问一事实，不要背景长文。`,
  },
  {
    key: "type:assessment:model_apply",
    category: "rule", scope: "type", typeKey: "model_apply", purpose: "assessment",
    title: "模型应用型评估出题规则",
    variables: ["goal"],
    content: `你是一位商业分析评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础概念题，检验最基本的模型定义
- 第2题(basic)：简单应用题，检验基础套用能力
- 第3题(intermediate)：进阶题，检验对模型假设的理解
- 第4题(advanced)：高级题，检验综合分析能力
- 第5题(expert)：专家级题，检验模型创新和批判能力

每道题给关键数字或模型名 + 结论选项，不要写完整案例故事。
类型篇幅约束：给模型名和关键数字，不要完整案例故事。`,
  },
  {
    key: "type:assessment:perception",
    category: "rule", scope: "type", typeKey: "perception", purpose: "assessment",
    title: "感知表达型评估出题规则",
    variables: ["goal"],
    content: `你是一位艺术创作评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础概念题，检验最基本的术语和工具认知
- 第2题(basic)：基础审美题，检验基本的审美判断
- 第3题(intermediate)：进阶题，检验对技法原理的理解
- 第4题(advanced)：高级题，检验综合创作能力
- 第5题(expert)：专家级题，检验深度理解和创新表达

每道题考查一个术语、技法或判断，不要描述整幅作品。
类型篇幅约束：问术语或对错判断，不要描述整件作品。`,
  },
  {
    key: "type:assessment:practical",
    category: "rule", scope: "type", typeKey: "practical", purpose: "assessment",
    title: "实践技艺型评估出题规则",
    variables: ["goal"],
    content: `你是一位实操技能评估专家。请为「{{goal}}」设计5道能力评估测试题。

难度梯度要求：
- 第1题(basic)：基础安全题，检验最基本的安全常识
- 第2题(basic)：基础流程题，检验基本操作步骤
- 第3题(intermediate)：进阶题，检验对关键技巧的掌握
- 第4题(advanced)：高级题，检验应急处理和问题解决能力
- 第5题(expert)：专家级题，检验综合判断和创新方法

每道题是一步安全或操作决策，不要列出完整流程。
类型篇幅约束：问某一步是否安全/该怎么做，不要列全流程。`,
  },
];

// ---- 大纲：7 类专属片段 ----
const OUTLINE_COMPONENTS: ComponentSeed[] = [
  { key: "type:outline:abstract_logic", category: "rule", scope: "type", typeKey: "abstract_logic", purpose: "outline",
    title: "抽象逻辑型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【抽象逻辑型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出一个具体定理/概念名作为 title，不要在大纲里写推导过程。` },
  { key: "type:outline:operation_logic", category: "rule", scope: "type", typeKey: "operation_logic", purpose: "outline",
    title: "操作逻辑型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【操作逻辑型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出一个语法点或小功能名作为 title，大纲里禁止写代码。` },
  { key: "type:outline:language", category: "rule", scope: "type", typeKey: "language", purpose: "outline",
    title: "语言学习型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【语言学习型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

正确示例："机场入境与海关对话""定语从句与关系代词""餐厅点餐常用表达"` },
  { key: "type:outline:network_assoc", category: "rule", scope: "type", typeKey: "network_assoc", purpose: "outline",
    title: "网络关联型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【网络关联型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出一个事件、人物关系或制度名作为 title，不要写长叙事。` },
  { key: "type:outline:model_apply", category: "rule", scope: "type", typeKey: "model_apply", purpose: "outline",
    title: "模型应用型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【模型应用型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出「模型名+该阶段侧重点」作为 title，不要写完整案例。` },
  { key: "type:outline:perception", category: "rule", scope: "type", typeKey: "perception", purpose: "outline",
    title: "感知表达型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【感知表达型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出一个技法或练习名作为 title，不要写示范步骤。` },
  { key: "type:outline:practical", category: "rule", scope: "type", typeKey: "practical", purpose: "outline",
    title: "实践技艺型大纲规则", variables: ["goal", "totalDays", "skillLevel", "levelHint"],
    content: `为「{{goal}}」制定{{totalDays}}天的大纲。学习者水平：{{skillLevel}}（{{levelHint}}）。
这是【实践技艺型】内容。请严格遵循上方分阶段规划，每天 title 落在对应阶段范围内。

每天只输出一个操作步骤名作为 title，不要写完整流程。` },
];

// ---- 每日内容：7 类通用底座（阶段结构见 seed-content-phases.ts） ----
const PHASE_VARS = ["skillLevel", "levelHint", "phaseName", "phaseGoal", "phaseHints"] as const;

function contentBase(
  typeKey: string,
  title: string,
  mentorLine: string,
  typeLabel: string,
  advice: string,
  extra = "",
): ComponentSeed {
  return {
    key: `type:content:${typeKey}`,
    category: "rule",
    scope: "type",
    typeKey,
    purpose: "content",
    title,
    variables: [...PHASE_VARS],
    content: `${mentorLine}学习者水平：{{skillLevel}}（{{levelHint}}）。

【${typeLabel} - 通用要求】
${advice}

【当前阶段】{{phaseName}}
【阶段目标】{{phaseGoal}}
【本子主题方向】{{phaseHints}}

今日内容必须紧扣当前阶段目标，严格执行下方「本阶段内容结构」；禁止混入其他阶段的典型章节。${extra}`,
  };
}

const CONTENT_COMPONENTS: ComponentSeed[] = [
  contentBase(
    "abstract_logic",
    "抽象逻辑型内容生成规范（通用底座）",
    "你是一位优秀的数学/物理导师。",
    "抽象逻辑型",
    "学习建议：需用纸笔逐步推导，不能只用眼看。请准备好草稿纸，跟着过程自己写一遍。",
    "\n涉及推导/概念关系时，可在相关章节输出 \\`\\`\\`mermaid 代码块。",
  ),
  contentBase(
    "operation_logic",
    "操作逻辑型内容生成规范（通用底座）",
    "你是一位优秀的编程/技术导师。",
    "操作逻辑型",
    "学习建议：打开编辑器/终端，边看边敲。运行成功才算真正掌握。",
    "\n代码流程相关章节可输出 \\`\\`\\`mermaid 代码块。",
  ),
  contentBase(
    "language",
    "语言学习型内容生成规范（通用底座）",
    "你是一位优秀的语言教师。",
    "语言学习型",
    "学习建议：大声跟读所有例句，最好录音对比原音或标准发音。",
    "\n要求：例句地道自然，Markdown 格式输出。",
  ),
  contentBase(
    "network_assoc",
    "网络关联型内容生成规范（通用底座）",
    "你是一位优秀的叙事型导师。",
    "网络关联型",
    "学习建议：重点是建立因果链，不是背时间地点。读完用自己的话复述，检查逻辑是否通顺。",
    "\n要求：叙事生动有画面感；深度分析阶段可用 \\`\\`\\`mermaid 画因果网络。",
  ),
  contentBase(
    "model_apply",
    "模型应用型内容生成规范（通用底座）",
    "你是一位优秀的商业分析导师。",
    "模型应用型",
    "学习建议：模型是分析工具，学完立刻找现实案例套用。会解释新闻才算真学会。",
    "\n要求：案例贴近现实，Markdown 格式输出。",
  ),
  contentBase(
    "perception",
    "感知表达型内容生成规范（通用底座）",
    "你是一位优秀的艺术创作导师。",
    "感知表达型",
    "学习建议：不要光看，马上动手。今天目标是「完成」而不是「完美」。",
    "\n要求：强调动手产出，Markdown 格式输出。",
  ),
  contentBase(
    "practical",
    "实践技艺型内容生成规范（通用底座）",
    "你是一位优秀的实操技能导师。",
    "实践技艺型",
    "学习建议：安全第一。先完整看一遍全部步骤，想清楚了再动手，绝不跳步。",
    "\n要求：强调安全规范，步骤不可跳，Markdown 格式输出。",
  ),
];

const PHASE_CONTENT_COMPONENTS: ComponentSeed[] = PHASE_CONTENT_SEEDS.map((s) => ({
  key: s.key,
  category: "rule" as const,
  scope: "type" as const,
  typeKey: s.typeKey,
  purpose: "content" as const,
  title: s.title,
  content: s.content,
}));

const ALL_COMPONENTS = [
  ...COMMON_COMPONENTS,
  ...ASSESSMENT_COMPONENTS,
  ...OUTLINE_COMPONENTS,
  ...CONTENT_COMPONENTS,
  ...PHASE_CONTENT_COMPONENTS,
];

// ============================================================================
// 模板组装定义
// ============================================================================

type TemplateSeed = {
  key: string;
  typeKey?: string;
  purpose: "detect" | "assessment" | "outline" | "content" | "qa";
  name: string;
  description?: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "json_object" | "text" | "stream";
  items: Array<{ componentKey: string; slot: "system" | "user"; sort: number }>;
};

function buildContentTemplateItems(typeKey: string): TemplateSeed["items"] {
  const phaseCount = PHASE_COUNT_BY_TYPE[typeKey] ?? 0;
  const items: TemplateSeed["items"] = [
    { componentKey: `type:content:${typeKey}`, slot: "system", sort: 1 },
  ];

  for (let i = 1; i <= phaseCount; i++) {
    items.push({
      componentKey: `phase:content:${typeKey}:${i}`,
      slot: "system",
      sort: 1 + i,
    });
  }

  const tailBase = 2 + phaseCount;
  items.push(
    { componentKey: "common:content:section_format", slot: "system", sort: tailBase },
    { componentKey: "common:content:constraints", slot: "system", sort: tailBase + 1 },
    ...(typeKey === "abstract_logic" || typeKey === "operation_logic"
      ? [{ componentKey: "common:content:mermaid", slot: "system" as const, sort: tailBase + 2 }]
      : []),
    {
      componentKey: "common:content:quiz_format",
      slot: "system",
      sort: tailBase + (typeKey === "abstract_logic" || typeKey === "operation_logic" ? 3 : 2),
    },
  );

  return items;
}

const TYPE_KEYS = TYPES.map((t) => t.key);

const TEMPLATES: TemplateSeed[] = [
  {
    key: "detect:main",
    purpose: "detect",
    name: "学习类型判定",
    temperature: 0.2,
    maxTokens: 120,
    responseFormat: "text",
    items: [
      { componentKey: "detect:main", slot: "system", sort: 1 },
    ],
  },
  {
    key: "qa:day",
    purpose: "qa",
    name: "每日学习问答",
    temperature: 0.7,
    maxTokens: 4000,
    responseFormat: "stream",
    items: [
      { componentKey: "qa:main", slot: "system", sort: 1 },
    ],
  },
  // 评估题模板 × 7
  ...TYPE_KEYS.map((typeKey): TemplateSeed => ({
    key: `assessment:${typeKey}`,
    typeKey,
    purpose: "assessment",
    name: `${TYPES.find((t) => t.key === typeKey)?.name}-评估题生成`,
    temperature: 0.2,
    maxTokens: typeKey === "operation_logic" ? 1800 : 1200,
    responseFormat: "json_object",
    items: [
      { componentKey: "common:assessment:domain_lock", slot: "system", sort: 1 },
      { componentKey: `type:assessment:${typeKey}`, slot: "system", sort: 2 },
      { componentKey: "common:assessment:length", slot: "system", sort: 3 },
      { componentKey: "common:assessment:format", slot: "system", sort: 4 },
    ],
  })),
  // 大纲模板 × 7
  ...TYPE_KEYS.map((typeKey): TemplateSeed => ({
    key: `outline:${typeKey}`,
    typeKey,
    purpose: "outline",
    name: `${TYPES.find((t) => t.key === typeKey)?.name}-大纲生成`,
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json_object",
    items: [
      { componentKey: `type:outline:${typeKey}`, slot: "system", sort: 1 },
      { componentKey: "common:outline:phase_planning", slot: "system", sort: 2 },
      { componentKey: "common:outline:title_rules", slot: "system", sort: 3 },
      { componentKey: "common:outline:format", slot: "system", sort: 4 },
    ],
  })),
  // 每日内容模板 × 7（mermaid 提示仅抽象逻辑/操作逻辑需要）
  ...TYPE_KEYS.map((typeKey): TemplateSeed => ({
    key: `content:${typeKey}`,
    typeKey,
    purpose: "content",
    name: `${TYPES.find((t) => t.key === typeKey)?.name}-每日内容生成`,
    temperature: 0.7,
    maxTokens: 8192,
    responseFormat: "stream",
    items: buildContentTemplateItems(typeKey),
  })),
];

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = createPool(connectionString);

  try {
    // 1. 学习类型
    for (const t of TYPES) {
      await pool.execute(
        `INSERT INTO learning_types (type_key, name, description, icon, color, detect_keywords, phase_strategy, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
           icon=VALUES(icon), color=VALUES(color), detect_keywords=VALUES(detect_keywords),
           phase_strategy=VALUES(phase_strategy), sort_order=VALUES(sort_order)`,
        [t.key, t.name, t.desc, t.icon, t.color, JSON.stringify(t.keywords), JSON.stringify(DEFAULT_PHASE_STRATEGY), t.sort],
      );
    }
    console.log(`✅ learning_types: ${TYPES.length} rows`);

    // 2. Prompt 片段
    for (const c of ALL_COMPONENTS) {
      await pool.execute(
        `INSERT INTO prompt_components (component_key, category, scope, type_key, purpose, title, content, variables)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE category=VALUES(category), scope=VALUES(scope),
           type_key=VALUES(type_key), purpose=VALUES(purpose), title=VALUES(title),
           content=VALUES(content), variables=VALUES(variables)`,
        [c.key, c.category, c.scope, c.typeKey ?? null, c.purpose ?? null, c.title, c.content, c.variables ? JSON.stringify(c.variables) : null],
      );
    }
    console.log(`✅ prompt_components: ${ALL_COMPONENTS.length} rows`);

    // 3. 模板
    for (const t of TEMPLATES) {
      await pool.execute(
        `INSERT INTO prompt_templates (template_key, type_key, purpose, name, description, temperature, max_tokens, response_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type_key=VALUES(type_key), name=VALUES(name),
           description=VALUES(description), temperature=VALUES(temperature),
           max_tokens=VALUES(max_tokens), response_format=VALUES(response_format)`,
        [t.key, t.typeKey ?? null, t.purpose, t.name, t.description ?? null, t.temperature, t.maxTokens, t.responseFormat],
      );
    }
    console.log(`✅ prompt_templates: ${TEMPLATES.length} rows`);

    // 4. 模板-片段组装（先清后插，保证幂等）
    const [templateRows] = await pool.query(`SELECT id, template_key FROM prompt_templates`);
    const templateIdByKey = new Map(
      (templateRows as Array<{ id: number; template_key: string }>).map((r) => [r.template_key, r.id]),
    );
    const [componentRows] = await pool.query(`SELECT id, component_key FROM prompt_components`);
    const componentIdByKey = new Map(
      (componentRows as Array<{ id: number; component_key: string }>).map((r) => [r.component_key, r.id]),
    );

    let itemCount = 0;
    for (const t of TEMPLATES) {
      const templateId = templateIdByKey.get(t.key);
      if (!templateId) continue;
      await pool.execute(`DELETE FROM prompt_template_items WHERE template_id = ?`, [templateId]);
      for (const item of t.items) {
        const componentId = componentIdByKey.get(item.componentKey);
        if (!componentId) {
          console.warn(`⚠️  component not found: ${item.componentKey}`);
          continue;
        }
        await pool.execute(
          `INSERT INTO prompt_template_items (template_id, component_id, sort_order, slot) VALUES (?, ?, ?, ?)`,
          [templateId, componentId, item.sort, item.slot],
        );
        itemCount++;
      }
    }
    console.log(`✅ prompt_template_items: ${itemCount} rows`);

    console.log("🎉 Prompt 种子数据写入完成");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
