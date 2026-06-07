import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { masteryScores, quizResults } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * ============================================================================
 * Mastery Score Algorithm - 掌握度分析算法
 * ============================================================================
 *
 * 掌握度是一个 0-100 的综合评分，基于四个维度的加权计算：
 *
 * MasteryScore = min(100, round(
 *   StudyTimeScore   * 0.25 +   -- 学习时长 (25%)
 *   QAScore          * 0.20 +   -- 问答互动 (20%)
 *   QuizScore        * 0.40 +   -- 练习正确率 (40%) -- 最重要
 *   FrequencyScore   * 0.15     -- 学习频率 (15%)
 * ))
 *
 * ---------------------------------------------------------------------------
 * StudyTimeScore = min(100, studyMinutes / targetMinutes * 100)
 *   - 达到预估学习时长 = 100分
 *
 * QAScore = min(100, questionsAsked * 20 + correctAnswers * 10)
 *   - 每次提问 +20分，每次正确回答额外 +10分
 *
 * QuizScore = weightedCorrectRate * 100
 *   - 首次答题权重 1.0，第二次 0.7，第三次 0.5，之后 0.3
 *   - 加权正确率 = Σ(correct_i * weight_i) / Σ(weight_i)
 *   - 如果没有答题记录，QuizScore = 0
 *
 * FrequencyScore = min(100, consecutiveStudyDays * 14.3)
 *   - 7天连续学习 = 100分
 *   - 从 quizResults 和 studySessions 综合判断
 * ============================================================================
 */

/** 计算Quiz加权分数 (0-100) */
async function computeQuizScore(
  db: ReturnType<typeof getDb>,
  userId: number,
  planId: number,
  knowledgeName: string
): Promise<number> {
  const results = await db
    .select()
    .from(quizResults)
    .where(
      and(
        eq(quizResults.userId, userId),
        eq(quizResults.planId, planId),
        eq(quizResults.knowledgeName, knowledgeName)
      )
    )
    .orderBy(quizResults.createdAt);

  if (results.length === 0) return 0;

  // 权重衰减：第1次1.0，第2次0.7，第3次0.5，第4次及以后0.3
  const getWeight = (attempt: number): number => {
    if (attempt === 1) return 1.0;
    if (attempt === 2) return 0.7;
    if (attempt === 3) return 0.5;
    return 0.3;
  };

  let weightedCorrectSum = 0;
  let weightedTotalSum = 0;

  results.forEach((r) => {
    const weight = getWeight(r.attemptNumber);
    weightedTotalSum += weight;
    if (r.isCorrect === "true") {
      weightedCorrectSum += weight;
    }
  });

  if (weightedTotalSum === 0) return 0;
  return Math.round((weightedCorrectSum / weightedTotalSum) * 100);
}

/** 计算完整的掌握度分数 */
function computeMasteryScore(params: {
  studyMinutes: number;
  targetMinutes: number;
  questionsAsked: number;
  correctAnswers: number;
  quizScore: number;
  consecutiveDays: number;
}): number {
  const { studyMinutes, targetMinutes, questionsAsked, correctAnswers, quizScore, consecutiveDays } = params;

  // StudyTimeScore (0-100)
  const studyTimeScore = Math.min(100, Math.round((studyMinutes / Math.max(targetMinutes, 1)) * 100));

  // QAScore (0-100): 每次提问+20，每次正确额外+10
  const qaScore = Math.min(100, questionsAsked * 20 + correctAnswers * 10);

  // QuizScore 已经是 0-100

  // FrequencyScore (0-100): 连续天数 * 14.3
  const frequencyScore = Math.min(100, Math.round(consecutiveDays * 14.3));

  // 加权综合
  const rawScore =
    studyTimeScore * 0.25 +
    qaScore * 0.20 +
    quizScore * 0.40 +
    frequencyScore * 0.15;

  return Math.min(100, Math.round(rawScore));
}

