import fs from "fs/promises";
import path from "path";
import {
  type LearningType,
  type VisualMedium,
  getImageSceneBriefExtractionPrompt,
  getImageSectionKeywords,
  getImageMediumForSection,
} from "@shared/typeEngine";
import {
  splitMarkdownByH2,
  extractFirstSentences,
  type MarkdownSection,
} from "@shared/markdownSections";
import { chatCompletion } from "../lib/deepseek";
import {
  generateWanxiangImage,
  isWanxiangConfigured,
  WANXIANG_IMAGE_RATIO,
} from "../lib/wanxiang-image";
import {
  renderMermaidToPng,
  sanitizeMermaidCode,
  isValidMermaidSyntax,
} from "../lib/mermaid-render";
import {
  validateImageMatch,
  enhancePromptForRetry,
} from "../lib/image-validation";

export type SceneBrief = {
  anchorText: string;
  sectionTitle?: string;
  visualMedium: VisualMedium;
  sceneType?: string;
  subjects?: string[];
  setting?: string;
  action?: string;
  uniqueIdentifiers?: string[];
  style?: string;
  avoid?: string[];
  mermaidCode?: string;
  prompt?: string;
};

export type IllustrationPlan = {
  anchorText: string;
  visualMedium: VisualMedium;
  prompt?: string;
  mermaidCode?: string;
  uniqueIdentifiers: string[];
  sectionTitle?: string;
};

const DATA_ROOT = path.resolve(import.meta.dirname, "../../data");
const UPLOADS_ROOT = path.join(DATA_ROOT, "uploads");
const RATIO_TOLERANCE = 0.08;
const SECTION_BODY_LIMIT = 1500;

function contentImagesDir(planId: number, dayNumber: number): string {
  return path.join(
    UPLOADS_ROOT,
    "content-images",
    String(planId),
    String(dayNumber),
  );
}

