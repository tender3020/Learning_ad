import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { setNativeTextMenuEnabled } from "@/lib/nativeTextMenu";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import WireframeSphere from "@/components/3d/WireframeSphere";
import PlanItem from "@/components/PlanItem";
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
  Check,
  Pin,
} from "lucide-react";

function pinKey(userId: number) {
  return `yizhi-pinned-plans-${userId}`;
}

function loadPinned(userId: number): number[] {
  try {
    const raw = localStorage.getItem(pinKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function savePinned(userId: number, ids: number[]) {
  localStorage.setItem(pinKey(userId), JSON.stringify(ids));
}

function sortByPin<T extends { id: number }>(list: T[], pinned: number[]): T[] {
  const rank = new Map(pinned.map((id, i) => [id, i]));
  return [...list].sort((a, b) => {
    const pa = rank.has(a.id);
    const pb = rank.has(b.id);
    if (pa && pb) return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
    if (pa) return -1;
    if (pb) return 1;
    return 0;
  });
}

type PlanActionMenuProps = {
  x: number;
  y: number;
  pinned: boolean;
  onClose: () => void;
  onMultiSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
};

function PlanActionMenu({ x, y, pinned, onClose, onMultiSelect, onTogglePin, onDelete }: PlanActionMenuProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y + 8, ready: false });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 12;
    let left = x;
    let top = y + 10;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (left < pad) left = pad;
    if (top + rect.height > window.innerHeight - pad) top = y - rect.height - 10;
    if (top < pad) top = pad;
    setPos({ left, top, ready: true });
  }, [x, y]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80]"
      style={{ backgroundColor: "color-mix(in srgb, var(--bg-primary) 28%, transparent)" }}
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div
        ref={boxRef}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: pos.ready ? 1 : 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="absolute w-[min(240px,calc(100vw-24px))] rounded-2xl overflow-hidden"
        style={{
          left: pos.left,
          top: pos.top,
          backgroundColor: "var(--surface-elevated)",
          boxShadow: "0 12px 40px color-mix(in srgb, var(--text-primary) 18%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-token-primary hover-surface"
          onClick={onMultiSelect}
        >
          <Check size={16} /> 多选
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-token-primary hover-surface"
          onClick={onTogglePin}
        >
          <Pin size={16} /> {pinned ? "取消置顶" : "置顶"}
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm hover-surface"
          style={{ color: "var(--color-danger)" }}
          onClick={onDelete}
        >
          <Trash2 size={16} /> 删除
        </button>
      </motion.div>
    </motion.div>
  );
}

type DashboardProps = {
  embedded?: boolean;
  onPlanActivated?: () => void;
};

