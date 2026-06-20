import { env } from "./env";

const MERMAID_INK_BASE = "https://mermaid.ink/img";

/** 简单校验 Mermaid 源码是否包含有效图表类型 */
export function isValidMermaidSyntax(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph)/m.test(
    trimmed,
  );
}

/** 清理 LLM 输出的 Mermaid 代码 */
export function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim();
  code = code.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/, "");
  code = code.replace(/^mermaid\s*\n/i, "");
  return code.trim();
}

function toBase64Url(text: string): string {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function renderMermaidToPng(mermaidCode: string): Promise<Buffer> {
  const sanitized = sanitizeMermaidCode(mermaidCode);
  if (!isValidMermaidSyntax(sanitized)) {
    throw new Error("Mermaid 语法无效");
  }

  const encoded = toBase64Url(sanitized);
  const url = `${MERMAID_INK_BASE}/${encoded}?type=png&bgColor=white`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(env.mermaidRenderTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Mermaid 渲染失败: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image")) {
    throw new Error("Mermaid 渲染未返回图片");
  }

  return Buffer.from(await response.arrayBuffer());
}

export function isMermaidRenderAvailable(): boolean {
  return true;
}
