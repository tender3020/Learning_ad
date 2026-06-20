/** 移除配图意图 HTML 注释（仅服务端配图管线使用，用户不应看到） */
export function stripIllustrationMarkers(markdown: string): string {
  return markdown
    .replace(/<!--\s*illustration:\s*\{[\s\S]*?\}\s*-->/gi, "\n")
    .replace(/<!--\s*illustration:[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** 内容中是否仍含未处理的配图意图标记 */
export function hasIllustrationMarkers(markdown: string): boolean {
  return /<!--\s*illustration:/i.test(markdown);
}
