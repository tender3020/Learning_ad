import fs from "fs/promises";
import path from "path";
import {
  type LearningType,
  getImagePromptExtractionPrompt,
} from "@shared/typeEngine";
import { chatCompletion } from "../lib/deepseek";
import {
  generateWanxiangImage,
  isWanxiangConfigured,
  WANXIANG_IMAGE_RATIO,
} from "../lib/wanxiang-image";

export type ImagePromptItem = {
  anchorText: string;
  prompt: string;
};

const DATA_ROOT = path.resolve(import.meta.dirname, "../../data");
const UPLOADS_ROOT = path.join(DATA_ROOT, "uploads");
const RATIO_TOLERANCE = 0.04;

function contentImagesDir(planId: number, dayNumber: number): string {
  return path.join(
    UPLOADS_ROOT,
    "content-images",
    String(planId),
    String(dayNumber),
  );
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function matchesTargetRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return Math.abs(ratio - WANXIANG_IMAGE_RATIO) <= RATIO_TOLERANCE;
}

async function clearPngFiles(dir: string): Promise<void> {
  try {
    const files = await fs.readdir(dir);
    await Promise.all(
      files
        .filter((f) => /\.png$/i.test(f))
        .map((f) => fs.unlink(path.join(dir, f))),
    );
  } catch {
    // 目录不存在时忽略
  }
}

function normalizeImagePromptItem(
  raw: { anchorText?: string; anchor?: string; prompt?: string },
): ImagePromptItem | null {
  if (!raw.prompt?.trim()) return null;
  const anchorText = (raw.anchorText || raw.anchor || "").trim();
  if (!anchorText) return null;
  return { anchorText, prompt: raw.prompt.trim() };
}

function parseJsonArray(text: string): ImagePromptItem[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      anchorText?: string;
      anchor?: string;
      prompt?: string;
    }>;
    return parsed
      .map(normalizeImagePromptItem)
      .filter((item): item is ImagePromptItem => item !== null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** 在正文中定位 anchorText，返回该段落后方的插入位置 */
function findInsertIndexAfterParagraph(
  markdown: string,
  anchorText: string,
): number | null {
  const needle = anchorText.trim();
  if (!needle) return null;

  let idx = markdown.indexOf(needle);
  if (idx === -1 && needle.length > 12) {
    idx = markdown.indexOf(needle.slice(0, Math.min(20, needle.length)));
  }
  if (idx === -1) return null;

  const blockEnd = markdown.indexOf("\n\n", idx);
  return blockEnd === -1 ? markdown.length : blockEnd;
}

/** 标题关键词兜底：插在匹配标题下第一个段落之后 */
function findInsertIndexAfterHeading(
  markdown: string,
  keyword: string,
): number | null {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^#{1,3}\s/.test(lines[i]) || !lines[i].includes(keyword)) continue;

    let insertAt = i + 1;
    while (
      insertAt < lines.length &&
      lines[insertAt].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[insertAt]) &&
      !lines[insertAt].startsWith("<!--") &&
      !lines[insertAt].startsWith("```")
    ) {
      insertAt++;
    }

    const before = lines.slice(0, insertAt).join("\n");
    return before.length + (insertAt < lines.length ? 1 : 0);
  }
  return null;
}

export async function extractImagePrompts(
  markdown: string,
  learningType: LearningType,
  dayTitle: string,
): Promise<ImagePromptItem[]> {
  const systemPrompt = getImagePromptExtractionPrompt(learningType, dayTitle);
  const contentSlice = markdown.slice(0, 12000);

  const response = await chatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentSlice },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const items = parseJsonArray(text);

  if (items.length >= 2) {
    return items;
  }

  return buildFallbackPrompts(learningType, dayTitle, items);
}

