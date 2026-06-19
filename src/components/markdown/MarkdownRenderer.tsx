import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { splitContentWithQuizzes, QuizCard } from "@/components/quiz/QuizRenderer";
import MermaidDiagram from "./MermaidDiagram";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  knowledgeName?: string;
  onQuizSubmitted?: () => void;
}

/**
 * 预处理 LaTeX 公式格式
 * AI 可能输出各种非标准格式，统一转换为 remark-math 支持的标准格式
 */
function preprocessMath(content: string): string {
  return (
    content
      // 块级公式：\[ ... \] → $$...$$
      .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, "$$$$$1$$$$")
      // 行内公式：\( ... \) → $...$
      .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, "$$$1$$")
      // AI 常输出的 [ \frac{...}{...} ] 格式（方括号包裹的LaTeX）→ $$...$$
      // 匹配独立行的 [ 开头，包含 \command 的 LaTeX 代码，] 结尾
      .replace(
        /^\[\s*\n?\s*(\\[a-zA-Z]+.*?)\s*\n?\s*\]$/gm,
        "$$$$$1$$$$"
      )
      // 更宽松的匹配：行首的 [ 后面紧跟反斜杠命令
      .replace(/^\[\s*(\\.+?)\s*\]$/gm, "$$$$$1$$$$")
  );
}

/**
 * MarkdownRenderer - 支持公式、代码高亮、quiz 的 Markdown 渲染器
 *
 * 公式支持：
 * - 行内公式：$E = mc^2$
 * - 块级公式：$$...$$
 * - 使用 remark-math + rehype-katex 渲染
 */
export default function MarkdownRenderer({
  content,
  className = "",
  knowledgeName = "",
  onQuizSubmitted,
}: MarkdownRendererProps) {
  // 预处理 LaTeX 公式格式
  const processedContent = preprocessMath(content);
  // 分割内容：普通文本和quiz块
  const parts = splitContentWithQuizzes(processedContent);

  return (
    <div className={`markdown-body ${className}`}>
      {parts.map((part, i) => {
        if (part.type === "quiz") {
          return (
            <QuizCard
              key={`quiz-${i}`}
              quiz={part.quiz}
              knowledgeName={knowledgeName || "当前知识点"}
              onSubmitted={onQuizSubmitted}
            />
          );
        }

        // 普通文本用 ReactMarkdown 渲染（含公式支持）
        return (
          <ReactMarkdown
            key={`md-${i}`}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

/** 共享的 Markdown 组件配置 */
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeString = String(children).replace(/\n$/, "");

    if (language === "mermaid") {
      return <MermaidDiagram chart={codeString} />;
    }

    if (language) {
      return (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: "1rem 0",
            borderRadius: "12px",
            fontSize: "0.85rem",
            lineHeight: "1.6",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      );
    }

    return (
      <code
        className="px-1.5 py-0.5 rounded text-sm"
        style={{ background: "rgba(110, 86, 207, 0.15)", color: "#A78BFA" }}
        {...props}
      >
        {children}
      </code>
    );
  },
  h1: ({ children }) => (
    <h1 className="text-2xl font-semibold mt-6 mb-4" style={{ color: "var(--text-primary)" }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-3" style={{ color: "var(--text-primary)" }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 pl-6 list-disc" style={{ color: "var(--text-tertiary)" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 pl-6 list-decimal" style={{ color: "var(--text-tertiary)" }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li className="my-1.5">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-[#6E56CF] pl-4 my-4 italic" style={{ color: "var(--text-secondary)" }}>
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: "var(--table-th-bg)" }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold" style={{ border: "1px solid var(--table-border)" }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2" style={{ border: "1px solid var(--table-border)" }}>
      {children}
    </td>
  ),
};
