import { masteryScores, quizResults } from "@db/schema";
import { eq, and } from "drizzle-orm";
import type { getDb } from "../queries/connection";

type Db = ReturnType<typeof getDb>;

/** 计算 Quiz 加权分数 (0-100) */
export async function computeQuizScore(
  db: Db,
  userId: number,
  planId: number,
  knowledgeName: string,
): Promise<number> {
  const results = await db
    .select()
    .from(quizResults)
    .where(
      and(
        eq(quizResults.userId, userId),
        eq(quizResults.planId, planId),
        eq(quizResults.knowledgeName, knowledgeName),
      ),
    )
    .orderBy(quizResults.createdAt);

  if (results.length === 0) return 0;

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
export function computeMasteryScore(params: {
  studyMinutes: number;
  targetMinutes: number;
  questionsAsked: number;
  correctAnswers: number;
  quizScore: number;
  consecutiveDays: number;
}): number {
  const {
    studyMinutes,
    targetMinutes,
    questionsAsked,
    correctAnswers,
    quizScore,
    consecutiveDays,
  } = params;

  const studyTimeScore = Math.min(
    100,
    Math.round((studyMinutes / Math.max(targetMinutes, 1)) * 100),
  );
  const qaScore = Math.min(100, questionsAsked * 20 + correctAnswers * 10);
  const frequencyScore = Math.min(100, Math.round(consecutiveDays * 14.3));

  const rawScore =
    studyTimeScore * 0.25 +
    qaScore * 0.2 +
    quizScore * 0.4 +
    frequencyScore * 0.15;

  return Math.min(100, Math.round(rawScore));
}

/** 记录一次问答互动并重新计算掌握度 */
export async function recordQAMastery(
  db: Db,
  userId: number,
  planId: number,
  knowledgeName: string,
  targetMinutes = 30,
): Promise<{ masteryScore: number }> {
  const existing = await db
    .select()
    .from(masteryScores)
    .where(
      and(
        eq(masteryScores.userId, userId),
        eq(masteryScores.planId, planId),
        eq(masteryScores.knowledgeName, knowledgeName),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    const masteryScore = computeMasteryScore({
      studyMinutes: 0,
      targetMinutes,
      questionsAsked: 1,
      correctAnswers: 0,
      quizScore: 0,
      consecutiveDays: 1,
    });

    await db.insert(masteryScores).values({
      userId,
      planId,
      knowledgeName,
      masteryScore,
      questionsAsked: 1,
      correctAnswers: 0,
    });

    return { masteryScore };
  }

  const record = existing[0];
  const newQuestionsAsked = record.questionsAsked + 1;
  const quizScore = await computeQuizScore(db, userId, planId, knowledgeName);

  const masteryScore = computeMasteryScore({
    studyMinutes: record.studyMinutes,
    targetMinutes,
    questionsAsked: newQuestionsAsked,
    correctAnswers: record.correctAnswers,
    quizScore,
    consecutiveDays: 1,
  });

  await db
    .update(masteryScores)
    .set({
      questionsAsked: newQuestionsAsked,
      masteryScore,
      updatedAt: new Date(),
    })
    .where(eq(masteryScores.id, record.id));

  return { masteryScore };
}
