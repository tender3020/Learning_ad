import { splitIntoSentences } from "@shared/textForTts";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("yizhi_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** 会话内音频缓存：同一句重复播放不重复计费 */
const sentenceAudioCache = new Map<string, Blob>();

export type PipelineTtsCallbacks = {
  onFirstSentence?: () => void;
  onProgress?: (current: number, total: number) => void;
};

function playBlob(blob: Blob, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const cleanup = () => {
      audio.pause();
      audio.src = "";
      URL.revokeObjectURL(url);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    audio.onended = () => {
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      reject(new Error("音频播放失败"));
    };

    audio.play().catch((err) => {
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      reject(err);
    });
  });
}

/** 合成单句（带缓存 + 可 abort） */
async function fetchSentenceAudio(
  sentence: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const cached = sentenceAudioCache.get(sentence);
  if (cached) return cached;

  const response = await fetch("/api/tts/speak", {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ text: sentence }),
    signal,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || `语音合成失败 (${response.status})`);
  }

  const blob = await response.blob();
  sentenceAudioCache.set(sentence, blob);
  return blob;
}

/**
 * 句子级流水线（主流 AI 语音方案）：
 * 1. 按句号切分
 * 2. 仅合成当前句 + 预取下一句
 * 3. 停止后立即 abort，不再合成后续句子
 * 4. 已合成句子缓存，重播同句不重复计费
 */
export async function playSpeechPipeline(
  text: string,
  callbacks: PipelineTtsCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    throw new Error("没有可朗读的内容");
  }

  const total = sentences.length;
  let nextFetch: Promise<Blob> | null = fetchSentenceAudio(sentences[0], signal);

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return;

    const blob = await nextFetch!;

    if (i === 0) {
      callbacks.onFirstSentence?.();
    }
    callbacks.onProgress?.(i + 1, total);

    // 播放当前句的同时，预合成下一句
    if (i + 1 < total) {
      nextFetch = fetchSentenceAudio(sentences[i + 1], signal);
    }

    await playBlob(blob, signal);
  }
}

export function clearTtsCache() {
  sentenceAudioCache.clear();
}
