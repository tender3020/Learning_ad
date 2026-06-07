import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { learningPlans, learningOutline, learningContents, quizResults, masteryScores, qaHistory, studySessions, assessments, assessmentAnswers } from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export const learningRouter = createRouter({
  // 创建学习计划
  createPlan: authedQuery
    .input(
      z.object({
        goal: z.string().min(1, "学习目标不能为空"),
        subject: z.string().optional(),
        totalDays: z.number().min(1).max(365).default(30),
        learningType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 类型映射
      const typeMapping: Record<string, string> = {
        abstract_logic: "abstract_logic",
        operation_logic: "operation_logic",
        language: "language",
        network_assoc: "network_assoc",
        model_apply: "model_apply",
        perception: "perception",
        practical: "practical",
      };

      const mappedType = typeMapping[input.learningType || ""] || "abstract_logic";

      const result = await db.insert(learningPlans).values({
        userId,
        goal: input.goal,
        subject: input.subject || input.goal,
        totalDays: input.totalDays,
        status: "active",
        currentDay: 1,
        learningType: mappedType as any,
      });

      const planId = Number(result[0].insertId);

      return {
        planId,
        message: "学习计划创建成功",
      };
    }),

  // 获取用户的所有学习计划
  getPlans: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const plans = await db
      .select()
      .from(learningPlans)
      .where(eq(learningPlans.userId, userId))
      .orderBy(desc(learningPlans.createdAt));

    return plans;
  }),

  // 获取单个学习计划详情
  getPlan: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const plans = await db
        .select()
        .from(learningPlans)
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        )
        .limit(1);

      if (plans.length === 0) {
        return null;
      }

      return plans[0];
    }),

  // 更新学习计划进度
  updateProgress: authedQuery
    .input(
      z.object({
        planId: z.number(),
        currentDay: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      await db
        .update(learningPlans)
        .set({
          currentDay: input.currentDay,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        );

      return { success: true };
    }),

  // 完成学习计划
  completePlan: authedQuery
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      await db
        .update(learningPlans)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        );

      return { success: true };
    }),

  // 保存学习大纲
  saveOutline: authedQuery
    .input(
      z.object({
        planId: z.number(),
        outline: z.array(
          z.object({
            dayNumber: z.number(),
            title: z.string(),
            goal: z.string().optional(),
            keywords: z.string().optional(),
            estimatedMinutes: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证计划属于当前用户
      const plans = await db
        .select()
        .from(learningPlans)
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        )
        .limit(1);

      if (plans.length === 0) {
        throw new Error("学习计划不存在");
      }

      // 删除旧的大纲
      await db
        .delete(learningOutline)
        .where(eq(learningOutline.planId, input.planId));

      // 插入新的大纲
      if (input.outline.length > 0) {
        await db.insert(learningOutline).values(
          input.outline.map((item) => ({
            planId: input.planId,
            dayNumber: item.dayNumber,
            title: item.title,
            goal: item.goal || null,
            keywords: item.keywords || null,
            estimatedMinutes: item.estimatedMinutes || 30,
          }))
        );
      }

      return { success: true, count: input.outline.length };
    }),

  // 获取学习大纲
  getOutline: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证计划属于当前用户
      const plans = await db
        .select()
        .from(learningPlans)
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        )
        .limit(1);

      if (plans.length === 0) {
        return { outline: [] as typeof learningOutline.$inferSelect[], learningType: "", goal: "" };
      }

      const outline = await db
        .select()
        .from(learningOutline)
        .where(eq(learningOutline.planId, input.planId))
        .orderBy(learningOutline.dayNumber);

      return {
        outline,
        learningType: (plans[0].learningType || "abstract_logic") as string,
        goal: plans[0].goal,
      };
    }),

  // ---- 删除学习计划（级联删除所有关联数据） ----
  deletePlan: authedQuery
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证计划属于当前用户
      const plans = await db
        .select()
        .from(learningPlans)
        .where(
          and(
            eq(learningPlans.id, input.planId),
            eq(learningPlans.userId, userId)
          )
        )
        .limit(1);

      if (plans.length === 0) {
        throw new Error("学习计划不存在或无权限删除");
      }

      // 1. 删除学习内容
      await db
        .delete(learningContents)
        .where(eq(learningContents.planId, input.planId));

      // 2. 删除学习大纲
      await db
        .delete(learningOutline)
        .where(eq(learningOutline.planId, input.planId));

      // 3. 删除答题记录
      await db
        .delete(quizResults)
        .where(eq(quizResults.planId, input.planId));

      // 4. 删除掌握度记录
      await db
        .delete(masteryScores)
        .where(eq(masteryScores.planId, input.planId));

      // 5. 删除问答历史
      await db
        .delete(qaHistory)
        .where(eq(qaHistory.planId, input.planId));

      // 6. 删除学习会话
      await db
        .delete(studySessions)
        .where(eq(studySessions.planId, input.planId));

      // 7. 删除评估及答题记录
      const assessmentList = await db
        .select({ id: assessments.id })
        .from(assessments)
        .where(eq(assessments.planId, input.planId));
      const assessmentIds = assessmentList.map((a) => a.id);
      if (assessmentIds.length > 0) {
        await db
          .delete(assessmentAnswers)
          .where(inArray(assessmentAnswers.assessmentId, assessmentIds));
        await db
          .delete(assessments)
          .where(eq(assessments.planId, input.planId));
      }

      // 8. 最后删除计划本身
      await db
        .delete(learningPlans)
        .where(eq(learningPlans.id, input.planId));

      return { success: true, deletedPlanId: input.planId };
    }),
});
