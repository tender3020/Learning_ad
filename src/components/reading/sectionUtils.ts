export type MarkdownSection = {
  id: string;
  title: string | null;
  body: string;
};

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

export function splitMarkdownByH2(text: string): MarkdownSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const headingRegex = /^## (.+)$/gm;
  const matches = [...trimmed.matchAll(headingRegex)];

  if (matches.length === 0) {
    return [{ id: "section-intro", title: null, body: trimmed }];
  }

  const sections: MarkdownSection[] = [];
  const firstIndex = matches[0].index ?? 0;

  if (firstIndex > 0) {
    const preamble = trimmed.slice(0, firstIndex).trim();
    if (preamble) {
      sections.push({ id: "section-intro", title: null, body: preamble });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? trimmed.length) : trimmed.length;
    const body = trimmed.slice(start, end).trim();
    const baseId = slugifyHeading(title);
    const id = sections.some((s) => s.id === baseId)
      ? `${baseId}-${i}`
      : baseId;

    sections.push({ id, title, body });
  }

  return sections;
}

export function extractTocFromMarkdown(markdown: string): Array<{ id: string; title: string }> {
  const headingRegex = /^## (.+)$/gm;
  const items: Array<{ id: string; title: string }> = [];
  let index = 0;

  for (const match of markdown.matchAll(headingRegex)) {
    const title = match[1].trim();
    const baseId = slugifyHeading(title);
    const id = items.some((item) => item.id === baseId)
      ? `${baseId}-${index}`
      : baseId;
    items.push({ id, title });
    index += 1;
  }

  return items;
}

export type SectionAccent = "default" | "purple" | "orange" | "green" | "blue";

export function getSectionAccent(title: string | null): SectionAccent {
  if (!title) return "default";
  if (/安全|须知|警告/.test(title)) return "orange";
  if (/叙事|场景|对话|故事/.test(title)) return "purple";
  if (/小结|总结|回顾/.test(title)) return "green";
  if (/概念|模型|核心|目标/.test(title)) return "blue";
  return "default";
}
