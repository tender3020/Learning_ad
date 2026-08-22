import { memo, useMemo, useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { splitContentWithQuizzes, QuizCard } from "@/components/quiz/QuizRenderer";
import MermaidDiagram from "./MermaidDiagram";
import { stripIllustrationMarkers } from "@shared/illustrationMarkers";

export type MarkdownVariant = "default" | "reading";

type CodeScheme = "light" | "dark";

function resolveCodeScheme(el: HTMLElement): CodeScheme {
  const host = el.closest(".reading-shell") ?? document.documentElement;
  const scheme = getComputedStyle(host).getPropertyValue("--code-scheme").trim();
  return scheme === "light" ? "light" : "dark";
}

function useCodeScheme(containerRef: React.RefObject<HTMLElement | null>) {
  const [scheme, setScheme] = useState<CodeScheme>("dark");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setScheme(resolveCodeScheme(el));
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const readingShell = el.closest(".reading-shell");
    if (readingShell) {
      observer.observe(readingShell, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, [containerRef]);

  return scheme;
}

interface HighlightedCodeProps {
  language: string;
  codeString: string;
}

function HighlightedCode({ language, codeString }: HighlightedCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scheme = useCodeScheme(containerRef);
  const prismStyle = scheme === "light" ? oneLight : vscDarkPlus;

  return (
    <div ref={containerRef}>
      <SyntaxHighlighter
        style={prismStyle}
        language={language}
        PreTag="div"
        customStyle={{
          margin: "1rem 0",
          borderRadius: "12px",
          fontSize: "0.85rem",
          lineHeight: "1.6",
          background: "var(--pre-bg)",
          border: "1px solid var(--pre-border)",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  knowledgeName?: string;
  onQuizSubmitted?: () => void;
  variant?: MarkdownVariant;
  deferMermaidRender?: boolean;
}

/**
 * 预处理 LaTeX 公式格式
 * AI 可能输出各种非标准格式，统一转换为 remark-math 支持的标准格式
 */
function preprocessMath(content: string): string {
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

function preprocessContent(content: string): string {
  return preprocessMath(stripIllustrationMarkers(content));
}

const ALLOWED_PUBLIC_IMAGES = new Set([
  "/logo.png",
  "/ai-avatar.png",
  "/hero-bg.jpg",
]);

function isAllowedMarkdownImageSrc(src: string | undefined): boolean {
  if (!src?.trim()) return false;
  if (src.startsWith("/uploads/")) return true;
  if (/^https?:\/\//i.test(src)) return true;
  return ALLOWED_PUBLIC_IMAGES.has(src);
}

function MarkdownRenderer({
  content,
  className = "",
  knowledgeName = "",
  onQuizSubmitted,
  variant = "default",
  deferMermaidRender = false,
}: MarkdownRendererProps) {
  const processedContent = preprocessContent(content);
  const parts = splitContentWithQuizzes(processedContent);
  const markdownComponents = useMemo(
    () => getMarkdownComponents(variant, deferMermaidRender),
    [variant, deferMermaidRender],
  );

  return (
    <div className={`markdown-body ${variant === "reading" ? "reading" : ""} ${className}`}>
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

function getMarkdownComponents(
  variant: MarkdownVariant,
  deferMermaidRender: boolean,
): React.ComponentProps<typeof ReactMarkdown>["components"] {
  const isReading = variant === "reading";

  return {
    pre({ children }) {
      return <>{children}</>;
    },
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const codeString = String(children).replace(/\n$/, "");

      if (language === "mermaid") {
        return <MermaidDiagram chart={codeString} deferRender={deferMermaidRender} />;
      }

      const isBlock = Boolean(language) || codeString.includes("\n");
      if (isBlock) {
        return (
          <HighlightedCode
            language={language || "text"}
            codeString={codeString}
          />
        );
      }

      return (
        <code
          className={`px-1.5 py-0.5 rounded text-sm ${isReading ? "reading-inline-code" : ""}`}
          style={
            isReading
              ? { background: "var(--code-bg)", color: "var(--code-color)" }
              : { background: "rgba(110, 86, 207, 0.15)", color: "#A78BFA" }
          }
          {...props}
        >
          {children}
        </code>
      );
    },
    h1: ({ children }) => (
      <h1
        className={isReading ? "reading-h1" : "text-2xl font-semibold mt-6 mb-4"}
        style={{ color: "var(--reading-text-heading, var(--text-primary))" }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={isReading ? "reading-h3" : "text-xl font-semibold mt-5 mb-3"}
        style={{ color: "var(--reading-text-heading, var(--text-primary))" }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={isReading ? "reading-h3" : "text-lg font-semibold mt-4 mb-2"}
        style={{ color: "var(--reading-text-heading, var(--text-primary))" }}
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p
        className={isReading ? "reading-p" : "my-3 leading-relaxed"}
        style={{ color: "var(--reading-text-body, var(--text-tertiary))" }}
      >
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        className={isReading ? "reading-ul" : "my-3 pl-6 list-disc"}
        style={{ color: "var(--reading-text-body, var(--text-tertiary))" }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={isReading ? "reading-ol" : "my-3 pl-6 list-decimal"}
        style={{ color: "var(--reading-text-body, var(--text-tertiary))" }}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={isReading ? "reading-li" : "my-1.5"}>{children}</li>
    ),
    hr: () => (
      <hr
        className="reading-hr"
        style={{
          border: "none",
          height: "1px",
          background: "var(--reading-card-border, rgba(255,255,255,0.06))",
          margin: "1.5rem 0",
        }}
      />
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={
          isReading
            ? "reading-blockquote"
            : "border-l-[3px] border-[#6E56CF] pl-4 my-4 italic"
        }
        style={{ color: isReading ? "var(--reading-text-body, var(--text-tertiary))" : "var(--reading-text-muted, var(--text-secondary))" }}
      >
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
    img: ({ src, alt }) => {
      if (!isAllowedMarkdownImageSrc(src)) return null;
      return (
        <img
          src={src}
          alt={alt ?? ""}
          className="content-illustration"
          loading="lazy"
        />
      );
    },
  };
}

export default memo(MarkdownRenderer);
