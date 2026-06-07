import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import WireframeSphere from "@/components/3d/WireframeSphere";
import SwipeablePlanItem from "@/components/SwipeablePlanItem";
import {
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Flame,
  Award,
  GraduationCap,
  MessageCircle,
  Plus,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useLearningStore();

  const { data: plans, isLoading: plansLoading } = trpc.learning.getPlans.useQuery();
  const { data: outlineData } = trpc.learning.getOutline.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId }
  );
  const dbOutline = outlineData?.outline || [];
  const { data: masteryStats } = trpc.mastery.getStats.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId }
  );
  const completePlan = trpc.learning.completePlan.useMutation({
    onSuccess: () => utils.learning.getPlans.invalidate(),
  });
  const utils = trpc.useUtils();

  const [showAllPlans, setShowAllPlans] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deletePlan = trpc.learning.deletePlan.useMutation({
    onSuccess: () => {
      utils.learning.getPlans.invalidate();
      setDeleteTarget(null);
      setDeletingId(null);
      // 如果删除的是当前计划，重置store
      if (deleteTarget === store.currentPlanId) {
        store.reset();
      }
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget);
    await deletePlan.mutateAsync({ planId: deleteTarget });
  };

  // 分类计划
  const activePlans = plans?.filter((p) => p.status === "active") || [];
  const completedPlans = plans?.filter((p) => p.status === "completed") || [];
  const activeCount = activePlans.length;
  const canCreateNew = activeCount < 7;

  // 优先使用数据库大纲（真相来源），store.outline 作为 loading 期间的 fallback
  const effectiveOutline = dbOutline.length > 0 ? dbOutline : store.outline;
  const todayOutline = effectiveOutline[store.currentDay - 1];
  const progress = store.totalDays > 0 ? Math.round((store.currentDay / store.totalDays) * 100) : 0;

  // 切换当前计划
  const switchToPlan = (plan: NonNullable<typeof plans>[0]) => {
    store.restoreFromDB(
      {
        id: plan.id,
        goal: plan.goal,
        subject: plan.subject,
        totalDays: plan.totalDays,
        currentDay: plan.currentDay,
      },
      user?.id || 0
    );
    setShowAllPlans(false);
  };

  // 完成计划
  const handleCompletePlan = async (planId: number) => {
    setCompletingId(planId);
    await completePlan.mutateAsync({ planId });
    setCompletingId(null);
  };

  if (plansLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6E56CF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasAnyPlan = plans && plans.length > 0;

  // ===== 没有任何计划 =====
  if (!hasAnyPlan) {
    return (
      <div className="h-full relative">
        <WireframeSphere opacity={0.15} />
        <div className="relative z-10 h-full flex items-center justify-center p-4 md:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 rounded-2xl overflow-hidden"
            >
              <img src="/logo.png" alt="弈智" className="w-full h-full object-cover" />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#F5F5F7] mb-3">
              你好，{user?.name || "学习者"}
            </h1>
            <p className="text-sm md:text-base text-[#8A8A8E] mb-8">
              欢迎来到弈智 AI 学习平台。让 AI 为你定制专属的学习路径，开启高效学习之旅。
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/onboarding")}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-2xl font-medium text-base md:text-lg transition-colors brand-glow mb-8"
            >
              <Sparkles size={20} />
              创建你的第一个学习计划
            </motion.button>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[
                { icon: GraduationCap, label: "AI 个性化课程" },
                { icon: Target, label: "系统化知识图谱" },
                { icon: MessageCircle, label: "智能问答辅导" },
              ].map((f) => (
                <div key={f.label} className="liquid-glass rounded-xl p-2 md:p-3">
                  <f.icon size={18} className="mx-auto mb-1 md:mb-2 text-[#6E56CF]" />
                  <p className="text-[10px] md:text-xs text-[#8A8A8E]">{f.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ===== 有学习计划 =====
  return (
    <div className="h-full relative overflow-y-auto">
      <WireframeSphere opacity={0.1} />
      <div className="relative z-10 px-3 py-3 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-3 md:mb-8">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-3xl font-semibold text-[#F5F5F7] mb-0.5 md:mb-1 truncate">
                你好，{user?.name || "学习者"}
              </h1>
              <p className="text-xs md:text-sm text-[#8A8A8E] truncate">
                {store.goal ? (
                  <>正在学习：<span className="text-[#A78BFA]">{store.goal}</span></>
                ) : (
                  `你有 ${activeCount} 个进行中的学习计划`
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <div className="liquid-glass px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-1">
                <Flame size={12} className="text-[#FF9500]" />
                <span className="text-[10px] md:text-xs font-medium text-[#FF9500]">{activeCount}/7</span>
              </div>
              {canCreateNew && (
                <button
                  onClick={() => navigate("/onboarding")}
                  className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-lg text-[10px] md:text-xs font-medium transition-colors"
                >
                  <Plus size={12} /> <span className="hidden sm:inline">新建</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* 当前计划区（有 currentPlanId 时展示） */}
        {store.currentPlanId && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
              {[
                { label: "总体进度", value: `${progress}%`, icon: Target, color: "#6E56CF", detail: `${store.currentDay}/${store.totalDays} 天` },
                { label: "掌握度", value: `${Math.round(masteryStats?.avgScore || 0)}%`, icon: TrendingUp, color: "#34C759", detail: `${masteryStats?.totalTopics || 0} 个知识点` },
                { label: "学习时长", value: `${masteryStats?.totalStudyMinutes || 0}`, icon: Clock, color: "#FF9500", detail: "分钟" },
                { label: "问答次数", value: `${masteryStats?.totalQuestions || 0}`, icon: BookOpen, color: "#A78BFA", detail: "次提问" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5 liquid-glass-hover cursor-pointer"
                  onClick={() => stat.label === "掌握度" ? navigate("/mastery") : undefined}
                >
                  <div className="flex items-center justify-between mb-1.5 md:mb-3">
                    <stat.icon size={16} style={{ color: stat.color }} />
                    <ChevronRight size={12} className="text-[#8A8A8E]" />
                  </div>
                  <div className="text-lg md:text-2xl font-semibold text-[#F5F5F7] mb-0.5 md:mb-1">{stat.value}</div>
                  <div className="text-[11px] md:text-xs text-[#8A8A8E]">{stat.label}</div>
                  <div className="text-[9px] md:text-xs text-[#8A8A8E] mt-0.5 md:mt-1">{stat.detail}</div>
                </motion.div>
              ))}
            </div>

            {/* 今日学习 + 右侧面板 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-4 md:mb-6">
              {/* Today's Learning */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-2 liquid-glass rounded-xl md:rounded-2xl p-3 md:p-6"
              >
                <div className="flex items-center justify-between gap-2 mb-3 md:mb-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm md:text-lg font-semibold text-[#F5F5F7]">今日学习</h2>
                    <p className="text-[11px] md:text-sm text-[#8A8A8E] truncate">
                      {todayOutline ? todayOutline.title : "暂无安排"}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/study")}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors brand-glow whitespace-nowrap flex-shrink-0"
                  >
                    学习 <ArrowRight size={14} />
                  </button>
                </div>

                {todayOutline && (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-[rgba(110,86,207,0.15)] flex items-center justify-center flex-shrink-0">
                        <BookOpen size={16} className="text-[#6E56CF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F5F5F7] truncate">{todayOutline.title}</p>
                        <p className="text-xs text-[#8A8A8E] truncate">{todayOutline.goal}</p>
                      </div>
                      <div className="text-xs text-[#8A8A8E] flex-shrink-0">~{todayOutline.estimatedMinutes}分钟</div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#8A8A8E]">总体进度</span>
                        <span className="text-xs font-medium text-[#6E56CF]">{progress}%</span>
                      </div>
                      <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #6E56CF, #A78BFA)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 完成计划按钮 */}
                {progress >= 100 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                    <button
                      onClick={() => handleCompletePlan(store.currentPlanId!)}
                      disabled={completingId === store.currentPlanId}
                      className="w-full py-2.5 bg-[rgba(52,199,89,0.1)] hover:bg-[rgba(52,199,89,0.2)] text-[#34C759] border border-[rgba(52,199,89,0.2)] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {completingId === store.currentPlanId ? (
                        <div className="w-4 h-4 border-2 border-[#34C759] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><CheckCircle2 size={16} /> 标记为已完成</>
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>

              {/* Right Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2 md:space-y-4"
              >
                <div className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5">
                  <h3 className="text-xs md:text-sm font-medium text-[#8A8A8E] mb-4">掌握度</h3>
                  <div className="flex items-center justify-center">
                    <div className="relative w-24 h-24 md:w-32 md:h-32">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="url(#masteryGradient)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${(masteryStats?.avgScore || 0) * 2.64} 264`}
                          className="progress-ring-circle"
                        />
                        <defs>
                          <linearGradient id="masteryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6E56CF" />
                            <stop offset="100%" stopColor="#34C759" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg md:text-2xl font-semibold text-[#F5F5F7]">{Math.round(masteryStats?.avgScore || 0)}%</span>
                        <span className="text-[10px] md:text-xs text-[#8A8A8E]">总体</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 快速操作 */}
                <div className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5">
                  <h3 className="text-xs md:text-sm font-medium text-[#8A8A8E] mb-3">快速操作</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => navigate("/study")}
                      className="w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg md:rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] transition-all text-left"
                    >
                      <BookOpen size={14} className="text-[#6E56CF]" />
                      <span className="text-xs md:text-sm text-[#F5F5F7]">继续学习</span>
                    </button>
                    <button
                      onClick={() => navigate("/mastery")}
                      className="w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg md:rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] transition-all text-left"
                    >
                      <TrendingUp size={14} className="text-[#34C759]" />
                      <span className="text-xs md:text-sm text-[#F5F5F7]">查看掌握度</span>
                    </button>
                    <button
                      onClick={() => setShowAllPlans(!showAllPlans)}
                      className="w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg md:rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] transition-all text-left"
                    >
                      <Award size={14} className="text-[#FF9500]" />
                      <span className="text-xs md:text-sm text-[#F5F5F7]">
                        {showAllPlans ? "收起计划" : `管理计划 (${plans?.length || 0})`}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* 计划列表 */}
        <AnimatePresence>
          {(showAllPlans || !store.currentPlanId) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 md:mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm md:text-base font-semibold text-[#F5F5F7]">
                  {store.currentPlanId ? "全部计划" : "选择一个计划开始学习"}
                </h2>
                {!canCreateNew && (
                  <div className="flex items-center gap-1 text-[10px] md:text-xs text-[#FF9500]">
                    <AlertCircle size={12} />
                    已有 7 个未完成计划
                  </div>
                )}
              </div>

              {/* 进行中 */}
              {activePlans.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-[10px] md:text-xs text-[#8A8A8E] uppercase tracking-wider">进行中</p>
                  {activePlans.map((plan) => (
                    <SwipeablePlanItem
                      key={plan.id}
                      plan={plan}
                      isCurrent={plan.id === store.currentPlanId}
                      onSelect={() => switchToPlan(plan)}
                      onDelete={() => setDeleteTarget(plan.id)}
                    />
                  ))}
                </div>
              )}

              {/* 已完成 */}
              {completedPlans.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] md:text-xs text-[#8A8A8E] uppercase tracking-wider">已完成</p>
                  {completedPlans.map((plan) => (
                    <SwipeablePlanItem
                      key={plan.id}
                      plan={plan}
                      isCurrent={plan.id === store.currentPlanId}
                      onSelect={() => switchToPlan(plan)}
                      onDelete={() => setDeleteTarget(plan.id)}
                    />
                  ))}
                </div>
              )}

              {/* 新建计划按钮 */}
              {canCreateNew ? (
                <button
                  onClick={() => navigate("/onboarding")}
                  className="w-full mt-3 py-3 border border-dashed border-[rgba(110,86,207,0.3)] rounded-xl text-[#A78BFA] hover:bg-[rgba(110,86,207,0.05)] transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={16} /> 添加新的学习计划
                </button>
              ) : (
                <div className="mt-3 p-3 rounded-xl border border-[rgba(255,149,0,0.15)] bg-[rgba(255,149,0,0.05)] flex items-center gap-2 text-[10px] md:text-xs text-[#FF9500]">
                  <AlertCircle size={14} />
                  你已有 7 个未完成的学习计划。请先完成部分计划，或标记为已完成后再添加新的学习内容。
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 删除确认弹窗 */}
        <AnimatePresence>
          {deleteTarget !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
              onClick={() => { if (!deletingId) setDeleteTarget(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="liquid-glass rounded-2xl p-5 md:p-6 max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[rgba(255,59,48,0.1)] flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} className="text-[#FF3B30]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F5F5F7]">确认删除？</h3>
                    <p className="text-xs text-[#8A8A8E]">此操作不可撤销</p>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-[#8A8A8E] mb-5 leading-relaxed">
                  删除后，该学习计划的所有数据（包括学习大纲、学习内容、答题记录、掌握度评分、问答历史）将被永久删除。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { if (!deletingId) setDeleteTarget(null); }}
                    disabled={!!deletingId}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-primary)" }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!!deletingId}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] hover:bg-[#E6352B] disabled:bg-[rgba(255,59,48,0.3)] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingId === deleteTarget ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>删除</>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