export const masteryRouter = createRouter({
  // ---- 更新学习时长并重新计算掌握度 ----
  recordStudy: authedQuery
    .input(
      z.object({
        planId: z.number(),
        knowledgeName: z.string(),
        minutes: z.number().min(1),
        targetMinutes: z.number().default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 查找或创建记录
      const existing = await db
        .select()
        .from(masteryScores)
        .where(
          and(
            eq(masteryScores.userId, userId),
            eq(masteryScores.planId, input.planId),
            eq(masteryScores.knowledgeName, input.knowledgeName)
          )
        )
        .limit(1);

      let record = existing[0];

      if (record) {
        const newStudyMinutes = record.studyMinutes + input.minutes;
        // 计算 quizScore
        const quizScore = await computeQuizScore(db, userId, input.planId, input.knowledgeName);
        // 计算新的掌握度
        const newScore = computeMasteryScore({
          studyMinutes: newStudyMinutes,
          targetMinutes: input.targetMinutes,
          questionsAsked: record.questionsAsked,
          correctAnswers: record.correctAnswers,
          quizScore,
          consecutiveDays: 1, // 简化处理
        });

        await db
          .update(masteryScores)
          .set({
            studyMinutes: newStudyMinutes,
            masteryScore: newScore,
            updatedAt: new Date(),
          })
          .where(eq(masteryScores.id, record.id));

        record = { ...record, studyMinutes: newStudyMinutes, masteryScore: newScore };
      } else {
        const result = await db.insert(masteryScores).values({
          userId,
          planId: input.planId,
          knowledgeName: input.knowledgeName,
          masteryScore: computeMasteryScore({
            studyMinutes: input.minutes,
            targetMinutes: input.targetMinutes,
            questionsAsked: 0,
            correctAnswers: 0,
            quizScore: 0,
            consecutiveDays: 1,
          }),
          studyMinutes: input.minutes,
        });

        const newRecord = await db
          .select()
          .from(masteryScores)
          .where(eq(masteryScores.id, Number(result[0].insertId)))
          .limit(1);
        record = newRecord[0];
      }

      return { success: true, masteryScore: record.masteryScore, studyMinutes: record.studyMinutes };
    }),

  // ---- 记录问答互动并重新计算掌握度 ----
  recordQA: authedQuery
    .input(
      z.object({
        planId: z.number(),
        knowledgeName: z.string(),
        isCorrect: z.boolean().optional(),
        targetMinutes: z.number().default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const existing = await db
        .select()
        .from(masteryScores)
        .where(
          and(
            eq(masteryScores.userId, userId),
            eq(masteryScores.planId, input.planId),
            eq(masteryScores.knowledgeName, input.knowledgeName)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // 创建新记录，只有问答数据
        const result = await db.insert(masteryScores).values({
          userId,
          planId: input.planId,
          knowledgeName: input.knowledgeName,
          masteryScore: computeMasteryScore({
            studyMinutes: 0,
            targetMinutes: input.targetMinutes,
            questionsAsked: 1,
            correctAnswers: input.isCorrect ? 1 : 0,
            quizScore: 0,
            consecutiveDays: 1,
          }),
          questionsAsked: 1,
          correctAnswers: input.isCorrect ? 1 : 0,
        });
        const newRecord = await db.select().from(masteryScores).where(eq(masteryScores.id, Number(result[0].insertId))).limit(1);
        return { success: true, masteryScore: newRecord[0].masteryScore };
      }

      const record = existing[0];
      const newQuestionsAsked = record.questionsAsked + 1;
      const newCorrectAnswers = record.correctAnswers + (input.isCorrect ? 1 : 0);
      const quizScore = await computeQuizScore(db, userId, input.planId, input.knowledgeName);

      const newScore = computeMasteryScore({
        studyMinutes: record.studyMinutes,
        targetMinutes: input.targetMinutes,
        questionsAsked: newQuestionsAsked,
        correctAnswers: newCorrectAnswers,
        quizScore,
        consecutiveDays: 1,
      });

      await db
        .update(masteryScores)
        .set({
          questionsAsked: newQuestionsAsked,
          correctAnswers: newCorrectAnswers,
          masteryScore: newScore,
          updatedAt: new Date(),
        })
        .where(eq(masteryScores.id, record.id));

      return { success: true, masteryScore: newScore };
    }),

  // ---- 提交答题结果并重新计算掌握度 ----
  submitQuiz: authedQuery
    .input(
      z.object({
        planId: z.number(),
        dayNumber: z.number(),
        knowledgeName: z.string(),
        question: z.string(),
        userAnswer: z.string(),
        correctAnswer: z.string(),
        isCorrect: z.boolean(),
        targetMinutes: z.number().default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // 1. 计算该知识点的答题次数
      const existingQuizzes = await db
        .select()
        .from(quizResults)
        .where(
          and(
            eq(quizResults.userId, userId),
            eq(quizResults.planId, input.planId),
            eq(quizResults.knowledgeName, input.knowledgeName)
          )
        )
        .orderBy(desc(quizResults.createdAt))
        .limit(1);

      const attemptNumber = existingQuizzes.length > 0 ? existingQuizzes[0].attemptNumber + 1 : 1;

      // 2. 保存答题记录
      await db.insert(quizResults).values({
        userId,
        planId: input.planId,
        dayNumber: input.dayNumber,
        knowledgeName: input.knowledgeName,
        question: input.question,
        userAnswer: input.userAnswer,
        correctAnswer: input.correctAnswer,
        isCorrect: input.isCorrect ? "true" : "false",
        attemptNumber,
      });

      // 3. 计算新的 quizScore
      const quizScore = await computeQuizScore(db, userId, input.planId, input.knowledgeName);

      // 4. 更新掌握度记录
      const existingMastery = await db
        .select()
        .from(masteryScores)
        .where(
          and(
            eq(masteryScores.userId, userId),
            eq(masteryScores.planId, input.planId),
            eq(masteryScores.knowledgeName, input.knowledgeName)
          )
        )
        .limit(1);

      if (existingMastery.length > 0) {
        const record = existingMastery[0];
        const newCorrectAnswers = record.correctAnswers + (input.isCorrect ? 1 : 0);
        const newScore = computeMasteryScore({
          studyMinutes: record.studyMinutes,
          targetMinutes: input.targetMinutes,
          questionsAsked: record.questionsAsked,
          correctAnswers: newCorrectAnswers,
          quizScore,
          consecutiveDays: 1,
        });

        await db
          .update(masteryScores)
          .set({
            correctAnswers: newCorrectAnswers,
            masteryScore: newScore,
            updatedAt: new Date(),
          })
          .where(eq(masteryScores.id, record.id));

        return { success: true, masteryScore: newScore, isCorrect: input.isCorrect, attemptNumber };
      }

      // 创建新的掌握度记录
      const result = await db.insert(masteryScores).values({
        userId,
        planId: input.planId,
        knowledgeName: input.knowledgeName,
        masteryScore: computeMasteryScore({
          studyMinutes: 0,
          targetMinutes: input.targetMinutes,
          questionsAsked: 0,
          correctAnswers: input.isCorrect ? 1 : 0,
          quizScore,
          consecutiveDays: 1,
        }),
        correctAnswers: input.isCorrect ? 1 : 0,
      });
      const newRecord = await db.select().from(masteryScores).where(eq(masteryScores.id, Number(result[0].insertId))).limit(1);

      return { success: true, masteryScore: newRecord[0].masteryScore, isCorrect: input.isCorrect, attemptNumber };
    }),

  // ---- 获取掌握度评分列表 ----
  getScores: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const scores = await db
        .select()
        .from(masteryScores)
        .where(
          and(
            eq(masteryScores.userId, userId),
            eq(masteryScores.planId, input.planId)
          )
        )
        .orderBy(desc(masteryScores.masteryScore));

      return scores;
    }),

  // ---- 获取总体掌握度统计 ----
  getStats: authedQuery
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const scores = await db
        .select({
          avgScore: sql<number>`AVG(${masteryScores.masteryScore})`,
          totalTopics: sql<number>`COUNT(*)`,
          totalQuestions: sql<number>`SUM(${masteryScores.questionsAsked})`,
          totalStudyMinutes: sql<number>`SUM(${masteryScores.studyMinutes})`,
        })
        .from(masteryScores)
        .where(
          and(
            eq(masteryScores.userId, userId),
            eq(masteryScores.planId, input.planId)
          )
        );

      return scores[0] || { avgScore: 0, totalTopics: 0, totalQuestions: 0, totalStudyMinutes: 0 };
    }),
});
