import { useCallback, useEffect, useRef, useState } from "react";
import { playSpeechPipeline } from "@/services/ttsService";

export type TtsStatus = "idle" | "loading" | "playing";

export function useTtsPlayer() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveId(null);
    setStatus("idle");
    setProgress(null);
  }, []);

  const play = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) {
        setError("没有可朗读的内容");
        return;
      }

      if (activeId === id && (status === "playing" || status === "loading")) {
        stop();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setActiveId(id);
      setStatus("loading");
      setError(null);
      setProgress(null);

      try {
        await playSpeechPipeline(
          text,
          {
            onFirstSentence: () => setStatus("playing"),
            onProgress: (current, total) => setProgress({ current, total }),
          },
          controller.signal,
        );

        if (!controller.signal.aborted) {
          stop();
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "语音播报失败";
        setError(message);
        stop();
      }
    },
    [activeId, status, stop],
  );

  const getStatus = useCallback(
    (id: string): TtsStatus => (activeId === id ? status : "idle"),
    [activeId, status],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  return { play, stop, error, getStatus, activeId, status, progress };
}
