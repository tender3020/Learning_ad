import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { learningContents } from "@db/schema";
import { eq, and } from "drizzle-orm";

export const contentRouter = createRouter({
  // 获取某天的学习内容
  getContent: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const contents = await db
        .select()
        .from(learningContents)
        .where(
          and(
            eq(learningContents.planId, input.planId),
            eq(learningContents.dayNumber, input.dayNumber)
          )
        )
        .limit(1);

      if (contents.length === 0) {
        return null;
      }

      return contents[0];
    }),

  // 保存学习内容
  saveContent: authedQuery
    .input(
      z.object({
        planId: z.number(),
        outlineId: z.number(),
        dayNumber: z.number(),
        markdownContent: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 检查是否已存在
      const existing = await db
        .select()
        .from(learningContents)
        .where(
          and(
            eq(learningContents.planId, input.planId),
            eq(learningContents.dayNumber, input.dayNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // 更新
        await db
          .update(learningContents)
          .set({
            markdownContent: input.markdownContent,
            isGenerated: "completed",
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(learningContents.id, existing[0].id));

        return { id: existing[0].id, updated: true };
      } else {
        // 插入
        const result = await db.insert(learningContents).values({
          planId: input.planId,
          outlineId: input.outlineId,
          dayNumber: input.dayNumber,
          markdownContent: input.markdownContent,
          isGenerated: "completed",
          generatedAt: new Date(),
        });

        return { id: Number(result[0].insertId), updated: false };
      }
    }),

  // 更新内容生成状态
  updateStatus: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number(),
        status: z.enum(["pending", "generating", "completed", "failed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      await db
        .update(learningContents)
        .set({
          isGenerated: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(learningContents.planId, input.planId),
            eq(learningContents.dayNumber, input.dayNumber)
          )
        );

      return { success: true };
    }),

  // 获取计划的所有内容生成状态
  getContentStatuses: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const contents = await db
        .select({
          dayNumber: learningContents.dayNumber,
          isGenerated: learningContents.isGenerated,
          generatedAt: learningContents.generatedAt,
        })
        .from(learningContents)
        .where(eq(learningContents.planId, input.planId));

      return contents;
    }),
});
