/**
 * 预处理 LaTeX 公式格式
 * AI 可能输出各种非标准格式，统一转换为 remark-math 支持的标准格式（$...$ / $$...$$）
 */
export function preprocessMath(content: string): string {
  return (
    content
      .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, "$$$$$1$$$$")
      .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, "$$$1$$")
      .replace(
        /^\[\s*\n?\s*(\\[a-zA-Z]+.*?)\s*\n?\s*\]$/gm,
        "$$$$$1$$$$"
      )
      .replace(/^\[\s*(\\.+?)\s*\]$/gm, "$$$$$1$$$$")
  );
}
