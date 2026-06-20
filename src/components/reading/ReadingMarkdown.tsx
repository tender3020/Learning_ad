import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import { splitContentWithQuizzes, QuizCard } from "@/components/quiz/QuizRenderer";
import SectionCard from "./SectionCard";
import {
  extractTocFromMarkdown,
  getSectionAccent,
  splitMarkdownByH2,
} from "./sectionUtils";

interface ReadingMarkdownProps {
  content: string;
  knowledgeName?: string;
  onQuizSubmitted?: () => void;
}

export function getReadingTocItems(content: string) {
  return extractTocFromMarkdown(content);
}

export default function ReadingMarkdown({
  content,
  knowledgeName = "",
  onQuizSubmitted,
}: ReadingMarkdownProps) {
  const parts = splitContentWithQuizzes(content);

  return (
    <div className="reading-markdown">
      {parts.map((part, partIndex) => {
        if (part.type === "quiz") {
          return (
            <div key={`quiz-${partIndex}`} className="reading-quiz-wrap">
              <QuizCard
                quiz={part.quiz}
                knowledgeName={knowledgeName || "当前知识点"}
                onSubmitted={onQuizSubmitted}
              />
            </div>
          );
        }

        const sections = splitMarkdownByH2(part.content);
        if (sections.length === 0) return null;

        return sections.map((section, sectionIndex) => (
          <SectionCard
            key={`section-${partIndex}-${sectionIndex}`}
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
            />
          </SectionCard>
        ));
      })}
    </div>
  );
}
