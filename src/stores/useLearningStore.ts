import { create } from "zustand";

interface OutlineItem {
  dayNumber: number;
  title: string;
  goal: string;
  keywords: string;
  estimatedMinutes: number;
}

// 持久化数据结构
interface PersistedState {
  currentPlanId: number | null;
  currentDay: number;
  totalDays: number;
  goal: string;
  subject: string;
  outline: OutlineItem[];
}

interface LearningState extends PersistedState {
  currentContent: string;
  isContentLoading: boolean;
  isStreaming: boolean;
  generationProgress: number;
  generationStage: string;
  masteryData: Array<{ knowledgeName: string; masteryScore: number }>;
  currentUserId: number | null;

  setCurrentPlan: (planId: number, goal: string, subject: string, totalDays: number) => void;
  setCurrentDay: (day: number) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setCurrentContent: (content: string) => void;
  setContentLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setGenerationProgress: (progress: number, stage: string) => void;
  setMasteryData: (data: LearningState["masteryData"]) => void;
  restoreFromDB: (plan: { id: number; goal: string; subject: string | null; totalDays: number; currentDay: number }, userId: number) => void;
  switchUser: (userId: number) => void;
  reset: () => void;
}

// 根据 userId 生成隔离的 localStorage key
function getStorageKey(userId: number | null): string {
  if (!userId) return "yizhi_learning_state_guest";
  return `yizhi_learning_state_${userId}`;
}

// 从 localStorage 读取指定用户的学习状态
function loadPersisted(userId: number | null): PersistedState {
  if (!userId) {
    return { currentPlanId: null, currentDay: 1, totalDays: 30, goal: "", subject: "", outline: [] };
  }
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        currentPlanId: parsed.currentPlanId ?? null,
        currentDay: parsed.currentDay ?? 1,
        totalDays: parsed.totalDays ?? 30,
        goal: parsed.goal ?? "",
        subject: parsed.subject ?? "",
        outline: parsed.outline ?? [],
      };
    }
  } catch {
    // 忽略解析错误
  }
  return { currentPlanId: null, currentDay: 1, totalDays: 30, goal: "", subject: "", outline: [] };
}

// 持久化指定用户的学习状态
function persist(userId: number | null, state: PersistedState) {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // 忽略写入错误
  }
}

// 清除所有用户的 localStorage（用于退出登录）
function clearAllPersisted() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("yizhi_learning_state_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// 初始状态（没有用户时的默认值）
const emptyState: Omit<LearningState, keyof {
  setCurrentPlan: unknown; setCurrentDay: unknown; setOutline: unknown;
  setCurrentContent: unknown; setContentLoading: unknown; setStreaming: unknown;
  setGenerationProgress: unknown; setMasteryData: unknown;
  restoreFromDB: unknown; switchUser: unknown; reset: unknown;
}> = {
  currentPlanId: null,
  currentDay: 1,
  totalDays: 30,
  goal: "",
  subject: "",
  outline: [],
  currentContent: "",
  isContentLoading: false,
  isStreaming: false,
  generationProgress: 0,
  generationStage: "",
  masteryData: [],
  currentUserId: null,
};

// 从当前状态构建持久化数据
function buildPersistData(state: { currentPlanId: number | null; currentDay: number; totalDays: number; goal: string; subject: string; outline: OutlineItem[] }): PersistedState {
  return {
    currentPlanId: state.currentPlanId,
    currentDay: state.currentDay,
    totalDays: state.totalDays,
    goal: state.goal,
    subject: state.subject,
    outline: state.outline,
  };
}

export const useLearningStore = create<LearningState>((set, get) => ({
  ...emptyState,

  setCurrentPlan: (planId, goal, subject, totalDays) => {
    const state = get();
    const persistData = buildPersistData({
      ...state,
      currentPlanId: planId,
      goal,
      subject,
      totalDays,
    });
    persist(state.currentUserId, persistData);
    set({ currentPlanId: planId, goal, subject, totalDays });
  },

  setCurrentDay: (day) => {
    const s = get();
    const persistData = buildPersistData({ ...s, currentDay: day });
    persist(s.currentUserId, persistData);
    set({ currentDay: day });
  },

  setOutline: (outline) => {
    const s = get();
    const persistData = buildPersistData({ ...s, outline });
    persist(s.currentUserId, persistData);
    set({ outline });
  },

  setCurrentContent: (content) => set({ currentContent: content }),

  setContentLoading: (loading) => set({ isContentLoading: loading }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setGenerationProgress: (progress, stage) =>
    set({ generationProgress: progress, generationStage: stage }),

  setMasteryData: (data) => set({ masteryData: data }),

  restoreFromDB: (plan, userId) => {
    const s = get();

    // 1. 先保存当前用户的状态（如果当前有登录用户且与目标用户不同）
    if (s.currentUserId && s.currentUserId !== userId) {
      persist(s.currentUserId, buildPersistData(s));
    }

    // 2. 检查当前内存中的 planId 是否与目标 plan 相同
    //    只有真正切换计划时才清空 outline；同计划（如页面刷新恢复）保留内存中的 outline
    const isSamePlan = s.currentPlanId === plan.id;

    // 3. 如果切换到了不同计划，也尝试先保存当前状态到 localStorage
    if (!isSamePlan && s.currentUserId) {
      persist(s.currentUserId, buildPersistData(s));
    }

    const state = buildPersistData({
      currentPlanId: plan.id,
      goal: plan.goal,
      subject: plan.subject || plan.goal,
      totalDays: plan.totalDays,
      currentDay: plan.currentDay,
      outline: isSamePlan ? s.outline : [], // 同计划保留大纲，切换计划才清空
    });
    persist(userId, state);
    set({ ...state, currentUserId: userId });
  },

  // 切换用户：读取新用户的 localStorage 数据
  switchUser: (userId) => {
    const s = get();
    // 如果当前已有用户，先保存当前用户状态
    if (s.currentUserId && s.currentUserId !== userId) {
      persist(s.currentUserId, buildPersistData(s));
    }

    // 加载新用户状态
    const persisted = loadPersisted(userId);
    set({
      currentUserId: userId,
      currentPlanId: persisted.currentPlanId,
      currentDay: persisted.currentDay,
      totalDays: persisted.totalDays,
      goal: persisted.goal,
      subject: persisted.subject,
      outline: persisted.outline,
      currentContent: "",
      isContentLoading: false,
      isStreaming: false,
      generationProgress: 0,
      generationStage: "",
      masteryData: [],
    });
  },

  reset: () => {
    clearAllPersisted();
    set({ ...emptyState });
  },
}));
