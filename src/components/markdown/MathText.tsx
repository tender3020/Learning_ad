import { memo, type CSSProperties, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { preprocessMath } from "./mathPreprocess";

/** 匹配块级 $$...$$ 或行内 $...$（行内要求首尾非空格，避免误匹配 "$5 和 $10" 这类场景） */
const MATH_SEGMENT_RE = /\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g;

/**
 * 将文本拆分为「纯文本 + KaTeX 公式」片段。
 * 文本部分不做 Markdown 解析，避免题目/选项被误解析为列表等结构；
 * 公式用 katex.renderToString 渲染，输出与正文 rehype-katex 一致。
 */
export function renderTextWithMath(text: string): ReactNode[] {
  const processed = preprocessMath(text);
  const segments: ReactNode[] = [];
  MATH_SEGMENT_RE.lastIndex = 0;

  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = MATH_SEGMENT_RE.exec(processed)) !== null) {
    if (match.index > last) {
      segments.push(processed.slice(last, match.index));
    }
    const displayMode = match[1] !== undefined;
    const formula = displayMode ? match[1] : match[2];
    try {
      const html = katex.renderToString(formula, {
        displayMode,
        throwOnError: false,
      });
      segments.push(
        <span key={key++} dangerouslySetInnerHTML={{ __html: html }} />,
      );
    } catch {
      segments.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < processed.length) {
    segments.push(processed.slice(last));
  }
  return segments;
}

interface MathTextProps {
  text: string;
  as?: "p" | "span";
  className?: string;
  style?: CSSProperties;
}

/**
 * 纯文本容器 + KaTeX 公式渲染。
 * 用于练习题题目/选项/解析等场景，使公式显示形式与正文 Markdown 渲染一致。
 */
function MathText({ text, as: Tag = "span", className, style }: MathTextProps) {
  return (
    <Tag className={className} style={style}>
      {renderTextWithMath(text)}
    </Tag>
  );
}

export default memo(MathText);
