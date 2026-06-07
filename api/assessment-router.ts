import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { assessments, assessmentAnswers } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * ============================================================================
 * Skill Assessment Algorithm - 能力评估算法
 * ============================================================================
 *
 * 评估流程：
 * 1. AI 生成 5 道梯度测试题（基础→进阶→高级）
 * 2. 用户逐题作答
 * 3. 根据正确率和答对题目的最高难度综合评定等级
 *
 * 等级划分：
 * L1 (0-25%):   零基础     → 从最基础概念讲起，详细铺垫
 * L2 (25-50%):  入门       → 简要回顾基础，聚焦核心知识
 * L3 (50-75%):  中级       → 跳过基础，进阶内容+实战案例
 * L4 (75-90%):  进阶       → 深入高级主题，前沿技术
 * L5 (90%+):    高级       → 专家级内容，最佳实践和架构设计
 *
 * 评分规则：
 * - 基础题 correct: +10 分
 * - 进阶题 correct: +20 分
 * - 高级题 correct: +30 分
 * - 专家题 correct: +40 分
 * - 总分 100 分（5 题总分）
 * - 最终等级由总分和最高答对难度共同决定
 * ============================================================================
 */

const DIFFICULTY_SCORES: Record<string, number> = {
  basic: 10,
  intermediate: 20,
  advanced: 30,
  expert: 40,
};

const DIFFICULTY_ORDER = ["basic", "intermediate", "advanced", "expert"];

/** 根据得分和最高答对难度计算等级 */
function calculateSkillLevel(
  totalScore: number,
  maxCorrectDifficulty: string | null
): "l1" | "l2" | "l3" | "l4" | "l5" {
  // 根据总分初步定级
  if (totalScore >= 90) return "l5";
  if (totalScore >= 75) return "l4";
  if (totalScore >= 50) return "l3";
  if (totalScore >= 25) return "l2";

  // 如果总分低但答对了高难度题，适当上调
  if (maxCorrectDifficulty) {
    const diffIndex = DIFFICULTY_ORDER.indexOf(maxCorrectDifficulty);
    if (diffIndex >= 2 && totalScore >= 20) return "l2"; // 答对高级题但总分低
  }

  return "l1";
}

/** 生成等级说明 */
function generateLevelSummary(
  level: string,
  goal: string,
  correctCount: number,
  totalQuestions: number
): string {
  const rate = Math.round((correctCount / totalQuestions) * 100);
  const summaries: Record<string, string> = {
    l1: `你在 ${goal} 方面的基础尚在构建中。建议从最基础的概念开始学习，系统会为你安排详细的知识铺垫和大量实例讲解。`,
    l2: `你对 ${goal} 已有初步了解，但核心概念还需巩固。系统会简要回顾基础，聚焦核心知识点展开深入讲解。`,
    l3: `你已掌握 ${goal} 的基础内容，具备了进一步学习的能力。系统将跳过基础概念，直接为你安排进阶内容和实战案例。`,
    l4: `你对 ${goal} 有较深理解，处于进阶水平。系统会深入高级主题，讲解前沿技术和复杂场景应用。`,
    l5: `你在 ${goal} 方面已达到高级水平！系统会为你提供专家级内容，聚焦最佳实践、架构设计和前沿探索。`,
  };
  return `测试正确率 ${rate}%。${summaries[level] || summaries.l3}`;
}

