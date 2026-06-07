import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import * as ai from "./services/aiService";

const learningTypeSchema = z.enum([
  "abstract_logic",
  "operation_logic",
  "language",
  "network_assoc",
  "model_apply",
  "perception",
  "practical",
]);

export const aiRouter = createRouter({
  detectLearningType: authedQuery
    .input(z.object({ goal: z.string().min(1) }))
    .mutation(async ({ input }) => ai.detectLearningType(input.goal)),

  generateOutline: authedQuery
    .input(
      z.object({
        goal: z.string().min(1),
        totalDays: z.number().int().min(1).max(365),
        learningType: learningTypeSchema.default("abstract_logic"),
        skillLevel: z.string().default("l1"),
      }),
    )
    .mutation(async ({ input }) =>
      ai.generateOutline(
        input.goal,
        input.totalDays,
        input.learningType,
        input.skillLevel,
      ),
    ),

  generateAssessmentQuestions: authedQuery
    .input(
      z.object({
        goal: z.string().min(1),
        learningType: learningTypeSchema.default("abstract_logic"),
      }),
    )
    .mutation(async ({ input }) =>
      ai.generateAssessmentQuestions(input.goal, input.learningType),
    ),

  ask: authedQuery
    .input(
      z.object({
        question: z.string().min(1),
        context: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => ai.askAI(input.question, input.context)),
});
