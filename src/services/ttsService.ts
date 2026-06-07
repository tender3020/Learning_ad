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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

type SegmentEvent = {
  index: number;
  total: number;
  audio: string;
};

export type StreamTtsCallbacks = {
  onFirstSegment?: () => void;
  onProgress?: (index: number, total: number) => void;
};

function parseSseEvents(
  buffer: string,
): { remaining: string; events: Array<{ event: string; data: string }> } {
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() ?? "";
  const events: Array<{ event: string; data: string }> = [];

  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }

  return { remaining, events };
}

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

/** SSE 分段流式 TTS：收到第一段即可开始播放 */
export async function streamSpeechAudio(
  text: string,
  callbacks: StreamTtsCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/tts/stream", {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || `语音合成失败 (${response.status})`);
  }

  if (!response.body) {
    throw new Error("无法读取语音流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const queue: Blob[] = [];
  let firstSegment = true;
  let segmentCount = 0;
  let processing = false;
  let streamFinished = false;

  const processQueue = async (): Promise<void> => {
    if (processing) return;
    processing = true;
    try {
      while (queue.length > 0) {
        if (signal?.aborted) return;
        const blob = queue.shift()!;
        await playBlob(blob, signal);
      }
    } finally {
      processing = false;
      if (queue.length > 0) {
        await processQueue();
      }
    }
  };

  const waitUntilDone = async () => {
    while (!streamFinished || queue.length > 0 || processing) {
      if (signal?.aborted) return;
      await new Promise((r) => setTimeout(r, 30));
    }
  };

  const enqueueSegment = (segment: SegmentEvent) => {
    queue.push(base64ToBlob(segment.audio, "audio/mpeg"));
    segmentCount++;
    callbacks.onProgress?.(segment.index + 1, segment.total);

    if (firstSegment) {
      firstSegment = false;
      callbacks.onFirstSegment?.();
    }
    void processQueue();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(buffer);
      buffer = parsed.remaining;

      for (const { event, data } of parsed.events) {
        if (event === "error") {
          const err = JSON.parse(data) as { error?: string };
          throw new Error(err.error || "语音合成失败");
        }

        if (event === "segment") {
          enqueueSegment(JSON.parse(data) as SegmentEvent);
        }
      }
    }

    streamFinished = true;

    if (segmentCount === 0) {
      throw new Error("未收到语音数据");
    }

    await waitUntilDone();
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }
}

/** 短文本一次性合成（兼容保留） */
export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const response = await fetch("/api/tts/speak", {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || `语音合成失败 (${response.status})`);
  }

  return response.blob();
}
