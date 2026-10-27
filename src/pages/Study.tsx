import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import { aiService } from "@/services/aiService";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { useReadingPrefs } from "@/hooks/useReadingPrefs";
import { setNativeStatusBarVisible } from "@/lib/nativeStatusBar";
import { useReadingScrollPersistence } from "@/hooks/useReadingScrollPersistence";
import TtsButton from "@/components/TtsButton";
import TodayHeader, { type TodayContentState } from "@/components/today/TodayHeader";
import ReadingMarkdown from "@/components/reading/ReadingMarkdown";
import ReadingShell from "@/components/reading/ReadingShell";
import ReadingToolbar, { ReadingSettingsButton } from "@/components/reading/ReadingToolbar";
import MobileSideDrawer from "@/components/ui/MobileSideDrawer";
import StudyDayOutline, { StudyDayOutlineNav } from "@/components/study/StudyDayOutline";
import QaThread from "@/components/study/QaThread";
import { buildDayContentPrompt } from "@shared/contentPrompt";
import type { LearningType } from "@shared/typeEngine";
import {
  Send,
  Loader2,
  MessageCircle,
  Sparkles,
  GraduationCap,
  X,
  ChevronLeft,
} from "lucide-react";

const CHROME_MOTION_MS = 460;
const CHROME_MOTION_EASE = "cubic-bezier(0.42, 0, 0.58, 1)";

type ChromeKind = "top" | "header" | "ask" | "side";

const savedChromeBg = new WeakMap<HTMLElement, string>();

function chromeKind(el: HTMLElement): ChromeKind {
  if (el.classList.contains("study-ask-bar")) return "ask";
  if (el.classList.contains("study-desktop-sidebar")) return "side";
  if (el.classList.contains("app-mobile-topbar")) return "top";
  return "header";
}

function hiddenChromeTransform(kind: ChromeKind, dy: number, rect: DOMRect) {
  if (kind === "ask") return "translate3d(0, 100%, 0)";
  if (kind === "side") return `translate3d(${-Math.ceil(rect.right)}px, 0, 0)`;
  return `translate3d(0, ${-dy}px, 0)`;
}

function clearChromeMotion(el: HTMLElement) {
  el.style.position = "";
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
  el.style.margin = "";
  el.style.zIndex = "";
  el.style.transform = "";
  el.style.transition = "";
  el.style.boxSizing = "";
  el.style.pointerEvents = "";
  el.style.willChange = "";
  el.style.opacity = "";
  if (savedChromeBg.has(el)) {
    el.style.backgroundColor = savedChromeBg.get(el) ?? "";
    savedChromeBg.delete(el);
  }
}

function pinChrome(el: HTMLElement, rect: DOMRect) {
  if (!savedChromeBg.has(el)) savedChromeBg.set(el, el.style.backgroundColor);
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.margin = "0";
  el.style.boxSizing = "border-box";
  el.style.zIndex = el.classList.contains("study-desktop-sidebar") ? "12" : "40";
  el.style.pointerEvents = "none";
  el.style.willChange = "transform";
  if (!el.classList.contains("study-desktop-sidebar")) {
    el.style.backgroundColor = "var(--bg-primary)";
  }
  const next = el.getBoundingClientRect();
  const dx = rect.left - next.left;
  const dy = rect.top - next.top;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    el.style.left = `${rect.left + dx}px`;
    el.style.top = `${rect.top + dy}px`;
  }
}

function collectChrome(scroller: HTMLElement) {
  const column = scroller.parentElement?.parentElement;
  const frame = column?.parentElement;
  const nodes = [
    document.querySelector<HTMLElement>(".app-mobile-topbar"),
    column?.querySelector<HTMLElement>(":scope > .today-header") ?? null,
    column?.querySelector<HTMLElement>(":scope > .study-ask-bar") ?? null,
    frame?.querySelector<HTMLElement>(":scope > .study-desktop-sidebar") ?? null,
  ];
  return nodes.filter((el): el is HTMLElement => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().height > 1);
}

