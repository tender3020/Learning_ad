import { authRouter } from "./auth-router";
import { aiRouter } from "./ai-router";
import { phoneAuthRouter } from "./phone-auth-router";
import { learningRouter } from "./learning-router";
import { contentRouter } from "./content-router";
import { qaRouter } from "./qa-router";
import { masteryRouter } from "./mastery-router";
import { generationRouter } from "./generation-router";
import { userRouter } from "./user-router";
import { assessmentRouter } from "./assessment-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  ai: aiRouter,
  phoneAuth: phoneAuthRouter,
  user: userRouter,
  learning: learningRouter,
  content: contentRouter,
  qa: qaRouter,
  mastery: masteryRouter,
  generation: generationRouter,
  assessment: assessmentRouter,
});

export type AppRouter = typeof appRouter;
