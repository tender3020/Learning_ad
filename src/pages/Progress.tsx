import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import PhaseTimeline from "@/components/progress/PhaseTimeline";
import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import {
  Target,
  TrendingUp,
  Clock,
  Brain,
  Award,
  CheckCircle2,
  MessageCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";

type Tab = "mastery" | "records";

export default function Progress() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useLearningStore();
  const { user } = useAuth();
  const initialTab = searchParams.get("tab") === "records" ? "records" : "mastery";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "day">("all");

  const { data: plans } = trpc.learning.getPlans.useQuery();
  const { data: outlineData } = trpc.learning.getOutline.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId },
  );
  const { data: scores } = trpc.mastery.getScores.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId },
  );
  const { data: stats } = trpc.mastery.getStats.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId },
  );
  const { data: history } = trpc.qa.getHistory.useQuery(
    { planId: store.currentPlanId || 0, limit: 100 },
    { enabled: !!store.currentPlanId },
  );

  const restorePlan = useCallback(() => {
    if (!store.currentPlanId && plans && plans.length > 0) {
      const latestPlan = plans[0];
      store.restoreFromDB(
        {
          id: latestPlan.id,
          goal: latestPlan.goal,
          subject: latestPlan.subject,
          totalDays: latestPlan.totalDays,
          currentDay: latestPlan.currentDay,
        },
        user?.id || 0,
      );
    }
  }, [store, plans, user?.id]);

  useEffect(() => {
    restorePlan();
  }, [restorePlan]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSearchParams(next === "records" ? { tab: "records" } : {}, { replace: true });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--color-success)";
    if (score >= 60) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "优秀";
    if (score >= 60) return "良好";
    if (score >= 40) return "一般";
    return "需加强";
  };

  const totalCorrect = scores?.reduce((sum, s) => sum + s.correctAnswers, 0) || 0;
  const totalAttempts = (scores?.reduce((s, sc) => s + sc.questionsAsked, 0) || 0) + totalCorrect;
  const quizAccuracy =
    totalCorrect > 0 && totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const groupedByDay = history?.reduce(
    (acc, item) => {
      const day = item.dayNumber;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    },
    {} as Record<number, NonNullable<typeof history>>,
  );

  if (!store.currentPlanId) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <BookOpen size={40} className="mx-auto mb-3 text-token-secondary" />
          <h2 className="text-lg font-semibold text-token-primary mb-2">还没有学习计划</h2>
          <p className="text-sm text-token-secondary mb-4">创建计划后即可查看阶段进度与掌握度</p>
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--brand-foreground)] bg-token-brand"
          >
            创建学习计划
          </button>
        </div>
      </div>
    );
  }

  const outline = outlineData?.outline || [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 py-3 md:p-8 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-6">
          <h1 className="hidden md:block text-lg md:text-3xl font-semibold text-token-primary mb-1">学习进度</h1>
          <p className="hidden md:block text-xs md:text-sm text-token-secondary truncate">{store.goal || "当前计划"}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-elevated rounded-xl md:rounded-2xl p-3 md:p-5 mb-4 md:mb-6"
        >
          <h2 className="text-xs md:text-sm font-medium text-token-secondary mb-3">阶段旅程</h2>
          <PhaseTimeline outline={outline} currentDay={store.currentDay} />
        </motion.div>

        <div className="flex items-center gap-2 surface-elevated rounded-xl p-1 w-fit mb-4 md:mb-6">
          <button
            type="button"
            onClick={() => switchTab("mastery")}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm transition-all ${
              tab === "mastery" ? "bg-token-brand-muted text-token-brand-light" : "text-token-secondary hover:text-token-primary"
            }`}
          >
            掌握度
          </button>
          <button
            type="button"
            onClick={() => switchTab("records")}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm transition-all ${
              tab === "records" ? "bg-token-brand-muted text-token-brand-light" : "text-token-secondary hover:text-token-primary"
            }`}
          >
            学习记录
          </button>
        </div>

        {tab === "mastery" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-8">
              {[
                { label: "总体掌握度", value: `${Math.round(stats?.avgScore || 0)}%`, icon: Target, color: "var(--brand-primary)", detail: "加权综合评分" },
                { label: "已学知识点", value: `${stats?.totalTopics || 0}`, icon: Brain, color: "var(--color-success)", detail: "个知识模块" },
                { label: "学习时长", value: `${stats?.totalStudyMinutes || 0}m`, icon: Clock, color: "var(--color-warning)", detail: "累计分钟" },
                { label: "练习正确率", value: `${quizAccuracy}%`, icon: CheckCircle2, color: "var(--brand-secondary)", detail: `${totalCorrect} 次正确` },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="surface-elevated rounded-xl md:rounded-2xl p-3 md:p-5"
                >
                  <stat.icon size={16} style={{ color: stat.color }} className="mb-2" />
                  <div className="type-display text-token-primary mb-0.5">{stat.value}</div>
                  <div className="text-xs text-token-secondary">{stat.label}</div>
                  <div className="type-caption text-token-secondary mt-0.5">{stat.detail}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface-elevated rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col items-center"
              >
                <h3 className="text-xs md:text-sm font-medium text-token-secondary mb-4">总体掌握度</h3>
                <div className="relative w-28 h-28 md:w-40 md:h-40 mb-4">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-border)" strokeWidth="10" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#progressMasteryGradient)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats?.avgScore || 0) * 2.64} 264`}
                      initial={{ strokeDasharray: "0 264" }}
                      animate={{ strokeDasharray: `${(stats?.avgScore || 0) * 2.64} 264` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="progress-ring-circle"
                    />
                    <defs>
                      <linearGradient id="progressMasteryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--brand-primary)" />
                        <stop offset="100%" stopColor="var(--color-success)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl md:text-3xl font-bold text-token-primary">{Math.round(stats?.avgScore || 0)}%</span>
                    <span className="type-caption text-token-secondary">综合评分</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 surface-elevated rounded-xl md:rounded-2xl p-4 md:p-6"
              >
                <div className="flex items-center justify-between mb-3 md:mb-5">
                  <h3 className="type-caption md:text-sm font-medium text-token-secondary">知识点掌握度详情</h3>
                  <Award size={14} className="text-token-brand" />
                </div>

                {scores && scores.length > 0 ? (
                  <div className="space-y-3">
                    {scores.map((score, i) => {
                      const isSelected = selectedTopic === score.knowledgeName;
                      const color = getScoreColor(score.masteryScore);
                      return (
                        <motion.div
                          key={score.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => setSelectedTopic(isSelected ? null : score.knowledgeName)}
                          className={`p-2.5 md:p-4 rounded-lg md:rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-token-brand-muted border-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)]"
                              : "bg-[var(--surface-hover)] border-token-surface hover-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Brain size={12} style={{ color }} />
                              <p className="text-xs md:text-sm font-medium text-token-primary truncate">{score.knowledgeName}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <span className="text-sm md:text-lg font-semibold" style={{ color }}>
                                {Math.round(score.masteryScore)}%
                              </span>
                              <span className="type-caption text-token-secondary ml-1">{getScoreLabel(score.masteryScore)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-border)" }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${score.masteryScore}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <TrendingUp size={40} className="mx-auto mb-3 text-token-secondary" />
                    <p className="text-sm text-token-secondary">还没有掌握度数据</p>
                    <p className="text-xs text-token-secondary mt-1">在今日页学习、答题或提问后会自动追踪</p>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6"
            >
              <div className="surface-elevated rounded-2xl p-4 flex items-center gap-3">
                <MessageCircle size={18} className="text-token-brand" />
                <div>
                  <p className="text-xl font-semibold text-token-primary">{history?.length || 0}</p>
                  <p className="text-xs text-token-secondary">总问答数</p>
                </div>
              </div>
              <div className="surface-elevated rounded-2xl p-4 flex items-center gap-3">
                <BookOpen size={18} style={{ color: "var(--color-success)" }} />
                <div>
                  <p className="text-xl font-semibold text-token-primary">{new Set(history?.map((h) => h.dayNumber)).size || 0}</p>
                  <p className="text-xs text-token-secondary">涉及天数</p>
                </div>
              </div>
              <div className="surface-elevated rounded-2xl p-4 flex items-center gap-3">
                <Clock size={18} style={{ color: "var(--color-warning)" }} />
                <div>
                  <p className="text-sm font-semibold text-token-primary">
                    {history && history.length > 0 ? formatDate(history[0].createdAt) : "-"}
                  </p>
                  <p className="text-xs text-token-secondary">最近提问</p>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center gap-2 surface-elevated rounded-xl p-1 w-fit mb-4">
              <button
                type="button"
                onClick={() => setHistoryFilter("all")}
                className={`px-3 py-2 rounded-lg text-xs transition-all ${
                  historyFilter === "all" ? "bg-token-brand-muted text-token-brand-light" : "text-token-secondary"
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("day")}
                className={`px-3 py-2 rounded-lg text-xs transition-all ${
                  historyFilter === "day" ? "bg-token-brand-muted text-token-brand-light" : "text-token-secondary"
                }`}
              >
                按天分组
              </button>
            </div>

            {historyFilter === "all" ? (
              <div className="space-y-2 md:space-y-3">
                {history && history.length > 0 ? (
                  history.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      className="surface-elevated rounded-2xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="w-full flex items-center gap-3 p-4 text-left"
                      >
                        <div className="w-8 h-8 rounded-xl bg-token-brand-muted flex items-center justify-center flex-shrink-0">
                          <span className="type-caption font-medium text-token-brand">D{item.dayNumber}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-token-primary truncate">{item.question}</p>
                          <p className="type-caption text-token-secondary mt-0.5">{formatDate(item.createdAt)}</p>
                        </div>
                        {expandedId === item.id ? (
                          <ChevronUp size={16} className="text-token-secondary" />
                        ) : (
                          <ChevronDown size={16} className="text-token-secondary" />
                        )}
                      </button>
                      {expandedId === item.id && item.answer && (
                        <div className="px-4 pb-4 border-t border-token-surface pt-3">
                          <MarkdownRenderer content={item.answer} />
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle size={40} className="mx-auto mb-4 text-token-secondary" />
                    <p className="text-base text-token-secondary">还没有问答记录</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {groupedByDay && Object.keys(groupedByDay).length > 0 ? (
                  Object.entries(groupedByDay)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([day, items]) => (
                      <div key={day}>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} className="text-token-brand" />
                          <h3 className="text-sm font-medium text-token-primary">第 {day} 天</h3>
                          <span className="type-caption text-token-secondary">({items?.length} 条)</span>
                        </div>
                        <div className="space-y-2">
                          {items?.map((item) => (
                            <div key={item.id} className="surface-elevated rounded-xl p-3">
                              <p className="text-sm text-token-primary mb-2">{item.question}</p>
                              {item.answer && (
                                <div className="text-xs text-token-secondary line-clamp-2">
                                  <MarkdownRenderer content={item.answer} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle size={40} className="mx-auto mb-4 text-token-secondary" />
                    <p className="text-base text-token-secondary">还没有问答记录</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
