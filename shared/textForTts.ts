/** 将 Markdown 转为适合 TTS 朗读的纯文本 */
export function markdownToSpeechText(markdown: string): string {
  let text = markdown;

  text = text.replace(/<!--\s*quiz[\s\S]*?-->/gi, "");
  text = text.replace(/```[\s\S]*?```/g, "代码示例，请查看原文。");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/\$\$[\s\S]*?\$\$/g, "");
  text = text.replace(/\$[^$]+\$/g, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");

  return text.trim();
}

const SENTENCE_DELIMITER = /(?<=[。！？.!?；;])\s*/;

function splitLongChunk(chunk: string, maxChars: number): string[] {
  if (chunk.length <= maxChars) return [chunk];

  const parts: string[] = [];
  let rest = chunk;

  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars);
    const lastBreak = Math.max(
      slice.lastIndexOf("，"),
      slice.lastIndexOf(","),
      slice.lastIndexOf("、"),
      slice.lastIndexOf(" "),
    );
    const cutAt = lastBreak > maxChars * 0.3 ? lastBreak + 1 : maxChars;
    parts.push(rest.slice(0, cutAt).trim());
    rest = rest.slice(cutAt).trim();
  }

  if (rest) parts.push(rest);
  return parts;
}

/**
 * 按句号/问号/感叹号等切分为朗读单元（主流语音 APP 的句子级流水线）
 */
export function splitIntoSentences(
  rawMarkdown: string,
  maxCharsPerSentence = 450,
): string[] {
  const text = markdownToSpeechText(rawMarkdown);
  if (!text) return [];

  const rawSentences = text
    .split(SENTENCE_DELIMITER)
    .map((s) => s.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const sentence of rawSentences) {
    sentences.push(...splitLongChunk(sentence, maxCharsPerSentence));
  }

  return sentences;
}

export function prepareSpeechSentences(
  rawMarkdown: string,
  maxCharsPerSentence = 450,
): string[] {
  return splitIntoSentences(rawMarkdown, maxCharsPerSentence);
}
