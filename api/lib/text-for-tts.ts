/** 将 Markdown 转为适合 TTS 朗读的纯文本 */
export function markdownToSpeechText(markdown: string): string {
  let text = markdown;

  // 移除 quiz 注释块
  text = text.replace(/<!--\s*quiz[\s\S]*?-->/gi, "");

  // 移除代码块，替换为简短提示
  text = text.replace(/```[\s\S]*?```/g, "代码示例，请查看原文。");

  // 移除行内代码
  text = text.replace(/`([^`]+)`/g, "$1");

  // 移除图片
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 链接保留文字
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 标题标记
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 粗体/斜体/删除线
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // 列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // 引用
  text = text.replace(/^>\s+/gm, "");

  // LaTeX 公式（简单跳过）
  text = text.replace(/\$\$[\s\S]*?\$\$/g, "");
  text = text.replace(/\$[^$]+\$/g, "");

  // HTML 标签
  text = text.replace(/<[^>]+>/g, "");

  // 合并空白
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");

  return text.trim();
}

/** 截断过长文本，火山 TTS 有长度限制 */
export function truncateForTts(text: string, maxChars = 4000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}……`;
}

const SENTENCE_END = /([。！？.!?；;])/;

/** 将长文本拆成多段，便于分段合成、流式播放 */
export function splitTextForStreaming(text: string, maxSegmentChars = 350): string[] {
  if (text.length <= maxSegmentChars) return [text];

  const segments: string[] = [];
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  let current = "";

  const flush = () => {
    if (current.trim()) {
      segments.push(current.trim());
      current = "";
    }
  };

  const pushPart = (part: string) => {
    if (!part.trim()) return;
    if ((current + part).length <= maxSegmentChars) {
      current += part;
      return;
    }
    flush();
    if (part.length <= maxSegmentChars) {
      current = part;
      return;
    }
    // 超长段落按句子切分
    let rest = part;
    while (rest.length > maxSegmentChars) {
      const slice = rest.slice(0, maxSegmentChars);
      const lastBreak = Math.max(
        slice.lastIndexOf("。"),
        slice.lastIndexOf("！"),
        slice.lastIndexOf("？"),
        slice.lastIndexOf("."),
        slice.lastIndexOf("!"),
        slice.lastIndexOf("?"),
      );
      const cutAt = lastBreak > maxSegmentChars * 0.3 ? lastBreak + 1 : maxSegmentChars;
      segments.push(rest.slice(0, cutAt).trim());
      rest = rest.slice(cutAt).trim();
    }
    current = rest;
  };

  for (const para of paragraphs) {
    if (para.length <= maxSegmentChars) {
      if ((current + para).length + 1 <= maxSegmentChars) {
        current = current ? `${current}。${para}` : para;
      } else {
        flush();
        current = para;
      }
      continue;
    }

    flush();
    const sentences = para.split(SENTENCE_END).reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 0 && part) {
        const end = arr[i + 1] ?? "";
        acc.push(part + end);
      }
      return acc;
    }, []);

    for (const sentence of sentences.length > 0 ? sentences : [para]) {
      pushPart(sentence);
    }
  }

  flush();
  return segments.length > 0 ? segments : [text.slice(0, maxSegmentChars)];
}
