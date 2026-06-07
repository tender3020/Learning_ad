import { useState, useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

interface StreamOutputProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export default function StreamOutput({ content, isStreaming, className = "" }: StreamOutputProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
      setCurrentIndex(content.length);
      return;
    }

    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        const nextIndex = Math.min(currentIndex + 3, content.length);
        setDisplayedContent(content.slice(0, nextIndex));
        setCurrentIndex(nextIndex);
      }, 30 + Math.random() * 50);

      return () => clearTimeout(timer);
    }
  }, [content, currentIndex, isStreaming]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedContent, isStreaming]);

  // Reset when content changes completely
  useEffect(() => {
    if (content.length < currentIndex) {
      setCurrentIndex(0);
      setDisplayedContent("");
    }
  }, [content]);

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <MarkdownRenderer content={displayedContent} />
      {isStreaming && currentIndex < content.length && (
        <span className="typing-cursor inline-block w-0.5 h-5 bg-[#6E56CF] ml-0.5 align-middle" />
      )}
    </div>
  );
}