export default function Study() {
  const store = useLearningStore();

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [question, setQuestion] = useState("");
  const [showQA, setShowQA] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [qaMessages, setQaMessages] = useState<Array<{ type: "user" | "ai"; text: string }>>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [error, setError] = useState("");
  const qaChunkRef = useRef("");
  const qaFlushRef = useRef<number | null>(null);
  const qaStreamingRef = useRef(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const prevContentLenRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const studyMinutesRef = useRef(0); // 学习时长追踪（分钟）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingSessionStartRef = useRef<number | null>(null);
  const tts = useTtsPlayer();
  const { prefs: readingPrefs, setPrefs: setReadingPrefs, setFontFamily, fontLoading } = useReadingPrefs();
  const [showReadingSettings, setShowReadingSettings] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);

  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [breakDismissed, setBreakDismissed] = useState(false);
  const [isIllustrating, setIsIllustrating] = useState(false);

  const activeDayRef = useRef<HTMLButtonElement>(null);

  const { user } = useAuth();
  const { data: plans, isLoading: plansLoading } = trpc.learning.getPlans.useQuery();
  const { data: outlineData } = trpc.learning.getOutline.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId }
  );
  const dbOutline = outlineData?.outline || [];
  const planLearningType = (outlineData?.learningType as any) || "abstract_logic";
  const { data: existingContent } = trpc.content.getContent.useQuery(
    { planId: store.currentPlanId || 0, dayNumber: store.currentDay },
    { enabled: !!store.currentPlanId }
  );
  // 查询当前计划的评估结果（skillLevel）
  const { data: assessmentResult } = trpc.assessment.getByPlan.useQuery(
    { planId: store.currentPlanId || 0 },
    { enabled: !!store.currentPlanId }
  );
  // 查询当前天的问答历史（按天隔离）
  const { data: qaHistory } = trpc.qa.getHistory.useQuery(
    { planId: store.currentPlanId || 0, dayNumber: store.currentDay },
    { enabled: !!store.currentPlanId }
  );
  const utils = trpc.useUtils();
  const updateProgress = trpc.learning.updateProgress.useMutation({
    onSuccess: () => {
      utils.learning.getPlans.invalidate();
    },
  });

  // 学习天数前进时写回数据库，计划列表才能显示真实进度
  useEffect(() => {
    if (!store.currentPlanId || !plans) return;
    const row = plans.find((p) => p.id === store.currentPlanId);
    if (row && store.currentDay > row.currentDay) {
      updateProgress.mutate({ planId: store.currentPlanId, currentDay: store.currentDay });
    }
  }, [store.currentPlanId, store.currentDay, plans]);

  const saveContent = trpc.content.saveContent.useMutation({
    onSuccess: () => {
      const planId = store.currentPlanId || 0;
      const dayNumber = store.currentDay;
      utils.content.getContent.invalidate({ planId, dayNumber });

      setIsIllustrating(true);
      let polls = 0;
      const pollTimer = setInterval(() => {
        polls += 1;
        utils.content.getContent.invalidate({ planId, dayNumber });
        if (polls >= 12) {
          clearInterval(pollTimer);
          setIsIllustrating(false);
        }
      }, 15000);
    },
  });

  // 优先使用数据库大纲（真相来源），store.outline 作为 loading 期间的 fallback
  const effectiveOutline = dbOutline.length > 0
    ? dbOutline
    : store.outline;
  const todayItem = effectiveOutline[store.currentDay - 1];
  const contentTtsId = `content-day-${store.currentDay}`;
  const contentSpeechText = todayItem && content
    ? `${todayItem.title}。${content}`
    : content;
  const canAskQA = !!content?.trim() && !isStreaming;
  const qaContextLabel = todayItem
    ? `基于：第 ${store.currentDay} 天 · ${todayItem.title}`
    : "请先完成今日学习内容";
  const qaInputPlaceholder = canAskQA ? "尽管问..." : "请先生成今日学习内容";

  const contentVersion = useMemo(() => {
    if (existingContent?.generatedAt) {
      return new Date(existingContent.generatedAt).toISOString();
    }
    return `draft:${content.length}`;
  }, [existingContent?.generatedAt, content.length]);

  const { clearSaved: clearReadingScroll } = useReadingScrollPersistence({
    scrollRef: contentScrollRef,
    planId: store.currentPlanId,
    dayNumber: store.currentDay,
    userId: user?.id,
    content,
    contentVersion,
    enabled: !!content?.trim() && !isStreaming && !isLoading,
  });

  const todayContentState: TodayContentState = isStreaming
    ? "streaming"
    : isLoading && !content
      ? "loading"
      : isIllustrating && content
        ? "illustrating"
        : content
          ? "ready"
          : "empty";

  // 学习时长追踪：每60秒增加1分钟计数
  useEffect(() => {
    if (!store.currentPlanId || !todayItem) return;
    timerRef.current = setInterval(() => {
      studyMinutesRef.current += 1;
    }, 60000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [store.currentPlanId, todayItem]);

  // 组件卸载时提交学习时长
  const recordStudy = trpc.mastery.recordStudy.useMutation();
  useEffect(() => {
    return () => {
      const minutes = studyMinutesRef.current;
      if (minutes > 0 && store.currentPlanId && todayItem) {
        recordStudy.mutate({
          planId: store.currentPlanId,
          knowledgeName: todayItem.title,
          minutes,
          targetMinutes: todayItem.estimatedMinutes || 30,
        });
      }
    };
  }, []); // 空依赖：只在卸载时执行

  // 答题提交后刷新掌握度数据
  const handleQuizSubmitted = useCallback(() => {
    if (store.currentPlanId) {
      utils.mastery.getScores.invalidate({ planId: store.currentPlanId });
      utils.mastery.getStats.invalidate({ planId: store.currentPlanId });
    }
  }, [store.currentPlanId, utils]);

  // 自动恢复
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
        user?.id || 0
      );
    }
  }, [store, plans]);

  useEffect(() => { restorePlan(); }, [restorePlan]);

  useEffect(() => {
    if (existingContent?.markdownContent) {
      const el = contentScrollRef.current;
      const prevScroll = el?.scrollTop ?? 0;
      const prevLen = prevContentLenRef.current;
      const newMarkdown = existingContent.markdownContent;

      setContent(newMarkdown);

      if (el && prevLen > 0 && newMarkdown.length !== prevLen) {
        requestAnimationFrame(() => {
          if (contentScrollRef.current) {
            contentScrollRef.current.scrollTop = prevScroll;
          }
        });
      }
      prevContentLenRef.current = newMarkdown.length;
    } else {
      setContent("");
      prevContentLenRef.current = 0;
    }
  }, [existingContent, store.currentDay]);

  const handleGenerateContent = async () => {
    if (!todayItem || !store.currentPlanId) return;
    setIsLoading(true);
    setIsStreaming(true);
    store.setContentLoading(true);
    store.setStreaming(true);
    setError("");

    const prevDayItem =
      store.currentDay > 1 ? effectiveOutline[store.currentDay - 2] : undefined;
    const prompt = buildDayContentPrompt({
      planGoal: outlineData?.goal || store.goal || todayItem.title,
      dayNumber: store.currentDay,
      totalDays: store.totalDays,
      today: {
        title: todayItem.title,
        goal: todayItem.goal || "",
        keywords: todayItem.keywords || "",
        phaseName: todayItem.phaseName ?? undefined,
        phaseOrder: todayItem.phaseOrder ?? undefined,
        difficulty: todayItem.difficulty ?? undefined,
        prerequisites: todayItem.prerequisites ?? undefined,
        learningObjective: todayItem.learningObjective ?? undefined,
        estimatedMinutes: todayItem.estimatedMinutes ?? 30,
      },
      prevDay: prevDayItem
        ? {
            title: prevDayItem.title,
            goal: prevDayItem.goal || "",
            learningObjective: prevDayItem.learningObjective ?? undefined,
          }
        : undefined,
      learningType: (planLearningType as LearningType) || "abstract_logic",
      skillLevel: assessmentResult?.skillLevel || "l1",
    });

    // 获取 skillLevel 和 learningType（未评估默认零基础 l1）
    const skillLevel = assessmentResult?.skillLevel || "l1";
    const learningType = planLearningType || "abstract_logic";

    let fullText = "";
    await aiService.streamContent(prompt, learningType, skillLevel, {
      onToken: (token) => { fullText += token; setContent(fullText); },
      onComplete: async (text) => {
        setIsStreaming(false); setIsLoading(false);
        store.setContentLoading(false); store.setStreaming(false);
        try {
          await saveContent.mutateAsync({
            planId: store.currentPlanId!, outlineId: todayItem.dayNumber,
            dayNumber: store.currentDay, markdownContent: text,
          });
        } catch (e: any) { console.error("保存失败:", e.message); }
      },
      onError: (err) => {
        setIsStreaming(false); setIsLoading(false);
        store.setContentLoading(false); store.setStreaming(false);
        setError(`生成失败: ${err}`);
      },
    }, {
      dayNumber: store.currentDay,
      phaseOrder: todayItem.phaseOrder ?? undefined,
      totalDays: store.totalDays,
      phaseName: todayItem.phaseName ?? undefined,
      phaseGoal: todayItem.goal || undefined,
    });
  };

  const openQA = () => {
    if (!canAskQA) {
      openOutline();
      return;
    }
    setShowQA(true);
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || isAiTyping || !store.currentPlanId || !canAskQA) return;
    const userQuestion = question.trim();
    setQaMessages((prev) => [
      ...prev,
      { type: "user", text: userQuestion },
      { type: "ai", text: "" },
    ]);
    setQuestion("");
    setIsAiTyping(true);
    setError("");
    qaChunkRef.current = "";
    qaStreamingRef.current = true;

    const flushQaChunk = () => {
      if (qaFlushRef.current != null) {
        cancelAnimationFrame(qaFlushRef.current);
        qaFlushRef.current = null;
      }
      const chunk = qaChunkRef.current;
      if (!chunk) return;
      qaChunkRef.current = "";
      setQaMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.type === "ai") {
          next[next.length - 1] = { type: "ai", text: last.text + chunk };
        }
        return next;
      });
    };

    await aiService.streamQA(
      store.currentPlanId,
      store.currentDay,
      userQuestion,
      {
        onToken: (token) => {
          qaChunkRef.current += token;
          if (qaFlushRef.current == null) {
            qaFlushRef.current = requestAnimationFrame(flushQaChunk);
          }
        },
        onComplete: () => {
          flushQaChunk();
          qaStreamingRef.current = false;
          setIsAiTyping(false);
          utils.qa.getHistory.invalidate({
            planId: store.currentPlanId!,
            dayNumber: store.currentDay,
          });
          if (store.currentPlanId) {
            utils.mastery.getScores.invalidate({ planId: store.currentPlanId });
            utils.mastery.getStats.invalidate({ planId: store.currentPlanId });
          }
        },
        onError: (err) => {
          flushQaChunk();
          qaStreamingRef.current = false;
          setIsAiTyping(false);
          setQaMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.type === "ai" && !last.text.trim()) {
              next[next.length - 1] = { type: "ai", text: `抱歉，无法回答。${err}` };
            } else if (last?.type === "ai") {
              next[next.length - 1] = {
                type: "ai",
                text: `${last.text}\n\n（回答未完成：${err}）`,
              };
            } else {
              next.push({ type: "ai", text: `抱歉，无法回答。${err}` });
            }
            return next;
          });
        },
      },
    );
  };

  // 当切换天或历史数据到达时，同步 qaMessages（按天隔离）
  useEffect(() => {
    if (qaStreamingRef.current) return;
    if (qaHistory && qaHistory.length > 0) {
      // 按时间正序排列（数据库返回倒序）
      const sorted = [...qaHistory].reverse();
      const messages: Array<{ type: "user" | "ai"; text: string }> = [];
      for (const h of sorted) {
        messages.push({ type: "user", text: h.question });
        if (h.answer) {
          messages.push({ type: "ai", text: h.answer });
        }
      }
      setQaMessages(messages);
    } else {
      setQaMessages([]);
    }
  }, [qaHistory, store.currentDay]);

  const handleContentScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = contentScrollRef.current;
      if (!el) return;

      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
    });
  }, []);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    handleContentScroll();
    el.addEventListener("scroll", handleContentScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleContentScroll);
  }, [content, handleContentScroll]);

  const handleDismissBreak = useCallback(() => {
    setBreakDismissed(true);
    setShowBreakReminder(false);
  }, []);

  const openOutline = useCallback(() => {
    setShowOutline(true);
  }, []);

  useEffect(() => {
    if (!showOutline) return;
    requestAnimationFrame(() => {
      activeDayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [showOutline]);

  // 连续阅读约 30 分钟后提示休息
  useEffect(() => {
    if (!content?.trim() || isStreaming) {
      readingSessionStartRef.current = null;
      return;
    }
    if (readingSessionStartRef.current === null) {
      readingSessionStartRef.current = Date.now();
      setBreakDismissed(false);
      setShowBreakReminder(false);
    }
    const timer = setInterval(() => {
      const start = readingSessionStartRef.current;
      if (!start || breakDismissed) return;
      if (Date.now() - start >= 30 * 60 * 1000) {
        setShowBreakReminder(true);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [content, isStreaming, store.currentDay, breakDismissed]);

  useEffect(() => {
    readingSessionStartRef.current = null;
    setShowBreakReminder(false);
    setBreakDismissed(false);
  }, [store.currentDay]);

  const motionGen = useRef(0);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const scroller = contentScrollRef.current;
    const article = scroller?.querySelector<HTMLElement>(".reading-article") ?? null;
    if (!scroller || !article || article.getClientRects().length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.toggle("reading-immersive", immersive);
      setNativeStatusBarVisible(!immersive);
      return () => {
        root.classList.remove("reading-immersive", "reading-chrome-move");
        delete root.dataset.readingMotion;
        setNativeStatusBarVisible(true);
      };
    }

    const direction = immersive ? "enter" : "exit";
    const gen = ++motionGen.current;
    let timer = 0;
    const transition = `transform ${CHROME_MOTION_MS}ms ${CHROME_MOTION_EASE}`;

    const strip = () => {
      clearChromeMotion(article);
      document.querySelectorAll<HTMLElement>(".app-mobile-topbar, .today-header, .study-ask-bar, .study-desktop-sidebar").forEach((el) => {
        if (el.style.position === "fixed" || el.style.transform || savedChromeBg.has(el)) clearChromeMotion(el);
      });
    };

    const finishEnter = () => {
      if (motionGen.current !== gen) return;
      article.style.transition = "none";
      strip();
      root.classList.remove("reading-chrome-move");
      delete root.dataset.readingMotion;
      root.classList.add("reading-immersive");
      setNativeStatusBarVisible(false);
    };

    const finishExit = () => {
      if (motionGen.current !== gen) return;
      article.style.transition = "none";
      strip();
      root.classList.remove("reading-chrome-move", "reading-immersive");
      delete root.dataset.readingMotion;
      setNativeStatusBarVisible(true);
    };

    const glide = (entering: boolean) => {
      const marker = article.querySelector<HTMLElement>(".reading-shell") ?? article;
      const open = marker.getBoundingClientRect();
      const bars = collectChrome(scroller).map((el) => ({
        el,
        kind: chromeKind(el),
        rect: el.getBoundingClientRect(),
      }));
      root.classList.add("reading-chrome-move", "reading-immersive");
      root.dataset.readingMotion = entering ? "enter" : "exit";
      bars.forEach(({ el, rect }) => pinChrome(el, rect));
      const collapsed = marker.getBoundingClientRect();
      const dx = open.left - collapsed.left;
      const dy = open.top - collapsed.top;
      article.style.willChange = "transform";
      article.style.transition = "none";
      article.style.transform = entering ? `translate3d(${dx}px, ${dy}px, 0)` : "translate3d(0, 0, 0)";
      bars.forEach(({ el, kind, rect }) => {
        el.style.transition = "none";
        el.style.transform = entering ? "translate3d(0, 0, 0)" : hiddenChromeTransform(kind, dy, rect);
      });
      void article.offsetHeight;
      article.style.transition = transition;
      article.style.transform = entering ? "translate3d(0, 0, 0)" : `translate3d(${dx}px, ${dy}px, 0)`;
      bars.forEach(({ el, kind, rect }) => {
        el.style.transition = transition;
        el.style.transform = entering ? hiddenChromeTransform(kind, dy, rect) : "translate3d(0, 0, 0)";
      });
      timer = window.setTimeout(entering ? finishEnter : finishExit, CHROME_MOTION_MS + 40);
    };

    if (root.classList.contains("reading-chrome-move")) {
      if (root.dataset.readingMotion === direction) {
        timer = window.setTimeout(immersive ? finishEnter : finishExit, CHROME_MOTION_MS + 40);
      } else {
        strip();
        root.classList.remove("reading-chrome-move");
        delete root.dataset.readingMotion;
        root.classList.toggle("reading-immersive", immersive);
        setNativeStatusBarVisible(!immersive);
      }
    } else if (immersive) {
      glide(true);
    } else if (root.classList.contains("reading-immersive")) {
      root.classList.remove("reading-immersive");
      glide(false);
    }

    const onVis = () => {
      if (document.visibilityState === "visible" && !root.classList.contains("reading-chrome-move")) {
        setNativeStatusBarVisible(!root.classList.contains("reading-immersive"));
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      const id = gen;
      queueMicrotask(() => {
        if (motionGen.current !== id) return;
        article.style.transition = "none";
        strip();
        root.classList.remove("reading-chrome-move", "reading-immersive");
        delete root.dataset.readingMotion;
        setNativeStatusBarVisible(true);
      });
    };
  }, [immersive]);

  useEffect(() => {
    if (showQA || showOutline) {
      setImmersive(false);
      setShowReadingSettings(false);
    }
  }, [showQA, showOutline]);

  const isReadingChromeTarget = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return true;
    return Boolean(
      el.closest(
        "a, button, input, textarea, select, label, [role='button'], .reading-quiz, .reading-quiz-wrap, .reading-footer, .reading-settings-sheet, .mermaid-lightbox, .mermaid-diagram",
      ),
    );
  };

  const handleReadingPointerDown = (e: React.PointerEvent) => {
    if (document.querySelector(".mermaid-lightbox") || isReadingChromeTarget(e.target)) {
      tapStartRef.current = null;
      return;
    }
    tapStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleReadingPointerUp = (e: React.PointerEvent) => {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (document.querySelector(".mermaid-lightbox") || !start || isReadingChromeTarget(e.target)) return;
    if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) return;
    if (showReadingSettings) {
      setShowReadingSettings(false);
      return;
    }
    if (content && !isStreaming) {
      if (document.documentElement.classList.contains("reading-chrome-move")) return;
      setImmersive((v) => !v);
    }
  };

  const goToDay = (day: number) => {
    if (day >= 1 && day <= store.totalDays) {
      tts.stop();
      store.setCurrentDay(day);
      setContent("");
      setError("");
      setShowOutline(false);
      setQaMessages([]);
      setIsIllustrating(false);
    }
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

  if (!store.currentPlanId) {
    return (
      <div className="h-full flex items-center justify-center relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center max-w-md px-6">
          <GraduationCap size={48} className="mx-auto mb-4 text-token-brand" />
          <h2 className="text-xl md:text-2xl font-semibold text-token-primary mb-2">还没有学习计划</h2>
          <p className="text-sm text-token-secondary mb-6">让 AI 为你定制一个个性化的学习路径。</p>
          <button
            type="button"
            onClick={() => { window.location.href = "/onboarding"; }}
            className="inline-flex items-center gap-2 px-6 py-3 text-[var(--brand-foreground)] rounded-xl font-medium transition-colors brand-glow bg-token-brand hover:opacity-90"
          >
            <Sparkles size={18} /> 创建学习计划
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-full flex relative ${readingPrefs.focusMode ? "study-focus-mode" : ""}`}>
      {/* ===== 桌面端侧边大纲 (md 及以上) ===== */}
      <div className={`study-desktop-sidebar hidden desk:flex w-60 lg:w-64 h-full liquid-glass border-r border-token-surface z-10 flex-col flex-shrink-0 ${readingPrefs.focusMode ? "study-sidebar-dim" : ""}`}>
        <div className="p-4 border-b border-token-surface">
          <h2 className="type-caption font-medium text-token-secondary uppercase tracking-wider">学习大纲</h2>
          <p className="type-caption text-token-secondary mt-1 truncate">{store.goal || "学习计划"}</p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <StudyDayOutline
            outline={effectiveOutline}
            currentDay={store.currentDay}
            totalDays={store.totalDays}
            onSelectDay={goToDay}
          />
        </div>
        <div className="p-4 border-t border-token-surface">
          <StudyDayOutlineNav
            currentDay={store.currentDay}
            totalDays={store.totalDays}
            onSelectDay={goToDay}
          />
        </div>
      </div>

      {/* ===== 移动端：学习大纲左侧滑出 ===== */}
      <MobileSideDrawer
        open={showOutline}
        onClose={() => setShowOutline(false)}
        title="学习大纲"
        subtitle={store.goal || "学习计划"}
        hideFrom="md"
        side="bottom"
        footer={
          <StudyDayOutlineNav
            currentDay={store.currentDay}
            totalDays={store.totalDays}
            onSelectDay={goToDay}
          />
        }
      >
        <StudyDayOutline
          outline={effectiveOutline}
          currentDay={store.currentDay}
          totalDays={store.totalDays}
          onSelectDay={goToDay}
          activeItemRef={activeDayRef}
          compact
        />
      </MobileSideDrawer>

      {/* ===== 中间内容区域 ===== */}
      <div className="flex-1 flex flex-col h-full z-10 min-w-0">
        <TodayHeader
          dayNumber={store.currentDay}
          totalDays={store.totalDays}
          phaseName={todayItem?.phaseName}
          phaseOrder={todayItem?.phaseOrder}
          title={todayItem?.title || "今日学习"}
          goal={todayItem?.goal}
          estimatedMinutes={todayItem?.estimatedMinutes}
          state={todayContentState}
          onGenerate={handleGenerateContent}
          isGenerating={isLoading || isStreaming}
          onOpenOutline={openOutline}
          actions={
            <>
              {(error || tts.error) && (
                <span className="type-caption truncate max-w-[140px]" style={{ color: "var(--color-danger)" }}>
                  {error || tts.error}
                </span>
              )}
              {content && !isStreaming && (
                <TtsButton
                  id={contentTtsId}
                  text={contentSpeechText}
                  status={tts.getStatus(contentTtsId)}
                  onPlay={tts.play}
                  label={
                    tts.progress && tts.activeId === contentTtsId
                      ? `${tts.progress.current}/${tts.progress.total}`
                      : "朗读"
                  }
                />
              )}
              {content && !isStreaming && (
                <ReadingSettingsButton
                  active={showReadingSettings}
                  onClick={() => {
                    setImmersive(false);
                    setShowReadingSettings((v) => !v);
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => setShowQA(!showQA)}
                className={`hidden desk:flex items-center gap-1.5 px-3 py-1.5 rounded-xl type-caption font-medium transition-all ${
                  showQA
                    ? "bg-token-brand-muted text-token-brand-light border border-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)]"
                    : "text-token-secondary hover:text-token-primary hover-surface"
                }`}
              >
                <MessageCircle size={14} />
                <span>问答</span>
              </button>
            </>
          }
        />

        {/* 内容主体 */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          <div
            ref={contentScrollRef}
            onPointerDown={handleReadingPointerDown}
            onPointerUp={handleReadingPointerUp}
            className={`study-content-scroll flex-1 min-h-0 overflow-y-auto ${showQA ? "study-content-scroll--qa-open" : ""}`}
          >
            {!content && !isLoading ? (
              <div className="h-full flex flex-col items-center justify-center px-4">
                <div className="w-full max-w-md surface-elevated rounded-2xl p-5 md:p-6">
                  <p className="type-caption text-token-brand mb-2">今日课纲</p>
                  <h3 className="type-title font-semibold text-token-primary mb-2">{todayItem?.title || "今日学习"}</h3>
                  {todayItem?.goal && (
                    <p className="type-body text-token-secondary mb-3">{todayItem.goal}</p>
                  )}
                  <div className="flex flex-wrap gap-2 type-caption text-token-secondary">
                    {todayItem?.estimatedMinutes ? <span>~{todayItem.estimatedMinutes} 分钟</span> : null}
                    {todayItem?.phaseName ? <span>· {todayItem.phaseName}</span> : null}
                  </div>
                  {todayItem?.keywords && (
                    <p className="type-caption text-token-secondary mt-3">关键词：{todayItem.keywords}</p>
                  )}
                  <p className="type-caption text-token-secondary mt-4">点击顶栏「生成今日课程」开始学习</p>
                </div>
              </div>
            ) : (
              <div className="reading-article">
                {isLoading && !content ? (
                  <div className="flex flex-col items-center justify-center py-20 w-full">
                    <Loader2 size={28} className="text-token-brand animate-spin mb-3" />
                    <p className="type-body text-token-secondary">AI 正在生成学习内容...</p>
                    <p className="type-caption text-token-secondary mt-1">首次生成可能需要 10-30 秒</p>
                  </div>
                ) : (
                  <>
                    <ReadingShell
                      mode={readingPrefs.mode}
                      fontSize={readingPrefs.fontSize}
                      lineHeight={readingPrefs.lineHeight}
                      fontFamily={readingPrefs.fontFamily}
                      progressBarRef={progressBarRef}
                      breakReminder={showBreakReminder && !breakDismissed}
                      onDismissBreak={handleDismissBreak}
                    >
                      <ReadingMarkdown
                        content={content}
                        knowledgeName={todayItem?.title || ""}
                        onQuizSubmitted={handleQuizSubmitted}
                        deferMermaidRender={isStreaming}
                      />
                      {isStreaming && (
                        <div className="flex items-center gap-2 mt-4 text-token-brand">
                          <div className="w-1.5 h-1.5 rounded-full bg-token-brand animate-pulse" />
                          <span className="type-caption">AI 正在编写…</span>
                        </div>
                      )}
                      {content && !isStreaming && (
                        <div className="reading-footer">
                          <button
                            type="button"
                            onClick={() => {
                              clearReadingScroll();
                              setContent("");
                              handleGenerateContent();
                            }}
                            className="reading-footer__btn"
                          >
                            重新生成内容
                          </button>
                        </div>
                      )}
                    </ReadingShell>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ===== 桌面端 QA 侧边栏 ===== */}
          <AnimatePresence>
            {showQA && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }} className="hidden lg:flex border-l border-token-surface flex-col flex-shrink-0 overflow-hidden" style={{ backgroundColor: "var(--surface-elevated)" }}>
                <div className="p-4 border-b border-token-surface flex items-center gap-2 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-token-brand-muted">
                    <img src="/ai-avatar.png" alt="AI" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-token-primary">AI 学习导师</h3>
                    <p className="type-caption text-token-secondary truncate max-w-[240px]">{qaContextLabel}</p>
                  </div>
                </div>
                <QaThread
                  className="flex-1 overflow-y-auto p-4 min-h-0"
                  messages={qaMessages}
                  isTyping={isAiTyping}
                  variant="desktop"
                  ttsIdPrefix="qa"
                  getStatus={tts.getStatus}
                  onPlay={tts.play}
                  empty={
                    <div className="text-center py-10">
                      <MessageCircle size={28} className="mx-auto mb-2 text-token-secondary" />
                      <p className="text-xs text-token-secondary">
                        {canAskQA ? "有任何问题都可以问我" : "请先生成今日学习内容"}
                      </p>
                      {canAskQA && (
                        <p className="type-caption text-token-secondary mt-1">我会结合今日材料为你解答</p>
                      )}
                    </div>
                  }
                />
                <div className="p-4 border-t border-token-surface flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                      placeholder={qaInputPlaceholder} disabled={!canAskQA}
                      className="flex-1 px-4 py-2.5 rounded-xl type-body text-token-primary focus:outline-none transition-all disabled:opacity-50"
                      style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--surface-border-strong)", color: "var(--text-primary)" }}
                    />
                    <button onClick={handleAskQuestion} disabled={!question.trim() || isAiTyping || !canAskQA}
                      className="p-2.5 bg-token-brand hover:opacity-90 disabled:opacity-40 disabled:text-token-secondary text-[var(--brand-foreground)] rounded-xl transition-colors">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ReadingToolbar
          open={showReadingSettings}
          onOpenChange={setShowReadingSettings}
          mode={readingPrefs.mode}
          fontSize={readingPrefs.fontSize}
          lineHeight={readingPrefs.lineHeight}
          fontFamily={readingPrefs.fontFamily}
          focusMode={readingPrefs.focusMode}
          onChange={setReadingPrefs}
          onFontFamilyChange={setFontFamily}
          fontLoading={fontLoading}
        />

        {/* ===== 移动端常驻提问条：点击后模糊过渡到独立问答页 ===== */}
        <div className="study-ask-bar flex desk:hidden flex-shrink-0 px-3 pt-2 pb-3 safe-area-pb">
          <button
            type="button"
            onClick={openQA}
            className="w-full flex items-center gap-1.5 rounded-full border px-2 py-1.5 text-left"
            style={{
              backgroundColor: "var(--surface-elevated)",
              borderColor: "var(--surface-border-strong)",
              boxShadow: "0 4px 20px color-mix(in srgb, var(--text-primary) 12%, transparent)",
            }}
          >
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-token-secondary flex-shrink-0">
              <MessageCircle size={16} />
            </span>
            <span className="flex-1 min-w-0 px-1 py-1.5 text-sm text-token-secondary truncate">
              {qaInputPlaceholder}
            </span>
            <span className="w-8 h-8 rounded-full bg-token-brand text-[var(--brand-foreground)] flex items-center justify-center flex-shrink-0">
              <Send size={14} />
            </span>
          </button>
        </div>
      </div>

      {/* ===== 移动端：独立问答页（阅读内容模糊淡出） ===== */}
      <AnimatePresence>
        {showQA && (
          <>
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(18px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.32 }}
              className="lg:hidden app-vv-fill z-40"
              style={{ backgroundColor: "color-mix(in srgb, var(--bg-primary) 42%, transparent)" }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden app-vv-fill z-50 flex flex-col"
              style={{ backgroundColor: "var(--bg-primary)" }}
            >
              <div className="safe-area-pt flex items-center gap-1 px-2 py-2 border-b border-token-surface flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQA(false)}
                  aria-label="返回阅读"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-token-primary"
                >
                  <ChevronLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-token-primary">提问</h3>
                  <p className="type-caption text-token-secondary truncate">{qaContextLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQA(false)}
                  aria-label="关闭"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-token-secondary"
                >
                  <X size={16} />
                </button>
              </div>
              <QaThread
                className="flex-1 overflow-y-auto px-4 py-5 min-h-0"
                messages={qaMessages}
                isTyping={isAiTyping}
                variant="mobile"
                ttsIdPrefix="qa-mobile"
                getStatus={tts.getStatus}
                onPlay={tts.play}
                empty={
                  <div className="text-center pt-16">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: "var(--surface-elevated)" }}
                    >
                      <MessageCircle size={20} className="text-token-secondary" />
                    </div>
                    <p className="text-sm text-token-primary mb-1">有任何问题都可以问我</p>
                    <p className="text-xs text-token-secondary">解答会显示在这里，不会混入学习正文</p>
                  </div>
                }
              />
              <div className="px-3 pt-2 pb-3 safe-area-pb flex-shrink-0">
                <div
                  className="flex items-center gap-1.5 rounded-full border px-2 py-1.5"
                  style={{
                    backgroundColor: "var(--surface-elevated)",
                    borderColor: "var(--surface-border-strong)",
                    boxShadow: "0 4px 20px color-mix(in srgb, var(--text-primary) 10%, transparent)",
                  }}
                >
                  <input
                    type="text"
                    autoFocus
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                    placeholder={qaInputPlaceholder}
                    disabled={!canAskQA}
                    className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-sm text-token-primary focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleAskQuestion}
                    disabled={!question.trim() || isAiTyping || !canAskQA}
                    aria-label="发送"
                    className="w-9 h-9 rounded-full bg-token-brand text-[var(--brand-foreground)] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