function contentDiagramsDir(planId: number, dayNumber: number): string {
  return path.join(
    UPLOADS_ROOT,
    "content-diagrams",
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

function parseJsonArray<T>(text: string): T[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as T[];
  } catch {
    return [];
  }
}

/** 解析内容生成时预埋的配图意图标记 */
export function parseIllustrationMarkers(markdown: string): IllustrationPlan[] {
  const pattern = /<!--\s*illustration:\s*(\{[\s\S]*?\})\s*-->/g;
  const items: IllustrationPlan[] = [];

  for (const match of markdown.matchAll(pattern)) {
    try {
      const raw = JSON.parse(match[1]) as {
        anchor?: string;
        intent?: string;
        medium?: string;
      };
      const anchorText = raw.anchor?.trim();
      if (!anchorText) continue;

      const medium = raw.medium === "mermaid" ? "mermaid" : "wanxiang";
      items.push({
        anchorText,
        visualMedium: medium,
        uniqueIdentifiers: raw.intent ? [raw.intent] : [],
        prompt:
          medium === "wanxiang" && raw.intent
            ? `${raw.intent}，清晰教育插画，柔和配色，3:2 横向，不要出现任何文字、水印或 logo`
            : undefined,
      });
    } catch {
      // 忽略无效标记
    }
  }

  return items.slice(0, 3);
}

function normalizeSceneBrief(raw: Record<string, unknown>): SceneBrief | null {
  const anchorText = String(raw.anchorText ?? "").trim();
  if (!anchorText) return null;

  const mediumRaw = String(raw.visualMedium ?? "wanxiang").toLowerCase();
  const visualMedium: VisualMedium =
    mediumRaw === "mermaid" ? "mermaid" : "wanxiang";

  const uniqueIdentifiers = Array.isArray(raw.uniqueIdentifiers)
    ? raw.uniqueIdentifiers.map(String).filter(Boolean)
    : [];

  return {
    anchorText,
    sectionTitle: raw.sectionTitle ? String(raw.sectionTitle) : undefined,
    visualMedium,
    sceneType: raw.sceneType ? String(raw.sceneType) : undefined,
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map(String) : undefined,
    setting: raw.setting ? String(raw.setting) : undefined,
    action: raw.action ? String(raw.action) : undefined,
    uniqueIdentifiers,
    style: raw.style ? String(raw.style) : undefined,
    avoid: Array.isArray(raw.avoid) ? raw.avoid.map(String) : undefined,
    mermaidCode: raw.mermaidCode ? String(raw.mermaidCode) : undefined,
    prompt: raw.prompt ? String(raw.prompt) : undefined,
  };
}

export function buildWanxiangPromptFromBrief(brief: SceneBrief): string {
  if (brief.prompt?.trim()) {
    return brief.prompt.trim();
  }

  const parts: string[] = [];
  if (brief.subjects?.length) {
    parts.push(`主体：${brief.subjects.join("、")}`);
  }
  if (brief.setting) parts.push(`环境：${brief.setting}`);
  if (brief.action) parts.push(`动作：${brief.action}`);
  if (brief.uniqueIdentifiers?.length) {
    parts.push(`必须体现的元素：${brief.uniqueIdentifiers.join("、")}`);
  }
  parts.push(brief.style ?? "清晰教育插画，柔和配色，3:2 横向构图");
  const avoid = brief.avoid?.length
    ? brief.avoid.join("、")
    : "画面中出现任何文字、水印、logo";
  parts.push(`避免：${avoid}`);

  return parts.join("。");
}

function sceneBriefToPlan(brief: SceneBrief): IllustrationPlan {
  return {
    anchorText: brief.anchorText,
    visualMedium: brief.visualMedium,
    prompt:
      brief.visualMedium === "wanxiang"
        ? buildWanxiangPromptFromBrief(brief)
        : undefined,
    mermaidCode: brief.mermaidCode,
    uniqueIdentifiers: brief.uniqueIdentifiers ?? [],
    sectionTitle: brief.sectionTitle,
  };
}

function selectSectionsForIllustration(
  sections: MarkdownSection[],
  learningType: LearningType,
): MarkdownSection[] {
  const keywords = getImageSectionKeywords(learningType);
  const selected: MarkdownSection[] = [];
  const used = new Set<string>();

  for (const keyword of keywords) {
    if (selected.length >= 3) break;
    const match = sections.find(
      (s) =>
        s.title &&
        s.title.includes(keyword) &&
        s.body.trim().length > 40 &&
        !used.has(s.id),
    );
    if (match) {
      selected.push(match);
      used.add(match.id);
    }
  }

  for (const section of sections) {
    if (selected.length >= 3) break;
    if (section.body.trim().length < 40 || used.has(section.id)) continue;
    if (section.title && /小结|练习|quiz|错题|跟读/.test(section.title)) continue;
    selected.push(section);
    used.add(section.id);
  }

  return selected.slice(0, 3);
}

function formatSectionsForLlm(sections: MarkdownSection[]): string {
  return sections
    .map((s) => {
      const body = s.body.slice(0, SECTION_BODY_LIMIT);
      const title = s.title ?? "引言";
      return `### 章节：${title}\n${body}`;
    })
    .join("\n\n---\n\n");
}

async function extractSceneBriefsFromSections(
  sections: MarkdownSection[],
  learningType: LearningType,
  dayTitle: string,
): Promise<SceneBrief[]> {
  if (sections.length === 0) return [];

  const systemPrompt = getImageSceneBriefExtractionPrompt(learningType, dayTitle);
  const userContent = formatSectionsForLlm(sections);

  const response = await chatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 2500,
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  return parseJsonArray<Record<string, unknown>>(text)
    .map(normalizeSceneBrief)
    .filter((b): b is SceneBrief => b !== null)
    .slice(0, 3);
}

function buildFallbackFromSections(
  sections: MarkdownSection[],
  learningType: LearningType,
): SceneBrief[] {
  const keywords = getImageSectionKeywords(learningType);
  const selected = selectSectionsForIllustration(sections, learningType);
  const briefs: SceneBrief[] = [];

  for (const section of selected) {
    if (briefs.length >= 3) break;

    const anchorText = extractFirstSentences(section.body);
    if (!anchorText) continue;

    const visualMedium = getImageMediumForSection(learningType, section.title);
    const title = section.title ?? keywords[0] ?? "核心内容";
    const snippet = section.body.slice(0, 200).replace(/\s+/g, " ");

    if (visualMedium === "mermaid") {
      const nodeA = title.slice(0, 12);
      briefs.push({
        anchorText,
        sectionTitle: section.title ?? undefined,
        visualMedium: "mermaid",
        uniqueIdentifiers: [title],
        mermaidCode: `flowchart TD\n  A[${nodeA}] --> B[关键步骤]\n  B --> C[结论]`,
      });
    } else {
      briefs.push({
        anchorText,
        sectionTitle: section.title ?? undefined,
        visualMedium: "wanxiang",
        subjects: [title],
        setting: snippet.slice(0, 80),
        action: anchorText,
        uniqueIdentifiers: [title, anchorText.slice(0, 12)],
        style: "清晰教育插画，柔和配色，3:2 横向构图",
        avoid: ["画面中出现任何文字、水印、logo"],
      });
    }
  }

  return briefs.slice(0, 3);
}

export async function extractIllustrationPlans(
  markdown: string,
  learningType: LearningType,
  dayTitle: string,
): Promise<IllustrationPlan[]> {
  const fromMarkers = parseIllustrationMarkers(markdown);
  if (fromMarkers.length >= 2) {
    return fromMarkers;
  }

  const sections = splitMarkdownByH2(markdown);
  const targetSections = selectSectionsForIllustration(sections, learningType);

  let briefs = await extractSceneBriefsFromSections(
    targetSections,
    learningType,
    dayTitle,
  );

  if (briefs.length < 2) {
    const fallbackBriefs = buildFallbackFromSections(sections, learningType);
    const merged = [...briefs];
    for (const fb of fallbackBriefs) {
      if (merged.length >= 3) break;
      if (!merged.some((m) => m.anchorText === fb.anchorText)) {
        merged.push(fb);
      }
    }
    briefs = merged;
  }

  const plans = briefs.map(sceneBriefToPlan);

  if (fromMarkers.length > 0) {
    for (const marker of fromMarkers) {
      if (plans.length >= 3) break;
      if (!plans.some((p) => p.anchorText === marker.anchorText)) {
        plans.unshift(marker);
      }
    }
  }

  return plans.slice(0, 3);
}

/** @deprecated 兼容旧接口 */
export async function extractImagePrompts(
  markdown: string,
  learningType: LearningType,
  dayTitle: string,
): Promise<Array<{ anchorText: string; prompt: string }>> {
  const plans = await extractIllustrationPlans(markdown, learningType, dayTitle);
  return plans
    .filter((p) => p.visualMedium === "wanxiang" && p.prompt)
    .map((p) => ({ anchorText: p.anchorText, prompt: p.prompt! }));
}

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

export function hasContentIllustrations(
  markdown: string,
  planId: number,
  dayNumber: number,
): boolean {
  return (
    markdown.includes(`/uploads/content-images/${planId}/${dayNumber}/`) ||
    markdown.includes(`/uploads/content-diagrams/${planId}/${dayNumber}/`)
  );
}

export async function illustrationsExistOnDisk(
  planId: number,
  dayNumber: number,
): Promise<boolean> {
  for (const dirFn of [contentImagesDir, contentDiagramsDir]) {
    const dir = dirFn(planId, dayNumber);
    try {
      const files = await fs.readdir(dir);
      if (files.some((f) => /\.png$/i.test(f))) return true;
    } catch {
      // continue
    }
  }
  return false;
}

export async function illustrationsMatchTargetRatio(
  planId: number,
  dayNumber: number,
): Promise<boolean> {
  const dir = contentImagesDir(planId, dayNumber);
  try {
    const files = await fs.readdir(dir);
    const pngs = files.filter((f) => /\.png$/i.test(f));
    if (pngs.length === 0) return true;

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
  force = false,
): Promise<boolean> {
  if (force) return false;
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
  const imagePattern = new RegExp(
    `\\n*!\\[[^\\]]*\\]\\(/uploads/content-images/${planId}/${dayNumber}/[^)]+\\)\\n*`,
    "g",
  );
  const diagramPattern = new RegExp(
    `\\n*!\\[[^\\]]*\\]\\(/uploads/content-diagrams/${planId}/${dayNumber}/[^)]+\\)\\n*`,
    "g",
  );
  return markdown.replace(imagePattern, "\n").replace(diagramPattern, "\n");
}

export function insertImagesIntoMarkdown(
  markdown: string,
  items: Array<{ anchorText: string; publicPath: string; alt: string; sectionTitle?: string }>,
): string {
  const positioned = items
    .map((item) => {
      const pos =
        findInsertIndexAfterParagraph(markdown, item.anchorText) ??
        (item.sectionTitle
          ? findInsertIndexAfterHeading(markdown, item.sectionTitle)
          : null) ??
        findInsertIndexAfterHeading(markdown, item.anchorText.slice(0, 8));
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

async function generateWanxiangWithValidation(params: {
  prompt: string;
  filePath: string;
  anchorText: string;
  uniqueIdentifiers: string[];
}): Promise<void> {
  let prompt = params.prompt;
  await downloadImage(await generateWanxiangImage(prompt), params.filePath);

  const valid = await validateImageMatch({
    imagePath: params.filePath,
    uniqueIdentifiers: params.uniqueIdentifiers,
    anchorText: params.anchorText,
  });

  if (valid) return;

  prompt = enhancePromptForRetry(prompt, params.uniqueIdentifiers);
  await downloadImage(await generateWanxiangImage(prompt), params.filePath);
}

async function renderMermaidDiagram(
  mermaidCode: string,
  filePath: string,
): Promise<boolean> {
  const sanitized = sanitizeMermaidCode(mermaidCode);
  if (!isValidMermaidSyntax(sanitized)) return false;

  try {
    const buffer = await renderMermaidToPng(sanitized);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return true;
  } catch {
    return false;
  }
}

export async function generateContentIllustrations(params: {
  planId: number;
  dayNumber: number;
  dayTitle: string;
  learningType: LearningType;
  markdownContent: string;
}): Promise<{ imageCount: number; markdownContent: string }> {
  const plans = await extractIllustrationPlans(
    params.markdownContent,
    params.learningType,
    params.dayTitle,
  );

  if (plans.length === 0) {
    return { imageCount: 0, markdownContent: params.markdownContent };
  }

  const wanxiangAvailable = isWanxiangConfigured();
  const hasWanxiangPlans = plans.some((p) => p.visualMedium === "wanxiang");
  if (hasWanxiangPlans && !wanxiangAvailable) {
    console.warn("[content-image] DASHSCOPE_API_KEY 未配置，跳过万相插画");
  }

  const cleanMarkdown = stripContentImages(
    params.markdownContent,
    params.planId,
    params.dayNumber,
  );

  await clearPngFiles(contentImagesDir(params.planId, params.dayNumber));
  await clearPngFiles(contentDiagramsDir(params.planId, params.dayNumber));
  await fs.mkdir(contentImagesDir(params.planId, params.dayNumber), {
    recursive: true,
  });
  await fs.mkdir(contentDiagramsDir(params.planId, params.dayNumber), {
    recursive: true,
  });

  const inserted: Array<{
    anchorText: string;
    publicPath: string;
    alt: string;
    sectionTitle?: string;
  }> = [];

  let imageIndex = 0;

  for (const plan of plans) {
    const alt =
      plan.anchorText.length > 24
        ? plan.anchorText.slice(0, 24) + "…"
        : plan.anchorText;

    try {
      if (plan.visualMedium === "mermaid" && plan.mermaidCode) {
        const filename = `${imageIndex}.png`;
        const filePath = path.join(
          contentDiagramsDir(params.planId, params.dayNumber),
          filename,
        );
        const ok = await renderMermaidDiagram(plan.mermaidCode, filePath);
        if (!ok && wanxiangAvailable) {
          const fallbackPrompt =
            plan.prompt ??
            buildWanxiangPromptFromBrief({
              anchorText: plan.anchorText,
              visualMedium: "wanxiang",
              uniqueIdentifiers: plan.uniqueIdentifiers,
              subjects: plan.uniqueIdentifiers.slice(0, 2),
              style: "清晰教育插画，柔和配色，3:2 横向构图",
              avoid: ["画面中出现任何文字、水印、logo"],
            });
          const imgPath = path.join(
            contentImagesDir(params.planId, params.dayNumber),
            filename,
          );
          await generateWanxiangWithValidation({
            prompt: fallbackPrompt,
            filePath: imgPath,
            anchorText: plan.anchorText,
            uniqueIdentifiers: plan.uniqueIdentifiers,
          });
          inserted.push({
            anchorText: plan.anchorText,
            publicPath: `/uploads/content-images/${params.planId}/${params.dayNumber}/${filename}`,
            alt,
            sectionTitle: plan.sectionTitle,
          });
        } else if (ok) {
          inserted.push({
            anchorText: plan.anchorText,
            publicPath: `/uploads/content-diagrams/${params.planId}/${params.dayNumber}/${filename}`,
            alt,
            sectionTitle: plan.sectionTitle,
          });
        }
        imageIndex += 1;
        continue;
      }

      if (plan.visualMedium === "wanxiang" && plan.prompt && wanxiangAvailable) {
        const filename = `${imageIndex}.png`;
        const filePath = path.join(
          contentImagesDir(params.planId, params.dayNumber),
          filename,
        );
        await generateWanxiangWithValidation({
          prompt: plan.prompt,
          filePath,
          anchorText: plan.anchorText,
          uniqueIdentifiers: plan.uniqueIdentifiers,
        });
        inserted.push({
          anchorText: plan.anchorText,
          publicPath: `/uploads/content-images/${params.planId}/${params.dayNumber}/${filename}`,
          alt,
          sectionTitle: plan.sectionTitle,
        });
        imageIndex += 1;
      }
    } catch (error) {
      console.error(
        `[content-image] 生成失败 plan=${params.planId} day=${params.dayNumber} #${imageIndex}:`,
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