export const assessmentRouter = createRouter({
  // ---- 创建评估记录（AI 生成题目后调用） ----
  create: authedQuery
    .input(
      z.object({
        planId: z.number(),
        goal: z.string(),
        questions: z.array(
          z.object({
            questionIndex: z.number(),
            question: z.string(),
            optionsA: z.string(),
            optionsB: z.string(),
            optionsC: z.string(),
            optionsD: z.string(),
            correctAnswer: z.string(),
            explanation: z.string(),
            difficulty: z.enum(["basic", "intermediate", "advanced", "expert"]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 创建评估记录
      const result = await db.insert(assessments).values({
        userId,
        planId: input.planId,
        goal: input.goal,
        status: "pending",
        totalQuestions: input.questions.length,
      });

      const assessmentId = Number(result[0].insertId);

      // 插入题目
      if (input.questions.length > 0) {
        await db.insert(assessmentAnswers).values(
          input.questions.map((q) => ({
            assessmentId,
            questionIndex: q.questionIndex,
            question: q.question,
            optionsA: q.optionsA,
            optionsB: q.optionsB,
            optionsC: q.optionsC,
            optionsD: q.optionsD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
          }))
        );
      }

      return { assessmentId };
    }),

  // ---- 获取评估题目列表 ----
  getQuestions: authedQuery
    .input(z.object({ assessmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证评估属于当前用户
      const assessment = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.id, input.assessmentId),
            eq(assessments.userId, userId)
          )
        )
        .limit(1);

      if (assessment.length === 0) {
        return null;
      }

      const questions = await db
        .select({
          id: assessmentAnswers.id,
          questionIndex: assessmentAnswers.questionIndex,
          question: assessmentAnswers.question,
          optionsA: assessmentAnswers.optionsA,
          optionsB: assessmentAnswers.optionsB,
          optionsC: assessmentAnswers.optionsC,
          optionsD: assessmentAnswers.optionsD,
          difficulty: assessmentAnswers.difficulty,
          userAnswer: assessmentAnswers.userAnswer,
          isCorrect: assessmentAnswers.isCorrect,
          explanation: assessmentAnswers.explanation,
          correctAnswer: assessmentAnswers.correctAnswer,
        })
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.assessmentId, input.assessmentId))
        .orderBy(assessmentAnswers.questionIndex);

      return {
        assessment: assessment[0],
        questions,
      };
    }),

  // ---- 提交单题答案 ----
  submitAnswer: authedQuery
    .input(
      z.object({
        answerId: z.number(),
        userAnswer: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 获取题目信息
      const question = await db
        .select()
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.id, input.answerId))
        .limit(1);

      if (question.length === 0) {
        throw new Error("题目不存在");
      }

      const q = question[0];

      // 验证评估属于当前用户
      const assessment = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.id, q.assessmentId),
            eq(assessments.userId, userId)
          )
        )
        .limit(1);

      if (assessment.length === 0) {
        throw new Error("无权操作");
      }

      const isCorrect = q.correctAnswer === input.userAnswer;

      await db
        .update(assessmentAnswers)
        .set({
          userAnswer: input.userAnswer,
          isCorrect: isCorrect ? "true" : "false",
        })
        .where(eq(assessmentAnswers.id, input.answerId));

      return {
        isCorrect,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      };
    }),

  // ---- 完成评估，计算最终等级 ----
  complete: authedQuery
    .input(z.object({ assessmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证并获取评估
      const assessment = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.id, input.assessmentId),
            eq(assessments.userId, userId)
          )
        )
        .limit(1);

      if (assessment.length === 0) {
        throw new Error("评估不存在");
      }

      const a = assessment[0];

      // 获取所有答题记录
      const answers = await db
        .select()
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.assessmentId, input.assessmentId));

      // 计算得分
      let totalScore = 0;
      let correctCount = 0;
      let maxCorrectDifficulty: string | null = null;

      for (const ans of answers) {
        if (ans.isCorrect === "true") {
          correctCount++;
          totalScore += DIFFICULTY_SCORES[ans.difficulty] || 0;
          if (
            !maxCorrectDifficulty ||
            DIFFICULTY_ORDER.indexOf(ans.difficulty) >
              DIFFICULTY_ORDER.indexOf(maxCorrectDifficulty)
          ) {
            maxCorrectDifficulty = ans.difficulty;
          }
        }
      }

      // 计算等级
      const skillLevel = calculateSkillLevel(totalScore, maxCorrectDifficulty);

      // 生成总结
      const summary = generateLevelSummary(
        skillLevel,
        a.goal,
        correctCount,
        answers.length
      );

      // 更新评估记录
      await db
        .update(assessments)
        .set({
          status: "completed",
          score: totalScore,
          correctCount,
          skillLevel,
          summary,
        })
        .where(eq(assessments.id, input.assessmentId));

      return {
        skillLevel,
        score: totalScore,
        correctCount,
        totalQuestions: answers.length,
        summary,
        maxCorrectDifficulty,
      };
    }),

  // ---- 获取评估结果 ----
  getResult: authedQuery
    .input(z.object({ assessmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const assessment = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.id, input.assessmentId),
            eq(assessments.userId, userId)
          )
        )
        .limit(1);

      if (assessment.length === 0) {
        return null;
      }

      const answers = await db
        .select()
        .from(assessmentAnswers)
        .where(eq(assessmentAnswers.assessmentId, input.assessmentId))
        .orderBy(assessmentAnswers.questionIndex);

      return {
        assessment: assessment[0],
        answers,
      };
    }),

  // ---- 获取某计划的评估记录 ----
  getByPlan: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 1. 先按 planId 查询（已完成关联的）
      const results = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.planId, input.planId),
            eq(assessments.userId, userId)
          )
        )
        .orderBy(desc(assessments.createdAt))
        .limit(1);

      if (results.length > 0) {
        return results[0];
      }

      // 2. Fallback：planId=0 的 completed 记录（onboarding 临时状态）
      // 限制只返回 24 小时内创建的，避免返回很久以前的遗留记录
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fallbackResults = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.planId, 0),
            eq(assessments.userId, userId),
            eq(assessments.status, "completed")
          )
        )
        .orderBy(desc(assessments.createdAt))
        .limit(1);

      // 额外安全检查：确保 fallback 记录是最近 24 小时内的
      if (fallbackResults.length > 0) {
        const record = fallbackResults[0];
        if (record.createdAt && new Date(record.createdAt) > twentyFourHoursAgo) {
          return record;
        }
      }

      return null;
    }),

  // ---- 更新评估记录的 planId（onboarding 中计划创建后调用） ----
  updatePlanId: authedQuery
    .input(z.object({ assessmentId: z.number(), planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 验证评估属于当前用户
      const assessment = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.id, input.assessmentId),
            eq(assessments.userId, userId)
          )
        )
        .limit(1);

      if (assessment.length === 0) {
        throw new Error("评估不存在或无权限");
      }

      await db
        .update(assessments)
        .set({ planId: input.planId })
        .where(eq(assessments.id, input.assessmentId));

      return { success: true };
    }),
});
