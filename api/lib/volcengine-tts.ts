import { randomUUID } from "crypto";
import { env } from "./env";
import {
  markdownToSpeechText,
  splitTextForStreaming,
  truncateForTts,
} from "./text-for-tts";

const TTS_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

type TtsChunkResponse = {
  code: number;
  message?: string;
  data?: string | null;
};

export type TtsSegment = {
  index: number;
  total: number;
  audio: Buffer;
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": env.volcengineTtsResourceId,
    "X-Api-Request-Id": randomUUID(),
  };

  if (env.volcengineTtsApiKey) {
    headers["X-Api-Key"] = env.volcengineTtsApiKey;
  } else {
    headers["X-Api-App-Id"] = env.volcengineTtsAppId;
    headers["X-Api-Access-Key"] = env.volcengineTtsAccessKey;
  }

  return headers;
}

function assertTtsConfigured() {
  if (!env.volcengineTtsApiKey && !env.volcengineTtsAccessKey) {
    throw new Error("TTS 未配置，请在 .env 中设置 VOLCENGINE_TTS_API_KEY");
  }
}

function parseJsonLines(buffer: string): { remaining: string; objects: TtsChunkResponse[] } {
  const lines = buffer.split("\n");
  const remaining = lines.pop() ?? "";
  const objects: TtsChunkResponse[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      objects.push(JSON.parse(trimmed) as TtsChunkResponse);
    } catch {
      // 忽略不完整行
    }
  }

  return { remaining, objects };
}

function handleChunk(obj: TtsChunkResponse, audioParts: Buffer[]): boolean {
  if (obj.code === 20000000) {
    return true;
  }

  if (obj.code === 0 && obj.data) {
    audioParts.push(Buffer.from(obj.data, "base64"));
    return false;
  }

  if (obj.code !== 0) {
    throw new Error(obj.message || `TTS 合成失败 (code: ${obj.code})`);
  }

  return false;
}

async function synthesizeSegmentText(text: string): Promise<Buffer> {
  const payload = {
    user: { uid: "yizhi-user" },
    req_params: {
      text,
      speaker: env.volcengineTtsSpeaker,
      audio_params: {
        format: env.volcengineTtsFormat,
        sample_rate: env.volcengineTtsSampleRate,
      },
      additions: JSON.stringify({ disable_markdown_filter: true }),
    },
  };

  const response = await fetch(TTS_URL, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`TTS 请求失败 (${response.status}): ${errText.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error("TTS 响应为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const audioParts: Buffer[] = [];
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseJsonLines(buffer);
    buffer = parsed.remaining;

    for (const obj of parsed.objects) {
      if (handleChunk(obj, audioParts)) {
        finished = true;
        break;
      }
    }
    if (finished) break;
  }

  if (buffer.trim()) {
    try {
      handleChunk(JSON.parse(buffer.trim()) as TtsChunkResponse, audioParts);
    } catch {
      // 忽略尾部解析失败
    }
  }

  if (audioParts.length === 0) {
    throw new Error("TTS 未返回音频数据");
  }

  return Buffer.concat(audioParts);
}

export function prepareSpeechText(rawText: string): string {
  const text = truncateForTts(markdownToSpeechText(rawText));
  if (!text) {
    throw new Error("没有可朗读的文本内容");
  }
  return text;
}

/** 整段合成（短文本） */
export async function synthesizeSpeech(rawText: string): Promise<Buffer> {
  assertTtsConfigured();
  const text = prepareSpeechText(rawText);
  return synthesizeSegmentText(text);
}

/** 分段流式合成：每完成一段立即 yield，前端可边收边播 */
export async function* streamSpeechSegments(rawText: string): AsyncGenerator<TtsSegment> {
  assertTtsConfigured();
  const text = prepareSpeechText(rawText);
  const segments = splitTextForStreaming(text);
  const total = segments.length;

  for (let index = 0; index < total; index++) {
    const audio = await synthesizeSegmentText(segments[index]);
    yield { index, total, audio };
  }
}
