export type MarkdownSection = {
  id: string;
  title: string | null;
  body: string;
};

export type HeadingIdState = {
  usedBaseIds: Set<string>;
  headingIndex: number;
};

export function createHeadingIdState(): HeadingIdState {
  return { usedBaseIds: new Set(), headingIndex: 0 };
}

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

export function allocateHeadingId(baseId: string, state: HeadingIdState): string {
  const id = state.usedBaseIds.has(baseId)
    ? `${baseId}-${state.headingIndex}`
    : baseId;
  state.usedBaseIds.add(baseId);
  state.headingIndex += 1;
  return id;
}

export function splitMarkdownByH2(
  text: string,
  state: HeadingIdState = createHeadingIdState(),
): MarkdownSection[] {
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
    const id = allocateHeadingId(baseId, state);

    sections.push({ id, title, body });
  }

  return sections;
}

export function buildTocFromTextParts(
  textParts: string[],
): Array<{ id: string; title: string }> {
  const state = createHeadingIdState();
  const toc: Array<{ id: string; title: string }> = [];

  for (const text of textParts) {
    const sections = splitMarkdownByH2(text, state);
    for (const section of sections) {
      if (section.title) {
        toc.push({ id: section.id, title: section.title });
      }
    }
  }

  return toc;
}

export function extractTocFromMarkdown(markdown: string): Array<{ id: string; title: string }> {
  const state = createHeadingIdState();
  const headingRegex = /^## (.+)$/gm;
  const items: Array<{ id: string; title: string }> = [];

  for (const match of markdown.matchAll(headingRegex)) {
    const title = match[1].trim();
    const baseId = slugifyHeading(title);
    items.push({ id: allocateHeadingId(baseId, state), title });
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
