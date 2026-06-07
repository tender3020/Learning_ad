import { relations } from "drizzle-orm";
import {
  users,
  learningPlans,
  learningOutline,
  learningContents,
  masteryScores,
  qaHistory,
  verificationCodes,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  learningPlans: many(learningPlans),
  masteryScores: many(masteryScores),
  qaHistory: many(qaHistory),
  verificationCodes: many(verificationCodes),
}));

export const learningPlansRelations = relations(learningPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [learningPlans.userId],
    references: [users.id],
  }),
  outlines: many(learningOutline),
  contents: many(learningContents),
  masteryScores: many(masteryScores),
  qaHistory: many(qaHistory),
}));

export const learningOutlineRelations = relations(learningOutline, ({ one }) => ({
  plan: one(learningPlans, {
    fields: [learningOutline.planId],
    references: [learningPlans.id],
  }),
}));

export const learningContentsRelations = relations(learningContents, ({ one }) => ({
  plan: one(learningPlans, {
    fields: [learningContents.planId],
    references: [learningPlans.id],
  }),
}));

export const masteryScoresRelations = relations(masteryScores, ({ one }) => ({
  user: one(users, {
    fields: [masteryScores.userId],
    references: [users.id],
  }),
  plan: one(learningPlans, {
    fields: [masteryScores.planId],
    references: [learningPlans.id],
  }),
}));

export const qaHistoryRelations = relations(qaHistory, ({ one }) => ({
  user: one(users, {
    fields: [qaHistory.userId],
    references: [users.id],
  }),
  plan: one(learningPlans, {
    fields: [qaHistory.planId],
    references: [learningPlans.id],
  }),
}));
