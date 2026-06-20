/** 清理 LLM 输出的 Mermaid 代码 */
export function stripMermaidFences(raw: string): string {
  let code = raw.trim();
  code = code.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/, "");
  code = code.replace(/^mermaid\s*\n/i, "");
  return code.trim();
}

/** 简单校验 Mermaid 源码是否包含有效图表类型 */
export function isValidMermaidSyntax(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph)/m.test(
    trimmed,
  );
}

/** 为含特殊字符的节点标签加双引号，降低渲染失败率 */
export function quoteMermaidLabels(code: string): string {
  return code.replace(
    /(\w+)\[([^\]"\n]+)\]/g,
    (_match, id: string, label: string) => {
      const trimmed = label.trim();
      if (/["()]|[:/]|²|³|×|÷/.test(trimmed) && !trimmed.startsWith('"')) {
        return `${id}["${trimmed.replace(/"/g, "'")}"]`;
      }
      return `${id}[${trimmed}]`;
    },
  );
}

/** 清理并修复 Mermaid 源码，失败返回 null */
export function prepareMermaidCode(raw: string): string | null {
  let code = stripMermaidFences(raw);
  if (!code) return null;
  code = quoteMermaidLabels(code);
  if (!isValidMermaidSyntax(code)) return null;
  return code;
}
