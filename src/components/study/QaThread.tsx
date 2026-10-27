import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import TtsButton from "@/components/TtsButton";
import type { TtsStatus } from "@/hooks/useTtsPlayer";

export type QaMessage = { type: "user" | "ai"; text: string };

const STICK_THRESHOLD = 72;

type QaThreadProps = {
  messages: QaMessage[];
  isTyping: boolean;
  variant: "mobile" | "desktop";
  ttsIdPrefix: string;
  getStatus: (id: string) => TtsStatus;
  onPlay: (id: string, text: string) => void;
  empty: ReactNode;
  className: string;
};

function QaThread({
  messages,
  isTyping,
  variant,
  ttsIdPrefix,
  getStatus,
  onPlay,
  empty,
  className,
}: QaThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const countRef = useRef(0);
  const touchingRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const updateStick = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickRef.current = distance < STICK_THRESHOLD;
    };
    let lastY = 0;
    const onTouchStart = (event: TouchEvent) => {
      lastY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y > lastY + 6) stickRef.current = false;
      lastY = y;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) stickRef.current = false;
    };

    el.addEventListener("scroll", updateStick, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("scroll", updateStick);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const previous = countRef.current;
    const added = messages.length - previous;
    if (added > 0 && (previous === 0 || added <= 2)) stickRef.current = true;
    countRef.current = messages.length;
    if (!stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const showPlaceholder =
    isTyping && messages[messages.length - 1]?.type === "ai" && !messages[messages.length - 1]?.text;

  return (
    <div
      ref={scrollerRef}
      className={className}
      style={{ overflowAnchor: "none", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
    >
      {messages.length === 0 && empty}
      <div className="space-y-4">
        {messages.map((message, index) => {
          const streaming = isTyping && index === messages.length - 1 && message.type === "ai";
          if (streaming && !message.text) return null;
          return (
            <QaRow
              key={`${message.type}-${index}`}
              message={message}
              variant={variant}
              streaming={streaming}
              showTts={message.type === "ai" && !!message.text && !streaming}
              ttsId={`${ttsIdPrefix}-${index}`}
              status={getStatus(`${ttsIdPrefix}-${index}`)}
              onPlay={onPlay}
            />
          );
        })}
        {showPlaceholder && <TypingDots variant={variant} />}
      </div>
    </div>
  );
}

const QaRow = memo(function QaRow({
  message,
  variant,
  streaming,
  showTts,
  ttsId,
  status,
  onPlay,
}: {
  message: QaMessage;
  variant: "mobile" | "desktop";
  streaming: boolean;
  showTts: boolean;
  ttsId: string;
  status: TtsStatus;
  onPlay: (id: string, text: string) => void;
}) {
  const isUser = message.type === "user";
  const bubbleClass =
    variant === "desktop"
      ? isUser
        ? "bg-token-brand text-[var(--brand-foreground)] rounded-br-md"
        : "liquid-glass text-token-primary rounded-bl-md"
      : "text-token-primary";
  const bubbleStyle =
    variant === "mobile"
      ? {
          backgroundColor: isUser ? "var(--surface-elevated)" : "var(--surface-hover)",
          borderBottomRightRadius: isUser ? 6 : 16,
          borderBottomLeftRadius: isUser ? 16 : 6,
        }
      : undefined;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 ${variant === "mobile" ? "max-w-[86%]" : "max-w-[85%]"} ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm ${bubbleClass}`} style={bubbleStyle}>
          {streaming ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <MarkdownRenderer content={message.text} />
          )}
        </div>
        {showTts && <TtsButton id={ttsId} text={message.text} status={status} onPlay={onPlay} />}
      </div>
    </div>
  );
});

function TypingDots({ variant }: { variant: "mobile" | "desktop" }) {
  return (
    <div className="flex justify-start">
      <div
        className={`px-4 py-3 rounded-2xl rounded-bl-md ${variant === "desktop" ? "liquid-glass" : ""}`}
        style={variant === "mobile" ? { backgroundColor: "var(--surface-hover)" } : undefined}
      >
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${variant === "desktop" ? "bg-token-brand" : "bg-token-primary/50"}`} style={{ animationDelay: "0ms" }} />
          <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${variant === "desktop" ? "bg-token-brand" : "bg-token-primary/50"}`} style={{ animationDelay: "150ms" }} />
          <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${variant === "desktop" ? "bg-token-brand" : "bg-token-primary/50"}`} style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default memo(QaThread);
