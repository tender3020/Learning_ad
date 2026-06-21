import { memo, useMemo } from "react";
import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import { splitContentWithQuizzes, QuizCard } from "@/components/quiz/QuizRenderer";
import SectionCard from "./SectionCard";
import {
  buildTocFromTextParts,
  createHeadingIdState,
  getSectionAccent,
  splitMarkdownByH2,
} from "./sectionUtils";

interface ReadingMarkdownProps {
  content: string;
  knowledgeName?: string;
  onQuizSubmitted?: () => void;
  deferMermaidRender?: boolean;
}

export function getReadingTocItems(content: string) {
  const parts = splitContentWithQuizzes(content);
  const textParts = parts
    .filter((part): part is { type: "text"; content: string } => part.type === "text")
    .map((part) => part.content);
  return buildTocFromTextParts(textParts);
}

function ReadingMarkdown({
  content,
  knowledgeName = "",
  onQuizSubmitted,
  deferMermaidRender = false,
}: ReadingMarkdownProps) {
  const blocks = useMemo(() => {
    const parts = splitContentWithQuizzes(content);
    const headingState = createHeadingIdState();

    return parts.map((part) => {
      if (part.type === "quiz") {
        return { type: "quiz" as const, quiz: part.quiz };
      }
      return {
        type: "sections" as const,
        sections: splitMarkdownByH2(part.content, headingState),
      };
    });
  }, [content]);

  return (
    <div className="reading-markdown">
      {blocks.map((block, blockIndex) => {
        if (block.type === "quiz") {
          return (
            <div key={`quiz-${blockIndex}`} className="reading-quiz-wrap">
              <QuizCard
                quiz={block.quiz}
                knowledgeName={knowledgeName || "当前知识点"}
                onSubmitted={onQuizSubmitted}
              />
            </div>
          );
        }

        if (block.sections.length === 0) return null;

        return block.sections.map((section, sectionIndex) => (
          <SectionCard
            key={`section-${blockIndex}-${sectionIndex}`}
            id={section.id}
            title={section.title}
            accent={getSectionAccent(section.title)}
          >
            <MarkdownRenderer
              content={section.body}
              knowledgeName={knowledgeName}
              onQuizSubmitted={onQuizSubmitted}
              variant="reading"
              className="reading"
              deferMermaidRender={deferMermaidRender}
            />
          </SectionCard>
        ));
      })}
    </div>
  );
}

export default memo(ReadingMarkdown);
