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

/** 从 section 正文中提取首句作为 anchor 候选 */
export function extractFirstSentences(body: string, count = 2): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^#{1,6}\s.+$/gm, " ")
    .replace(/\|[^\n]+\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";

  const sentences = plain.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [plain];
  return sentences
    .slice(0, count)
    .join("")
    .trim()
    .slice(0, 40);
}
