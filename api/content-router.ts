import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { learningContents, learningPlans, learningOutline } from "@db/schema";
import { eq, and } from "drizzle-orm";
import type { LearningType } from "@shared/typeEngine";
import {
  generateContentIllustrations,
  illustrationsExistOnDisk,
  illustrationsMatchTargetRatio,
  shouldSkipIllustrationGeneration,
} from "./services/contentImageService";
import { isWanxiangConfigured } from "./lib/wanxiang-image";

type Db = ReturnType<typeof getDb>;

export async function runIllustrationJob(
  db: Db,
  userId: number,
  planId: number,
  dayNumber: number,
): Promise<{
  imageCount: number;
  skipped: boolean;
  alreadyExists?: boolean;
  reason?: string;
}> {
  if (!isWanxiangConfigured()) {
    console.warn(
      "[content-image] 跳过配图：DASHSCOPE_API_KEY 未加载（请重启 dev 服务后再试）",
    );
    return { imageCount: 0, skipped: true, reason: "no_api_key" };
  }

  const [contentRows, planRows, outlineRows] = await Promise.all([
    db
      .select()
      .from(learningContents)
      .where(
        and(
          eq(learningContents.planId, planId),
          eq(learningContents.dayNumber, dayNumber),
        ),
      )
      .limit(1),
    db
      .select({ learningType: learningPlans.learningType })
      .from(learningPlans)
      .where(
        and(eq(learningPlans.id, planId), eq(learningPlans.userId, userId)),
      )
      .limit(1),
    db
      .select({ title: learningOutline.title })
      .from(learningOutline)
      .where(
        and(
          eq(learningOutline.planId, planId),
          eq(learningOutline.dayNumber, dayNumber),
        ),
      )
      .limit(1),
  ]);

  const content = contentRows[0];
  const plan = planRows[0];
  if (!content?.markdownContent?.trim() || !plan) {
    return { imageCount: 0, skipped: true, reason: "no_content" };
  }

  const dayTitle = outlineRows[0]?.title || `第 ${dayNumber} 天`;
  const learningType = (plan.learningType as LearningType) || "abstract_logic";

  if (await shouldSkipIllustrationGeneration(content.markdownContent, planId, dayNumber)) {
    console.info(
      `[content-image] 跳过配图：plan=${planId} day=${dayNumber}（已有 3:2 配图）`,
    );
    return { imageCount: 0, skipped: true, alreadyExists: true };
  }

  const hasOldRatio =
    (await illustrationsExistOnDisk(planId, dayNumber)) &&
    !(await illustrationsMatchTargetRatio(planId, dayNumber));
  if (hasOldRatio) {
    console.info(
      `[content-image] 检测到非 3:2 旧配图，将重新生成 plan=${planId} day=${dayNumber}`,
    );
  }

  console.info(
    `[content-image] 开始生成配图 plan=${planId} day=${dayNumber} type=${learningType}`,
  );

  const { imageCount, markdownContent } = await generateContentIllustrations({
    planId,
    dayNumber,
    dayTitle,
    learningType,
    markdownContent: content.markdownContent,
  });

  if (imageCount > 0 && markdownContent !== content.markdownContent) {
    await db
      .update(learningContents)
      .set({ markdownContent, updatedAt: new Date() })
      .where(eq(learningContents.id, content.id));
  }

  console.info(
    `[content-image] 配图完成 plan=${planId} day=${dayNumber} images=${imageCount}`,
  );

  return { imageCount, skipped: imageCount === 0 };
}

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
    .mutation(async ({ ctx, input }) => {
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

      let savedId: number;
      let updated: boolean;

      if (existing.length > 0) {
        await db
          .update(learningContents)
          .set({
            markdownContent: input.markdownContent,
            isGenerated: "completed",
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(learningContents.id, existing[0].id));

        savedId = existing[0].id;
        updated = true;
      } else {
        const result = await db.insert(learningContents).values({
          planId: input.planId,
          outlineId: input.outlineId,
          dayNumber: input.dayNumber,
          markdownContent: input.markdownContent,
          isGenerated: "completed",
          generatedAt: new Date(),
        });

        savedId = Number(result[0].insertId);
        updated = false;
      }

      void runIllustrationJob(
        db,
        ctx.user.id,
        input.planId,
        input.dayNumber,
      ).catch((err) => {
        console.error(
          `[content-image] 后台任务失败 plan=${input.planId} day=${input.dayNumber}:`,
          err instanceof Error ? err.message : err,
        );
      });

      return { id: savedId, updated };
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

  // 根据学习类型为当日内容生成配图（2-3 张，3:2）
  generateIllustrations: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      return runIllustrationJob(
        db,
        ctx.user.id,
        input.planId,
        input.dayNumber,
      );
    }),
});
