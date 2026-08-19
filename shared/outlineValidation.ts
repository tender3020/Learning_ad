import type { OutlineItem } from "./outlineTypes";

const VAGUE_TITLE_PATTERNS = [
  /^第\s*\d+\s*天/,
  /继续学习/,
  /深入学习/,
  /继续学/,
  /学习第\d+天/,
  /^学习.+第\d+天$/,
  /基础词汇\s*2?$/,
];

export interface OutlineValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOutline(outline: OutlineItem[], totalDays: number): OutlineValidationResult {
  const errors: string[] = [];

  if (outline.length !== totalDays) {
    errors.push(`大纲条目数 ${outline.length} 与计划天数 ${totalDays} 不一致`);
  }

  const dayNumbers = outline.map((o) => o.dayNumber).sort((a, b) => a - b);
  for (let i = 1; i <= totalDays; i++) {
    if (!dayNumbers.includes(i)) {
      errors.push(`缺少第 ${i} 天的大纲`);
    }
  }

  const seenDays = new Set<number>();
  for (const item of outline) {
    if (seenDays.has(item.dayNumber)) {
      errors.push(`第 ${item.dayNumber} 天重复出现`);
    }
    seenDays.add(item.dayNumber);

    const title = item.title.trim();
    if (!title || title.length < 4) {
      errors.push(`第 ${item.dayNumber} 天标题过短或为空`);
    }

    for (const pattern of VAGUE_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        errors.push(`第 ${item.dayNumber} 天标题过于笼统：「${title}」`);
        break;
      }
    }
  }

  const titles = outline.map((o) => o.title.trim().toLowerCase());
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      if (titles[i] === titles[j]) {
        errors.push(`第 ${outline[i].dayNumber} 天与第 ${outline[j].dayNumber} 天标题重复`);
      } else if (
        titles[i].length >= 6 &&
        titles[j].length >= 6 &&
        (titles[i].includes(titles[j]) || titles[j].includes(titles[i]))
      ) {
        errors.push(`第 ${outline[i].dayNumber} 天与第 ${outline[j].dayNumber} 天标题过于相似`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