function buildFallbackPrompts(
  learningType: LearningType,
  dayTitle: string,
  partial: ImagePromptItem[],
): ImagePromptItem[] {
  const fallbacks: Record<LearningType, ImagePromptItem[]> = {
    abstract_logic: [
      { anchorText: "核心概念", prompt: `${dayTitle}核心概念的直观教育插画，抽象公式与生活比喻结合，柔和蓝紫色调，3:2横向` },
      { anchorText: "直观理解", prompt: `${dayTitle}几何直觉理解示意图，清晰标注关系，教育风格，柔和配色，3:2横向` },
    ],
    operation_logic: [
      { anchorText: "今日概念", prompt: `${dayTitle}编程概念示意图，代码编辑器与逻辑流程，现代科技感，3:2横向` },
      { anchorText: "运行结果", prompt: `${dayTitle}代码运行场景，终端输出与程序界面，清晰教育插画，3:2横向` },
    ],
    language: [
      { anchorText: "今日场景", prompt: `${dayTitle}真实生活对话场景，人物自然交流，温暖光线，3:2横向` },
      { anchorText: "场景对话", prompt: `${dayTitle}情景对话瞬间，表情与肢体语言清晰，教育插画风格，3:2横向` },
    ],
    network_assoc: [
      { anchorText: "今日叙事", prompt: `${dayTitle}历史叙事关键瞬间，人物与场景细节丰富，电影感插画，3:2横向` },
      { anchorText: "关键要素", prompt: `${dayTitle}核心人物与地点场景，历史氛围，细腻插画，3:2横向` },
    ],
    model_apply: [
      { anchorText: "今日模型", prompt: `${dayTitle}商业分析模型概念图，简洁图表与案例元素，专业教育风，3:2横向` },
      { anchorText: "手算案例", prompt: `${dayTitle}现实商业案例场景，办公室或市场情境，清晰插画，3:2横向` },
    ],
    perception: [
      { anchorText: "今日目标", prompt: `${dayTitle}创作目标完成效果示意，作品展示，艺术教学风格，3:2横向` },
      { anchorText: "示范与拆解", prompt: `${dayTitle}技法示范过程，手部操作与作品细节，柔和光线，3:2横向` },
    ],
    practical: [
      { anchorText: "准备工作", prompt: `${dayTitle}工具材料准备场景，整齐摆放，安全规范，清晰教育插画，3:2横向` },
      { anchorText: "分步操作", prompt: `${dayTitle}关键操作步骤画面，手部动作清晰，专业教学风格，3:2横向` },
    ],
  };

  const base = fallbacks[learningType] ?? fallbacks.abstract_logic;
  const merged = [...partial];
  for (const item of base) {
    if (merged.length >= 3) break;
    if (!merged.some((m) => m.anchorText === item.anchorText)) {
      merged.push(item);
    }
  }
  return merged.slice(0, 3);
}

export function hasContentIllustrations(
  markdown: string,
  planId: number,
  dayNumber: number,
): boolean {
  return markdown.includes(
    `/uploads/content-images/${planId}/${dayNumber}/`,
  );
}

export async function illustrationsExistOnDisk(
  planId: number,
  dayNumber: number,
): Promise<boolean> {
  const dir = contentImagesDir(planId, dayNumber);
  try {
    const files = await fs.readdir(dir);
    return files.some((f) => /\.png$/i.test(f));
  } catch {
    return false;
  }
}

