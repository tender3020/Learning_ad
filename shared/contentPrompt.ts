import type { LearningType } from "./typeEngine";
import type { OutlineItem } from "./outlineTypes";
import { getPhaseForDay, allocatePhases } from "./outlinePhases";

export interface DayContentPromptInput {
  planGoal: string;
  dayNumber: number;
  totalDays: number;
  today: Pick<
    OutlineItem,
    | "title"
    | "goal"
    | "keywords"
    | "phaseName"
    | "phaseOrder"
    | "difficulty"
    | "prerequisites"
    | "learningObjective"
    | "estimatedMinutes"
  >;
  prevDay?: Pick<OutlineItem, "title" | "goal" | "learningObjective">;
  learningType: LearningType;
  skillLevel: string;
}

/** 构建每日学习内容 user prompt，注入阶段与前后天上下文 */
export function buildDayContentPrompt(input: DayContentPromptInput): string {
  const {
    planGoal,
    dayNumber,
    totalDays,
    today,
    prevDay,
    learningType,
    skillLevel,
  } = input;

  const phases = allocatePhases(learningType, totalDays);
  const phase = getPhaseForDay(phases, dayNumber);
  const phaseName = today.phaseName || phase?.name || "当前阶段";
  const phaseGoal = phase?.goal || today.goal;

  const prevSection = prevDay
    ? `\n【昨日学习】第 ${dayNumber - 1} 天主题：${prevDay.title}
昨日目标：${prevDay.learningObjective || prevDay.goal}
请在今日内容中自然承接，不要重复昨日已讲核心内容，应在此基础上递进。`
    : dayNumber > 1
      ? `\n【进度提示】这是第 ${dayNumber} 天，请在前序知识基础上递进，避免从零重复介绍。`
      : "";

  const objective =
    today.learningObjective || today.goal || "完成今日学习目标";

  return `请为第 ${dayNumber} 天（共 ${totalDays} 天）生成详细的学习内容。

【整体目标】${planGoal}
【当前阶段】${phaseName}（第 ${phase?.startDay ?? dayNumber}-${phase?.endDay ?? dayNumber} 天）
【阶段目标】${phaseGoal}
【学习者水平】${skillLevel}
${prevSection}

【今日主题】${today.title}
【今日目标】${today.goal}
${today.keywords ? `【关键词】${today.keywords}` : ""}
【可测量目标】${objective}
${today.prerequisites ? `【前置要求】${today.prerequisites}` : ""}
${today.difficulty ? `【难度级别】${today.difficulty}` : ""}

请用中文输出 Markdown，严格遵循 system prompt 中的章节结构要求。
内容须与今日主题和阶段目标一致，体现循序渐进；若适用，包含代码示例、应用场景、练习与小结。`;
}

export type { OutlineItem };
