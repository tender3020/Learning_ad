export type { MarkdownSection } from "@shared/markdownSections";
export {
  slugifyHeading,
  splitMarkdownByH2,
  extractTocFromMarkdown,
} from "@shared/markdownSections";

export type SectionAccent = "default" | "purple" | "orange" | "green" | "blue";

export function getSectionAccent(title: string | null): SectionAccent {
  if (!title) return "default";
  if (/安全|须知|警告/.test(title)) return "orange";
  if (/叙事|场景|对话|故事/.test(title)) return "purple";
  if (/小结|总结|回顾/.test(title)) return "green";
  if (/概念|模型|核心|目标/.test(title)) return "blue";
  return "default";
}