/** 磁盘上的配图是否均为目标比例（3:2） */
export async function illustrationsMatchTargetRatio(
  planId: number,
  dayNumber: number,
): Promise<boolean> {
  const dir = contentImagesDir(planId, dayNumber);
  try {
    const files = await fs.readdir(dir);
    const pngs = files.filter((f) => /\.png$/i.test(f));
    if (pngs.length === 0) return false;

    for (const file of pngs) {
      const buffer = await fs.readFile(path.join(dir, file));
      const dim = readPngDimensions(buffer);
      if (!dim || !matchesTargetRatio(dim.width, dim.height)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function shouldSkipIllustrationGeneration(
  markdown: string,
  planId: number,
  dayNumber: number,
): Promise<boolean> {
  if (!hasContentIllustrations(markdown, planId, dayNumber)) {
    return false;
  }
  if (!await illustrationsExistOnDisk(planId, dayNumber)) {
    return false;
  }
  return await illustrationsMatchTargetRatio(planId, dayNumber);
}

export function stripContentImages(
  markdown: string,
  planId: number,
  dayNumber: number,
): string {
  const pattern = new RegExp(
    `\\n*!\\[[^\\]]*\\]\\(/uploads/content-images/${planId}/${dayNumber}/[^)]+\\)\\n*`,
    "g",
  );
  return markdown.replace(pattern, "\n");
}

export function insertImagesIntoMarkdown(
  markdown: string,
  items: Array<{ anchorText: string; publicPath: string; alt: string }>,
): string {
  const positioned = items
    .map((item) => {
      const pos =
        findInsertIndexAfterParagraph(markdown, item.anchorText) ??
        findInsertIndexAfterHeading(markdown, item.anchorText);
      return pos !== null ? { ...item, pos } : null;
    })
    .filter((item): item is typeof items[number] & { pos: number } => item !== null)
    .sort((a, b) => b.pos - a.pos);

  let result = markdown;
  for (const item of positioned) {
    const imageBlock = `\n\n![${item.alt}](${item.publicPath})\n\n`;
    result = result.slice(0, item.pos) + imageBlock + result.slice(item.pos);
  }

  const missing = items.filter(
    (item) =>
      !positioned.some(
        (p) => p.publicPath === item.publicPath && p.anchorText === item.anchorText,
      ),
  );
  for (const item of missing) {
    const imageBlock = `\n\n![${item.alt}](${item.publicPath})\n\n`;
    const quizIdx = result.indexOf("<!-- quiz");
    if (quizIdx > 0) {
      result = result.slice(0, quizIdx).trimEnd() + imageBlock + result.slice(quizIdx);
    } else {
      result = result.trimEnd() + imageBlock;
    }
  }

  return result;
}

async function downloadImage(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

export async function generateContentIllustrations(params: {
  planId: number;
  dayNumber: number;
  dayTitle: string;
  learningType: LearningType;
  markdownContent: string;
}): Promise<{ imageCount: number; markdownContent: string }> {
  if (!isWanxiangConfigured()) {
    return { imageCount: 0, markdownContent: params.markdownContent };
  }

  const prompts = await extractImagePrompts(
    params.markdownContent,
    params.learningType,
    params.dayTitle,
  );

  if (prompts.length === 0) {
    return { imageCount: 0, markdownContent: params.markdownContent };
  }

  const cleanMarkdown = stripContentImages(
    params.markdownContent,
    params.planId,
    params.dayNumber,
  );

  const dir = contentImagesDir(params.planId, params.dayNumber);
  await clearPngFiles(dir);
  await fs.mkdir(dir, { recursive: true });

  const inserted: Array<{ anchorText: string; publicPath: string; alt: string }> = [];

  for (let i = 0; i < prompts.length; i++) {
    const item = prompts[i];
    try {
      const remoteUrl = await generateWanxiangImage(item.prompt);
      const filename = `${i}.png`;
      const filePath = path.join(dir, filename);
      await downloadImage(remoteUrl, filePath);

      const alt =
        item.anchorText.length > 24
          ? item.anchorText.slice(0, 24) + "…"
          : item.anchorText;

      inserted.push({
        anchorText: item.anchorText,
        publicPath: `/uploads/content-images/${params.planId}/${params.dayNumber}/${filename}`,
        alt,
      });
    } catch (error) {
      console.error(
        `[content-image] 生成失败 plan=${params.planId} day=${params.dayNumber} #${i}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (inserted.length === 0) {
    return { imageCount: 0, markdownContent: cleanMarkdown };
  }

  const markdownContent = insertImagesIntoMarkdown(cleanMarkdown, inserted);
  return { imageCount: inserted.length, markdownContent };
}

export function getUploadsRoot(): string {
  return UPLOADS_ROOT;
}
