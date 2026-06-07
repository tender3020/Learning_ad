import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { qaHistory } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const qaRouter = createRouter({
  // 提交问题并保存（AI 回答在流式输出中处理）
  ask: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number().optional(),
        question: z.string().min(1, "问题不能为空"),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const result = await db.insert(qaHistory).values({
        userId,
        planId: input.planId,
        dayNumber: input.dayNumber || 0,
        question: input.question,
        context: input.context || null,
        answer: null,
        isAiGenerated: "true",
      });

      return {
        qaId: Number(result[0].insertId),
        question: input.question,
      };
    }),

  // 保存 AI 回答
  saveAnswer: authedQuery
    .input(
      z.object({
        qaId: z.number(),
        answer: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      await db
        .update(qaHistory)
        .set({ answer: input.answer })
        .where(
          and(
            eq(qaHistory.id, input.qaId),
            eq(qaHistory.userId, userId)
          )
        );

      return { success: true };
    }),

  // 获取问答历史
  getHistory: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const conditions = [
        eq(qaHistory.planId, input.planId),
        eq(qaHistory.userId, userId),
      ];

      if (input.dayNumber !== undefined) {
        conditions.push(eq(qaHistory.dayNumber, input.dayNumber));
      }

      const history = await db
        .select()
        .from(qaHistory)
        .where(and(...conditions))
        .orderBy(desc(qaHistory.createdAt))
        .limit(input.limit);

      return history;
    }),

  // 获取最近的问题（用于 AI context）
  getRecentQuestions: authedQuery
    .input(
      z.object({
        planId: z.number(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const history = await db
        .select({
          question: qaHistory.question,
          answer: qaHistory.answer,
        })
        .from(qaHistory)
        .where(
          and(
            eq(qaHistory.planId, input.planId),
            eq(qaHistory.userId, userId)
          )
        )
        .orderBy(desc(qaHistory.createdAt))
        .limit(input.limit);

      return history;
    }),
});
