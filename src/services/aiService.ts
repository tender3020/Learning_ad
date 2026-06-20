import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { LearningType } from "@shared/typeEngine";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

type OutlineItem = {
  dayNumber: number;
  title: string;
  goal: string;
  keywords: string;
  estimatedMinutes: number;
};

type AssessmentQuestion = {
  questionIndex: number;
  question: string;
  optionsA: string;
  optionsB: string;
  optionsC: string;
  optionsD: string;
  correctAnswer: string;
  explanation: string;
  difficulty: "basic" | "intermediate" | "advanced" | "expert";
};

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = localStorage.getItem("yizhi_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

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

/** 将浏览器 fetch 原生错误转为可操作的提示 */
function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "未知错误";

  const msg = error.message.toLowerCase();
  if (
    error.name === "TypeError" &&
    (msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed"))
  ) {
    return "无法连接服务器，请确认已在项目目录运行 npm run dev，并访问 http://localhost:3000";
  }
  if (error.name === "AbortError") {
    return "请求已取消";
  }
  return error.message;
}

export interface QAStreamCallbacks extends StreamCallbacks {
  onDone?: (qaId: number) => void;
}

/**
 * AI 服务类 - 通过后端 API 调用 DeepSeek（密钥保存在服务端 .env）
 */
export class AIService {
  private abortController: AbortController | null = null;
  private qaAbortController: AbortController | null = null;

  async detectLearningType(goal: string): Promise<{ type: LearningType; reason: string }> {
    return trpcClient.ai.detectLearningType.mutate({ goal });
  }

  async generateOutline(
    goal: string,
    totalDays: number,
    learningType: LearningType = "abstract_logic",
    skillLevel: string = "l1",
  ): Promise<OutlineItem[]> {
    return trpcClient.ai.generateOutline.mutate({
      goal,
      totalDays,
      learningType,
      skillLevel,
    });
  }

  async generateAssessmentQuestions(
    goal: string,
    learningType: LearningType = "abstract_logic",
  ): Promise<AssessmentQuestion[]> {
    return trpcClient.ai.generateAssessmentQuestions.mutate({
      goal,
      learningType,
    });
  }

  async askAI(question: string, context: string): Promise<string> {
    return trpcClient.ai.ask.mutate({ question, context });
  }

  async streamQA(
    planId: number,
    dayNumber: number,
    question: string,
    callbacks: QAStreamCallbacks,
  ): Promise<void> {
    this.qaAbortController = new AbortController();

    try {
      const response = await fetch("/api/ai/qa/stream", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ planId, dayNumber, question }),
        signal: this.qaAbortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `API 请求失败: ${response.status}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              type?: string;
              qaId?: number;
              choices?: Array<{ delta?: { content?: string } }>;
            };

            if (parsed.type === "done") {
              callbacks.onDone?.(parsed.qaId || 0);
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              callbacks.onToken(content);
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        callbacks.onError("回答已取消");
      } else {
        callbacks.onError(formatFetchError(error));
      }
    }
  }

  async streamContent(
    prompt: string,
    learningType: LearningType = "abstract_logic",
    skillLevel: string = "l1",
    callbacks: StreamCallbacks,
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ prompt, learningType, skillLevel }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `API 请求失败: ${response.status}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              callbacks.onToken(content);
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        callbacks.onError("生成已取消");
      } else {
        callbacks.onError(formatFetchError(error));
      }
    }
  }

  abort() {
    this.abortController?.abort();
  }

  abortQA() {
    this.qaAbortController?.abort();
  }
}

export const aiService = new AIService();