export default function Dashboard({ embedded, onPlanActivated }: DashboardProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useLearningStore();
  const userId = user?.id || 0;

  const { data: plans, isLoading: plansLoading } = trpc.learning.getPlans.useQuery();
  const completePlan = trpc.learning.completePlan.useMutation({
    onSuccess: () => utils.learning.getPlans.invalidate(),
  });
  const utils = trpc.useUtils();

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => (userId ? loadPinned(userId) : []));
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<{ planId: number; x: number; y: number } | null>(null);

  const deletePlan = trpc.learning.deletePlan.useMutation({
    onSuccess: (_data, vars) => {
      utils.learning.getPlans.invalidate();
      setDeleteTarget(null);
      setDeletingId(null);
      if (vars.planId === store.currentPlanId) {
        store.reset();
      }
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = async () => {
    const ids = selectMode && selectedIds.size > 0 ? [...selectedIds] : deleteTarget ? [deleteTarget] : [];
    if (ids.length === 0) return;
    setDeletingId(ids[0]);
    for (const id of ids) {
      await deletePlan.mutateAsync({ planId: id });
      if (userId) {
        const next = loadPinned(userId).filter((pid) => pid !== id);
        savePinned(userId, next);
        setPinnedIds(next);
      }
    }
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const activePlans = sortByPin(plans?.filter((p) => p.status === "active") || [], pinnedIds);
  const completedPlans = sortByPin(plans?.filter((p) => p.status === "completed") || [], pinnedIds);
  const activeCount = activePlans.length;
  const canCreateNew = activeCount < 7;
  const progress = store.totalDays > 0 ? Math.round((store.currentDay / store.totalDays) * 100) : 0;
  const menuPlan = plans?.find((p) => p.id === menu?.planId) || null;

  const closePlanMenu = () => {
    setMenu(null);
    setNativeTextMenuEnabled(true);
  };

  const togglePin = (planId: number) => {
    if (!userId) return;
    setPinnedIds((prev) => {
      const next = prev.includes(planId) ? prev.filter((id) => id !== planId) : [planId, ...prev.filter((id) => id !== planId)];
      savePinned(userId, next);
      return next;
    });
  };

  const switchToPlan = (plan: NonNullable<typeof plans>[0]) => {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(plan.id)) next.delete(plan.id);
        else next.add(plan.id);
        return next;
      });
      return;
    }
    store.restoreFromDB(
      {
        id: plan.id,
        goal: plan.goal,
        subject: plan.subject,
        totalDays: plan.totalDays,
        currentDay: plan.currentDay,
      },
      userId,
    );
    onPlanActivated?.();
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

  if (!hasAnyPlan && embedded) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-token-secondary mb-1">还没有学习计划</p>
        <p className="type-caption text-token-secondary">点右上角新建，让 AI 为你定制学习路径</p>
      </div>
    );
  }

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
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 text-[var(--brand-foreground)] rounded-2xl font-medium text-base md:text-lg transition-colors brand-glow mb-8 bg-token-brand hover:opacity-90"
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
    <div className={embedded ? "relative" : "h-full relative overflow-y-auto"}>
      <div className={embedded ? "relative z-10 px-3 pb-4" : "relative z-10 px-3 py-3 md:p-8 max-w-4xl mx-auto"}>
        {!embedded && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-6 hidden desk:block">
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
                className="ml-auto flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 text-[var(--brand-foreground)] rounded-lg type-caption font-medium transition-colors bg-token-brand hover:opacity-90"
              >
                <Plus size={12} /> 新建
              </button>
            )}
          </div>
        </motion.div>
        )}

        {store.currentPlanId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5 mb-4 md:mb-6"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm md:text-lg font-semibold text-token-primary truncate">{store.goal || "学习计划"}</h2>
                <p className="type-caption text-token-secondary mt-1">
                  第 {store.currentDay}/{store.totalDays} 天 · {progress}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate("/today");
                  onPlanActivated?.();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium text-[var(--brand-foreground)] flex-shrink-0 bg-token-brand hover:opacity-90 brand-glow"
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

          <div className="space-y-2 mb-4">
            <p className="type-caption text-token-secondary uppercase tracking-wider">
              进行中{activePlans.length > 0 ? ` · ${activePlans.length}` : ""}
            </p>
            {activePlans.length > 0 ? (
              activePlans.map((plan) => (
                <PlanItem
                  key={plan.id}
                  plan={plan.id === store.currentPlanId
                    ? { ...plan, currentDay: Math.max(plan.currentDay, store.currentDay) }
                    : plan}
                  isCurrent={plan.id === store.currentPlanId}
                  isPinned={pinnedIds.includes(plan.id)}
                  selectMode={selectMode}
                  selected={selectedIds.has(plan.id)}
                  onSelect={() => switchToPlan(plan)}
                  onLongPress={(pos) => setMenu({ planId: plan.id, ...pos })}
                />
              ))
            ) : (
              <p className="type-caption text-token-secondary px-1 py-2">暂无进行中的计划</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="type-caption text-token-secondary uppercase tracking-wider">
              已完成{completedPlans.length > 0 ? ` · ${completedPlans.length}` : ""}
            </p>
            {completedPlans.length > 0 ? (
              completedPlans.map((plan) => (
                <PlanItem
                  key={plan.id}
                  plan={plan.id === store.currentPlanId
                    ? { ...plan, currentDay: Math.max(plan.currentDay, store.currentDay) }
                    : plan}
                  isCurrent={plan.id === store.currentPlanId}
                  isPinned={pinnedIds.includes(plan.id)}
                  selectMode={selectMode}
                  selected={selectedIds.has(plan.id)}
                  onSelect={() => switchToPlan(plan)}
                  onLongPress={(pos) => setMenu({ planId: plan.id, ...pos })}
                />
              ))
            ) : (
              <p className="type-caption text-token-secondary px-1 py-2">暂无已完成的计划</p>
            )}
          </div>

          {!embedded && canCreateNew && (
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              className="hidden desk:flex w-full mt-3 py-3 border border-dashed rounded-xl text-token-brand-light hover:bg-token-brand-muted transition-colors items-center justify-center gap-2 text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--brand-primary) 35%, transparent)" }}
            >
              <Plus size={16} /> 添加新的学习计划
            </button>
          )}

          {selectMode && (
            <div className="sticky bottom-0 mt-4 flex items-center gap-2 py-3" style={{ backgroundColor: "var(--bg-primary)" }}>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
                className="px-3 py-2 text-sm text-token-secondary"
              >
                取消
              </button>
              <span className="flex-1 text-sm text-token-secondary">已选 {selectedIds.size} 项</span>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setDeleteTarget([...selectedIds][0])}
                className="px-3 py-2 text-sm font-medium disabled:opacity-40"
                style={{ color: "var(--color-danger)" }}
              >
                删除
              </button>
            </div>
          )}
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {menu && menuPlan && (
                <PlanActionMenu
                  x={menu.x}
                  y={menu.y}
                  pinned={pinnedIds.includes(menuPlan.id)}
                  onClose={closePlanMenu}
                  onMultiSelect={() => {
                    setSelectedIds(new Set([menuPlan.id]));
                    setSelectMode(true);
                    closePlanMenu();
                  }}
                  onTogglePin={() => {
                    togglePin(menuPlan.id);
                    closePlanMenu();
                  }}
                  onDelete={() => {
                    setDeleteTarget(menuPlan.id);
                    closePlanMenu();
                  }}
                />
              )}
            </AnimatePresence>,
            document.body,
          )}

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
                  {selectMode && selectedIds.size > 1
                    ? `将删除 ${selectedIds.size} 个计划及其大纲、内容与问答记录，此操作不可撤销。`
                    : "删除后，该计划的所有大纲、内容、答题与问答记录将被永久删除。"}
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
