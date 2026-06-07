import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { generationTasks } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const generationRouter = createRouter({
  // 创建生成任务
  createTask: authedQuery
    .input(
      z.object({
        planId: z.number(),
        taskType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const result = await db.insert(generationTasks).values({
        userId,
        planId: input.planId,
        taskType: input.taskType,
        status: "pending",
        progress: 0,
        currentStage: "准备中...",
      });

      return { taskId: Number(result[0].insertId) };
    }),

  // 更新任务状态
  updateTask: authedQuery
    .input(
      z.object({
        taskId: z.number(),
        status: z.enum([
          "pending",
          "analyzing",
          "generating_outline",
          "generating_content",
          "completed",
          "failed",
        ]),
        progress: z.number().min(0).max(100),
        currentStage: z.string().optional(),
        resultId: z.number().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const updates: Record<string, unknown> = {
        status: input.status,
        progress: input.progress,
        updatedAt: new Date(),
      };

      if (input.currentStage !== undefined) {
        updates.currentStage = input.currentStage;
      }
      if (input.resultId !== undefined) {
        updates.resultId = input.resultId;
      }
      if (input.errorMessage !== undefined) {
        updates.errorMessage = input.errorMessage;
      }

      await db
        .update(generationTasks)
        .set(updates)
        .where(
          and(
            eq(generationTasks.id, input.taskId),
            eq(generationTasks.userId, userId)
          )
        );

      return { success: true };
    }),

  // 获取任务状态
  getTask: authedQuery
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const tasks = await db
        .select()
        .from(generationTasks)
        .where(
          and(
            eq(generationTasks.id, input.taskId),
            eq(generationTasks.userId, userId)
          )
        )
        .limit(1);

      return tasks[0] || null;
    }),

  // 获取计划的最新任务
  getLatestTask: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const tasks = await db
        .select()
        .from(generationTasks)
        .where(
          and(
            eq(generationTasks.planId, input.planId),
            eq(generationTasks.userId, userId)
          )
        )
        .orderBy(desc(generationTasks.createdAt))
        .limit(1);

      return tasks[0] || null;
    }),

  // 获取任务历史
  getTaskHistory: authedQuery
    .input(
      z.object({
        planId: z.number(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const tasks = await db
        .select()
        .from(generationTasks)
        .where(
          and(
            eq(generationTasks.planId, input.planId),
            eq(generationTasks.userId, userId)
          )
        )
        .orderBy(desc(generationTasks.createdAt))
        .limit(input.limit);

      return tasks;
    }),
});
