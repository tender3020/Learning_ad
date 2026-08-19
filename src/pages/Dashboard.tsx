import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import WireframeSphere from "@/components/3d/WireframeSphere";
import SwipeablePlanItem from "@/components/SwipeablePlanItem";
import {
  Target,
  Sparkles,
  GraduationCap,
  MessageCircle,
  Plus,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowRight,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useLearningStore();

  const { data: plans, isLoading: plansLoading } = trpc.learning.getPlans.useQuery();
  const completePlan = trpc.learning.completePlan.useMutation({
    onSuccess: () => utils.learning.getPlans.invalidate(),
  });
  const utils = trpc.useUtils();

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deletePlan = trpc.learning.deletePlan.useMutation({
    onSuccess: () => {
      utils.learning.getPlans.invalidate();
      setDeleteTarget(null);
      setDeletingId(null);
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

  const activePlans = plans?.filter((p) => p.status === "active") || [];
  const completedPlans = plans?.filter((p) => p.status === "completed") || [];
  const activeCount = activePlans.length;
  const canCreateNew = activeCount < 7;
  const progress = store.totalDays > 0 ? Math.round((store.currentDay / store.totalDays) * 100) : 0;

  const switchToPlan = (plan: NonNullable<typeof plans>[0]) => {
    store.restoreFromDB(
      {
        id: plan.id,
        goal: plan.goal,
        subject: plan.subject,
        totalDays: plan.totalDays,
        currentDay: plan.currentDay,
      },
      user?.id || 0,
    );
  };

  const handleCompletePlan = async (planId: number) => {
    setCompletingId(planId);
    await completePlan.mutateAsync({ planId });
    setCompletingId(null);
  };

  if (plansLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--brand-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const hasAnyPlan = plans && plans.length > 0;

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
            <h1 className="text-2xl md:text-3xl font-semibold text-token-primary mb-3">
              你好，{user?.name || "学习者"}
            </h1>
            <p className="text-sm md:text-base text-token-secondary mb-8">
              让 AI 为你定制专属学习路径，开启高效学习之旅。
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/onboarding")}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 text-white rounded-2xl font-medium text-base md:text-lg transition-colors brand-glow mb-8 bg-token-brand hover:opacity-90"
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
                  <f.icon size={18} className="mx-auto mb-1 md:mb-2 text-token-brand" />
                  <p className="type-caption text-token-secondary">{f.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-y-auto">
      <div className="relative z-10 px-3 py-3 md:p-8 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-3xl font-semibold text-token-primary mb-0.5">学习计划</h1>
              <p className="text-xs md:text-sm text-token-secondary">
                {activeCount} 个进行中 · 最多 7 个并行计划
              </p>
            </div>
            {canCreateNew && (
              <button
                type="button"
                onClick={() => navigate("/onboarding")}
                className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 text-white rounded-lg type-caption font-medium transition-colors bg-token-brand hover:opacity-90"
              >
                <Plus size={12} /> 新建
              </button>
            )}
          </div>
        </motion.div>

        {store.currentPlanId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5 mb-4 md:mb-6"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="type-caption text-token-brand mb-1">当前计划</p>
                <h2 className="text-sm md:text-lg font-semibold text-token-primary truncate">{store.goal || "学习计划"}</h2>
                <p className="type-caption text-token-secondary mt-1">
                  第 {store.currentDay}/{store.totalDays} 天 · {progress}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/today")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium text-white flex-shrink-0 bg-token-brand hover:opacity-90 brand-glow"
              >
                今日学习 <ArrowRight size={14} />
              </button>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))",
                }}
              />
            </div>
            {progress >= 100 && (
              <button
                type="button"
                onClick={() => handleCompletePlan(store.currentPlanId!)}
                disabled={completingId === store.currentPlanId}
                className="w-full mt-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-success) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--color-success) 25%, transparent)",
                  color: "var(--color-success)",
                }}
              >
                {completingId === store.currentPlanId ? (
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: "var(--color-success)", borderTopColor: "transparent" }}
                  />
                ) : (
                  <>
                    <CheckCircle2 size={16} /> 标记为已完成
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}

        <div className="mb-4 md:mb-6">
          {!canCreateNew && (
            <div className="mb-3 p-3 rounded-xl border flex items-center gap-2 type-caption"
              style={{
                borderColor: "color-mix(in srgb, var(--color-warning) 25%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                color: "var(--color-warning)",
              }}
            >
              <AlertCircle size={14} />
              你已有 7 个未完成计划，请先完成或删除后再添加
            </div>
          )}

          {activePlans.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="type-caption text-token-secondary uppercase tracking-wider">进行中</p>
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

          {completedPlans.length > 0 && (
            <div className="space-y-2">
              <p className="type-caption text-token-secondary uppercase tracking-wider">已完成</p>
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

          {canCreateNew && (
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              className="w-full mt-3 py-3 border border-dashed rounded-xl text-token-brand-light hover:bg-token-brand-muted transition-colors flex items-center justify-center gap-2 text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--brand-primary) 35%, transparent)" }}
            >
              <Plus size={16} /> 添加新的学习计划
            </button>
          )}
        </div>

        <AnimatePresence>
          {deleteTarget !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
              onClick={() => {
                if (!deletingId) setDeleteTarget(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="liquid-glass rounded-2xl p-5 md:p-6 max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "color-mix(in srgb, var(--color-danger) 12%, transparent)" }}
                  >
                    <Trash2 size={18} style={{ color: "var(--color-danger)" }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-token-primary">确认删除？</h3>
                    <p className="text-xs text-token-secondary">此操作不可撤销</p>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-token-secondary mb-5 leading-relaxed">
                  删除后，该计划的所有大纲、内容、答题与问答记录将被永久删除。
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!deletingId) setDeleteTarget(null);
                    }}
                    disabled={!!deletingId}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover-surface"
                    style={{ backgroundColor: "var(--surface-hover)", color: "var(--text-primary)" }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!!deletingId}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-danger)" }}
                  >
                    {deletingId === deleteTarget ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "删除"
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
