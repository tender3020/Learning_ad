import { eq, and, asc } from "drizzle-orm";
import {
  qaHistory,
  learningPlans,
  learningOutline,
  learningContents,
} from "@db/schema";
import { getDb } from "../queries/connection";
import type { ChatMessage, DayQAContext } from "./aiService";

export const MAX_QA_HISTORY_TURNS = 20;

export class QAContextError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface PreparedQARequest {
  dayContext: DayQAContext;
  history: ChatMessage[];
  contextSnapshot: string;
  targetMinutes: number;
}

type Db = ReturnType<typeof getDb>;

export async function prepareQARequest(
  db: Db,
  userId: number,
  planId: number,
  dayNumber: number,
): Promise<PreparedQARequest> {
  const [planRows, outlineRows, contentRows, priorRows] = await Promise.all([
    db
      .select({
        goal: learningPlans.goal,
        learningType: learningPlans.learningType,
      })
      .from(learningPlans)
      .where(
        and(
          eq(learningPlans.id, planId),
          eq(learningPlans.userId, userId),
        ),
      )
      .limit(1),
    db
      .select({
        title: learningOutline.title,
        goal: learningOutline.goal,
        estimatedMinutes: learningOutline.estimatedMinutes,
      })
      .from(learningOutline)
      .where(
        and(
          eq(learningOutline.planId, planId),
          eq(learningOutline.dayNumber, dayNumber),
        ),
      )
      .limit(1),
    db
      .select({ markdownContent: learningContents.markdownContent })
      .from(learningContents)
      .where(
        and(
          eq(learningContents.planId, planId),
          eq(learningContents.dayNumber, dayNumber),
        ),
      )
      .limit(1),
    db
      .select({
        question: qaHistory.question,
        answer: qaHistory.answer,
      })
      .from(qaHistory)
      .where(
        and(
          eq(qaHistory.planId, planId),
          eq(qaHistory.userId, userId),
          eq(qaHistory.dayNumber, dayNumber),
        ),
      )
      .orderBy(asc(qaHistory.createdAt))
      .limit(MAX_QA_HISTORY_TURNS * 2),
  ]);

  const plan = planRows[0];
  if (!plan) {
    throw new QAContextError(404, "学习计划不存在");
  }

  const outline = outlineRows[0];
  const markdownContent = contentRows[0]?.markdownContent?.trim();
  if (!markdownContent) {
    throw new QAContextError(412, "请先生成今日学习内容后再提问");
  }

  const history: ChatMessage[] = [];
  for (const row of priorRows) {
    if (row.answer) {
      history.push({ role: "user", content: row.question });
      history.push({ role: "assistant", content: row.answer });
    }
  }

  const dayTitle = outline?.title || `第 ${dayNumber} 天`;

  return {
    dayContext: {
      planGoal: plan.goal,
      dayNumber,
      dayTitle,
      dayGoal: outline?.goal || "",
      learningType: plan.learningType,
      markdownContent,
    },
    history,
    contextSnapshot: `第${dayNumber}天 · ${dayTitle} | ${plan.goal}`,
    targetMinutes: outline?.estimatedMinutes ?? 30,
  };
}

export async function saveQARecord(
  db: Db,
  userId: number,
  planId: number,
  dayNumber: number,
  question: string,
  answer: string,
  contextSnapshot: string,
): Promise<number> {
  const result = await db.insert(qaHistory).values({
    userId,
    planId,
    dayNumber,
    question,
    answer,
    context: contextSnapshot,
    isAiGenerated: "true",
  });

  return Number(result[0].insertId);
}

/** 透传 DeepSeek SSE，并在流结束后写入问答记录 */
export async function pipeQAStreamWithSave(
  upstream: Response,
  onSave: (fullAnswer: string) => Promise<number>,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  if (!upstream.body) {
    throw new Error("无法读取 AI 响应流");
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sseBuffer = "";
  let fullAnswer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          if (signal?.aborted) {
            controller.close();
            return;
          }

          const { done, value } = await reader.read();
          if (done) {
            if (sseBuffer.trim()) {
              controller.enqueue(encoder.encode(sseBuffer));
              fullAnswer = appendAnswerFromSseChunk(sseBuffer, fullAnswer);
            }

            const qaId = fullAnswer.trim()
              ? await onSave(fullAnswer)
              : 0;

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done", qaId })}\n\n`,
              ),
            );
            controller.close();
            return;
          }

          const chunkText = decoder.decode(value, { stream: true });
          sseBuffer += chunkText;

          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            controller.enqueue(encoder.encode(line + "\n"));
            fullAnswer = appendAnswerFromSseLine(line, fullAnswer);
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function appendAnswerFromSseChunk(chunk: string, currentAnswer: string): string {
  let answer = currentAnswer;
  for (const line of chunk.split("\n")) {
    answer = appendAnswerFromSseLine(line, answer);
  }
  return answer;
}

function appendAnswerFromSseLine(line: string, currentAnswer: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) {
    return currentAnswer;
  }

  const data = trimmed.slice(6);
  if (data === "[DONE]") {
    return currentAnswer;
  }

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      return currentAnswer + content;
    }
  } catch {
    // 忽略非 JSON 行
  }

  return currentAnswer;
}
