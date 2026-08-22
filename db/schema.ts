import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  float,
  bigint,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// Users table - 手机号登录
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Verification Codes - 验证码（开发阶段自动生成的验证码）
export const verificationCodes = mysqlTable("verification_codes", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  purpose: varchar("purpose", { length: 50 }).default("login").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: mysqlEnum("used", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = typeof verificationCodes.$inferInsert;

// Learning Plans - 用户的学习计划
export const learningPlans = mysqlTable("learning_plans", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  goal: text("goal").notNull(),
  subject: varchar("subject", { length: 255 }),
  totalDays: int("total_days").notNull().default(30),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
  learningType: varchar("learning_type", { length: 30 }).default("abstract_logic").notNull(),
  skillLevel: varchar("skill_level", { length: 10 }).default("l1").notNull(),
  currentDay: int("current_day").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type LearningPlan = typeof learningPlans.$inferSelect;
export type InsertLearningPlan = typeof learningPlans.$inferInsert;

// Learning Outline - 学习大纲（每一天的概要）
export const learningOutline = mysqlTable("learning_outline", {
  id: serial("id").primaryKey(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  dayNumber: int("day_number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  goal: text("goal"),
  keywords: text("keywords"),
  estimatedMinutes: int("estimated_minutes").default(30),
  phaseName: varchar("phase_name", { length: 255 }),
  phaseOrder: int("phase_order"),
  difficulty: mysqlEnum("difficulty", ["basic", "intermediate", "advanced"]),
  prerequisites: text("prerequisites"),
  learningObjective: text("learning_objective"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LearningOutline = typeof learningOutline.$inferSelect;
export type InsertLearningOutline = typeof learningOutline.$inferInsert;

// Learning Contents - 每天的详细学习内容
export const learningContents = mysqlTable("learning_contents", {
  id: serial("id").primaryKey(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  outlineId: bigint("outline_id", { mode: "number", unsigned: true }).notNull(),
  dayNumber: int("day_number").notNull(),
  markdownContent: text("markdown_content"),
  isGenerated: mysqlEnum("is_generated", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type LearningContent = typeof learningContents.$inferSelect;
export type InsertLearningContent = typeof learningContents.$inferInsert;

// Mastery Scores - 掌握度评分
export const masteryScores = mysqlTable("mastery_scores", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  knowledgeName: varchar("knowledge_name", { length: 255 }).notNull(),
  masteryScore: float("mastery_score").default(0).notNull(),
  questionsAsked: int("questions_asked").default(0).notNull(),
  correctAnswers: int("correct_answers").default(0).notNull(),
  studyMinutes: int("study_minutes").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MasteryScore = typeof masteryScores.$inferSelect;
export type InsertMasteryScore = typeof masteryScores.$inferInsert;

// QA History - 问答历史
export const qaHistory = mysqlTable("qa_history", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  dayNumber: int("day_number").default(0).notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  context: text("context"),
  isAiGenerated: mysqlEnum("is_ai_generated", ["true", "false"]).default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QAHistory = typeof qaHistory.$inferSelect;
export type InsertQAHistory = typeof qaHistory.$inferInsert;

// Generation Tasks - AI 内容生成任务状态
export const generationTasks = mysqlTable("generation_tasks", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  taskType: varchar("task_type", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "analyzing", "generating_outline", "generating_content", "completed", "failed"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(),
  currentStage: varchar("current_stage", { length: 255 }),
  resultId: bigint("result_id", { mode: "number", unsigned: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type GenerationTask = typeof generationTasks.$inferSelect;
export type InsertGenerationTask = typeof generationTasks.$inferInsert;

// Study Sessions - 学习会话记录
export const studySessions = mysqlTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  dayNumber: int("day_number").notNull(),
  durationMinutes: int("duration_minutes").default(0).notNull(),
  contentAccessed: mysqlEnum("content_accessed", ["true", "false"]).default("false").notNull(),
  qaInteractions: int("qa_interactions").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = typeof studySessions.$inferInsert;

// Quiz Results - 答题记录（用于掌握度算法计算）
export const quizResults = mysqlTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  dayNumber: int("day_number").notNull(),
  knowledgeName: varchar("knowledge_name", { length: 255 }).notNull(),
  question: text("question").notNull(),
  userAnswer: varchar("user_answer", { length: 10 }).notNull(),
  correctAnswer: varchar("correct_answer", { length: 10 }).notNull(),
  isCorrect: mysqlEnum("is_correct", ["true", "false"]).notNull(),
  attemptNumber: int("attempt_number").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = typeof quizResults.$inferInsert;

// Assessments - 能力评估记录
export const assessments = mysqlTable("assessments", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  planId: bigint("plan_id", { mode: "number", unsigned: true }).notNull(),
  goal: text("goal").notNull(),
  skillLevel: mysqlEnum("skill_level", ["l1", "l2", "l3", "l4", "l5"]).default("l1").notNull(),
  score: int("score").default(0).notNull(),
  totalQuestions: int("total_questions").default(0).notNull(),
  correctCount: int("correct_count").default(0).notNull(),
  summary: text("summary"),
  status: mysqlEnum("status", ["pending", "completed"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

// Assessment Answers - 评估答题记录
export const assessmentAnswers = mysqlTable("assessment_answers", {
  id: serial("id").primaryKey(),
  assessmentId: bigint("assessment_id", { mode: "number", unsigned: true }).notNull(),
  questionIndex: int("question_index").notNull(),
  question: text("question").notNull(),
  optionsA: text("options_a").notNull(),
  optionsB: text("options_b").notNull(),
  optionsC: text("options_c").notNull(),
  optionsD: text("options_d").notNull(),
  correctAnswer: varchar("correct_answer", { length: 10 }).notNull(),
  userAnswer: varchar("user_answer", { length: 10 }),
  explanation: text("explanation"),
  difficulty: mysqlEnum("difficulty", ["basic", "intermediate", "advanced", "expert"]).default("basic").notNull(),
  isCorrect: mysqlEnum("is_correct", ["true", "false"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AssessmentAnswer = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswer = typeof assessmentAnswers.$inferInsert;

// ============================================================================
// Prompt 配置化：学习类型 + Prompt 片段 + 模板组装 + 版本 + 调用日志
// ============================================================================

// Learning Types - 学习类型配置（7 大类，替代 typeEngine 硬编码）
export const learningTypes = mysqlTable(
  "learning_types",
  {
    id: serial("id").primaryKey(),
    typeKey: varchar("type_key", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }),
    detectKeywords: json("detect_keywords"),
    phaseStrategy: json("phase_strategy"),
    sortOrder: int("sort_order").default(0).notNull(),
    isActive: mysqlEnum("is_active", ["true", "false"]).default("true").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("uq_learning_types_key").on(t.typeKey)],
);

export type LearningTypeRow = typeof learningTypes.$inferSelect;
export type InsertLearningType = typeof learningTypes.$inferInsert;

// Prompt Components - Prompt 片段库（最小复用单元）
export const promptComponents = mysqlTable(
  "prompt_components",
  {
    id: serial("id").primaryKey(),
    componentKey: varchar("component_key", { length: 100 }).notNull(),
    category: mysqlEnum("category", [
      "role",
      "rule",
      "constraint",
      "format",
      "example",
      "context",
    ]).notNull(),
    scope: mysqlEnum("scope", ["common", "type", "purpose"]).notNull(),
    typeKey: varchar("type_key", { length: 50 }),
    purpose: mysqlEnum("purpose", [
      "detect",
      "assessment",
      "outline",
      "content",
      "qa",
    ]),
    title: varchar("title", { length: 100 }).notNull(),
    content: text("content").notNull(),
    variables: json("variables"),
    isActive: mysqlEnum("is_active", ["true", "false"]).default("true").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("uq_prompt_components_key").on(t.componentKey)],
);

export type PromptComponent = typeof promptComponents.$inferSelect;
export type InsertPromptComponent = typeof promptComponents.$inferInsert;

// Prompt Templates - 完整 Prompt 的组装配方（type + purpose 唯一）
export const promptTemplates = mysqlTable(
  "prompt_templates",
  {
    id: serial("id").primaryKey(),
    templateKey: varchar("template_key", { length: 100 }).notNull(),
    typeKey: varchar("type_key", { length: 50 }),
    purpose: mysqlEnum("purpose", [
      "detect",
      "assessment",
      "outline",
      "content",
      "qa",
    ]).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 255 }),
    temperature: float("temperature").default(0.3).notNull(),
    maxTokens: int("max_tokens").default(2000).notNull(),
    responseFormat: mysqlEnum("response_format", [
      "json_object",
      "text",
      "stream",
    ]).default("text").notNull(),
    isActive: mysqlEnum("is_active", ["true", "false"]).default("true").notNull(),
    currentVersion: int("current_version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_prompt_templates_key").on(t.templateKey),
    uniqueIndex("uq_prompt_templates_type_purpose").on(t.typeKey, t.purpose),
  ],
);

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

// Prompt Template Items - 模板与片段的组装关系（含顺序与 slot）
export const promptTemplateItems = mysqlTable(
  "prompt_template_items",
  {
    id: serial("id").primaryKey(),
    templateId: bigint("template_id", { mode: "number", unsigned: true }).notNull(),
    componentId: bigint("component_id", { mode: "number", unsigned: true }).notNull(),
    sortOrder: int("sort_order").default(0).notNull(),
    slot: mysqlEnum("slot", ["system", "user"]).default("system").notNull(),
    overrideContent: text("override_content"),
    isActive: mysqlEnum("is_active", ["true", "false"]).default("true").notNull(),
  },
  (t) => [
    uniqueIndex("uq_template_items_order").on(t.templateId, t.slot, t.sortOrder),
    index("idx_template_items_template").on(t.templateId),
  ],
);

export type PromptTemplateItem = typeof promptTemplateItems.$inferSelect;
export type InsertPromptTemplateItem = typeof promptTemplateItems.$inferInsert;

// Prompt Versions - 组装后的完整 Prompt 快照（回滚不受片段后续修改影响）
export const promptVersions = mysqlTable(
  "prompt_versions",
  {
    id: serial("id").primaryKey(),
    templateId: bigint("template_id", { mode: "number", unsigned: true }).notNull(),
    version: int("version").notNull(),
    assembledSystem: text("assembled_system"),
    assembledUser: text("assembled_user"),
    temperature: float("temperature"),
    maxTokens: int("max_tokens"),
    changeNote: varchar("change_note", { length: 255 }),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_prompt_versions_tv").on(t.templateId, t.version)],
);

export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = typeof promptVersions.$inferInsert;

// AI Generation Logs - 每次 AI 调用日志（含解析成功率，衡量 Prompt 稳定性）
export const aiGenerationLogs = mysqlTable(
  "ai_generation_logs",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }),
    planId: bigint("plan_id", { mode: "number", unsigned: true }),
    taskType: mysqlEnum("task_type", [
      "detect",
      "assessment",
      "outline",
      "content",
      "qa",
    ]).notNull(),
    typeKey: varchar("type_key", { length: 50 }),
    templateId: bigint("template_id", { mode: "number", unsigned: true }),
    templateVersion: int("template_version"),
    inputVars: json("input_vars"),
    outputRaw: text("output_raw"),
    outputParsed: json("output_parsed"),
    parseSuccess: mysqlEnum("parse_success", ["true", "false"]),
    retryCount: int("retry_count").default(0).notNull(),
    status: mysqlEnum("status", ["success", "failed"]).notNull(),
    errorMessage: text("error_message"),
    promptTokens: int("prompt_tokens"),
    completionTokens: int("completion_tokens"),
    durationMs: int("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_ai_logs_user").on(t.userId),
    index("idx_ai_logs_task").on(t.taskType, t.typeKey),
    index("idx_ai_logs_created").on(t.createdAt),
  ],
);

export type AiGenerationLog = typeof aiGenerationLogs.$inferSelect;
export type InsertAiGenerationLog = typeof aiGenerationLogs.$inferInsert;
