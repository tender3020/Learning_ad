import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLearningStore } from "@/stores/useLearningStore";
import { aiService } from "@/services/aiService";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { useReadingPrefs } from "@/hooks/useReadingPrefs";
import TtsButton from "@/components/TtsButton";
import WireframeSphere from "@/components/3d/WireframeSphere";
import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import ReadingMarkdown, { getReadingTocItems } from "@/components/reading/ReadingMarkdown";
import ReadingShell from "@/components/reading/ReadingShell";
import ReadingToolbar from "@/components/reading/ReadingToolbar";
import ReadingToc from "@/components/reading/ReadingToc";
import {
  Send,
  Loader2,
  MessageCircle,
  ChevronLeft,
  CheckCircle,
  Play,
  Lock,
  Sparkles,
  GraduationCap,
  X,
  Menu,
  Image as ImageIcon,
} from "lucide-react";

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
  const qaEndRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const studyMinutesRef = useRef(0); // 学习时长追踪（分钟）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingSessionStartRef = useRef<number | null>(null);
  const tts = useTtsPlayer();
  const {
    prefs: readingPrefs,
    cycleMode,
    increaseFontSize,
    decreaseFontSize,
    toggleLineHeight,
    toggleFocusMode,
  } = useReadingPrefs();

  const [readProgress, setReadProgress] = useState(0);
  const [showReadingToc, setShowReadingToc] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string | undefined>();
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [breakDismissed, setBreakDismissed] = useState(false);

  const tocItems = content ? getReadingTocItems(content) : [];

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

  const [isRegeneratingImages, setIsRegeneratingImages] = useState(false);

  const regenerateIllustrations = trpc.content.generateIllustrations.useMutation({
    onSuccess: (result) => {
      setIsRegeneratingImages(false);
      const planId = store.currentPlanId || 0;
      const dayNumber = store.currentDay;
      utils.content.getContent.invalidate({ planId, dayNumber });
      if (result.imageCount > 0) {
        let polls = 0;
        const pollTimer = setInterval(() => {
          polls += 1;
          utils.content.getContent.invalidate({ planId, dayNumber });
          if (polls >= 12) clearInterval(pollTimer);
        }, 15000);
      }
    },
    onError: (err) => {
      setIsRegeneratingImages(false);
      setError(err.message);
    },
  });

  const handleRegenerateIllustrations = () => {
    if (!store.currentPlanId || !content.trim()) return;
    setIsRegeneratingImages(true);
    setError("");
    regenerateIllustrations.mutate({
      planId: store.currentPlanId,
      dayNumber: store.currentDay,
      force: true,
    });
  };

  const saveContent = trpc.content.saveContent.useMutation({
    onSuccess: () => {
      const planId = store.currentPlanId || 0;
      const dayNumber = store.currentDay;
      utils.content.getContent.invalidate({ planId, dayNumber });

      // 配图在后台生成，定时刷新内容直至配图写入或超时
      let polls = 0;
      const pollTimer = setInterval(() => {
        polls += 1;
        utils.content.getContent.invalidate({ planId, dayNumber });
        if (polls >= 12) clearInterval(pollTimer);
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
  const qaInputPlaceholder = canAskQA ? "输入问题..." : "请先生成今日学习内容";

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
      setContent(existingContent.markdownContent);
    } else {
      setContent("");
    }
  }, [existingContent, store.currentDay]);

  const handleGenerateContent = async () => {
    if (!todayItem || !store.currentPlanId) return;
    setIsLoading(true);
    setIsStreaming(true);
    store.setContentLoading(true);
    store.setStreaming(true);
    setError("");

    const prompt = `请为第${store.currentDay}天的学习目标生成详细的学习内容。

学习主题：${todayItem.title}
学习目标：${todayItem.goal}
${todayItem.keywords ? `关键词：${todayItem.keywords}` : ""}

请用中文输出，使用 Markdown 格式，包含：
1. 知识点详细讲解
2. 代码示例（如适用）
3. 实际应用场景
4. 练习题目
5. 小结`;

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
    });
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

    await aiService.streamQA(
      store.currentPlanId,
      store.currentDay,
      userQuestion,
      {
        onToken: (token) => {
          setQaMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.type === "ai") {
              next[next.length - 1] = { type: "ai", text: last.text + token };
            }
            return next;
          });
        },
        onComplete: () => {
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

  const showAiPlaceholder =
    isAiTyping &&
    qaMessages[qaMessages.length - 1]?.type === "ai" &&
    !qaMessages[qaMessages.length - 1]?.text;

  // 当切换天或历史数据到达时，同步 qaMessages（按天隔离）
  useEffect(() => {
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

  useEffect(() => { qaEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [qaMessages, isAiTyping]);

  const handleContentScroll = useCallback(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setReadProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);

    if (tocItems.length > 0) {
      const scrollTop = el.scrollTop + 120;
      let current: string | undefined;
      for (const item of tocItems) {
        const section = document.getElementById(item.id);
        if (section && section.offsetTop <= scrollTop) {
          current = item.id;
        }
      }
      setActiveTocId(current);
    }
  }, [tocItems]);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    handleContentScroll();
    el.addEventListener("scroll", handleContentScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleContentScroll);
  }, [content, handleContentScroll]);

  const scrollToSection = useCallback((id: string) => {
    const el = contentScrollRef.current;
    const section = document.getElementById(id);
    if (!el || !section) return;
    const top = section.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12;
    el.scrollTo({ top, behavior: "smooth" });
    setActiveTocId(id);
    setShowReadingToc(false);
  }, []);

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

  const goToDay = (day: number) => {
    if (day >= 1 && day <= store.totalDays) {
      tts.stop();
      store.setCurrentDay(day); setContent(""); setError(""); setShowOutline(false); setQaMessages([]);
    }
  };

  if (plansLoading) {
    return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#6E56CF] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!store.currentPlanId) {
    return (
      <div className="h-full flex items-center justify-center relative">
        <WireframeSphere opacity={0.1} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center max-w-md px-6">
          <GraduationCap size={48} className="mx-auto mb-4 text-[#6E56CF]" />
          <h2 className="text-xl md:text-2xl font-semibold text-[#F5F5F7] mb-2">还没有学习计划</h2>
          <p className="text-sm text-[#8A8A8E] mb-6">让 AI 为你定制一个个性化的学习路径。</p>
          <button onClick={() => window.location.href = "/onboarding"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-xl font-medium transition-colors brand-glow">
            <Sparkles size={18} /> 创建学习计划
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-full flex relative ${readingPrefs.focusMode ? "study-focus-mode" : ""}`}>
      <WireframeSphere opacity={readingPrefs.focusMode ? 0 : 0.08} />

      {/* ===== 桌面端侧边大纲 (md 及以上) ===== */}
      <div className={`hidden md:flex w-60 lg:w-64 h-full liquid-glass border-r border-[rgba(255,255,255,0.05)] z-10 flex-col flex-shrink-0 ${readingPrefs.focusMode ? "study-sidebar-dim" : ""}`}>
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)]">
          <h2 className="text-sm font-medium text-[#8A8A8E] uppercase tracking-wider">学习大纲</h2>
          <p className="text-xs text-[#8A8A8E] mt-1 truncate">{store.goal || "学习计划"}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {effectiveOutline.map((item) => {
            const isActive = item.dayNumber === store.currentDay;
            const isCompleted = item.dayNumber < store.currentDay;
            return (
              <button key={item.dayNumber} onClick={() => goToDay(item.dayNumber)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive ? "bg-[rgba(110,86,207,0.15)] border border-[rgba(110,86,207,0.3)]" :
                  "hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? "bg-[rgba(52,199,89,0.2)]" : isActive ? "bg-[rgba(110,86,207,0.2)]" : "bg-[rgba(255,255,255,0.05)]"
                }`}>
                  {isCompleted ? <CheckCircle size={14} className="text-[#34C759]" /> :
                   isActive ? <Play size={12} className="text-[#6E56CF]" /> :
                   <Lock size={12} className="text-[#8A8A8E]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? "text-[#F5F5F7]" : "text-[#8A8A8E]"}`}>
                    D{item.dayNumber}: {item.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          <button onClick={() => goToDay(store.currentDay - 1)} disabled={store.currentDay <= 1}
            className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-all">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-[#8A8A8E]">{store.currentDay} / {store.totalDays}</span>
          <button onClick={() => goToDay(store.currentDay + 1)} disabled={store.currentDay >= store.totalDays}
            className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-all">
            {/* Using ChevronRight via inline or simple arrow */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ===== 移动端：大纲底部抽屉 ===== */}
      <AnimatePresence>
        {showOutline && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed bottom-0 left-0 right-0 h-[70vh] liquid-glass rounded-t-3xl z-40 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-sm font-medium text-[#8A8A8E]">学习大纲</h2>
              <button onClick={() => setShowOutline(false)} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {effectiveOutline.map((item) => {
                const isActive = item.dayNumber === store.currentDay;
                return (
                  <button key={item.dayNumber} onClick={() => goToDay(item.dayNumber)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                      isActive ? "bg-[rgba(110,86,207,0.15)] border border-[rgba(110,86,207,0.3)]" :
                      "hover:bg-[rgba(255,255,255,0.03)]"
                    }`}>
                    <span className={`text-xs font-medium ${isActive ? "text-[#6E56CF]" : "text-[#8A8A8E]"}`}>D{item.dayNumber}</span>
                    <span className={`text-sm ${isActive ? "text-[#F5F5F7]" : "text-[#8A8A8E]"}`}>{item.title}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 中间内容区域 ===== */}
      <div className="flex-1 flex flex-col h-full z-10 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 md:px-6 py-2 md:py-4 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0 gap-2">
          {/* 移动端：大纲切换按钮 */}
          <button onClick={() => setShowOutline(true)} className="md:hidden w-7 h-7 rounded-md bg-[rgba(255,255,255,0.05)] flex items-center justify-center flex-shrink-0">
            <Menu size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs md:text-lg font-semibold text-[#F5F5F7] truncate">{todayItem?.title || "今日学习"}</h1>
            <p className="text-[9px] md:text-xs text-[#8A8A8E] truncate">{todayItem?.goal}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(error || tts.error) && (
              <span className="hidden sm:inline text-xs text-[#FF3B30] max-w-[200px] truncate">
                {error || tts.error}
              </span>
            )}
            {content && !isStreaming && (
              <>
                <button
                  type="button"
                  onClick={handleRegenerateIllustrations}
                  disabled={isRegeneratingImages}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium liquid-glass text-[#8A8A8E] hover:text-[#F5F5F7] disabled:opacity-50 transition-all"
                  title="重新生成配图"
                >
                  {isRegeneratingImages ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                  <span>重新配图</span>
                </button>
                <TtsButton
                  id={contentTtsId}
                  text={contentSpeechText}
                  status={tts.getStatus(contentTtsId)}
                  onPlay={tts.play}
                  label={tts.progress && tts.activeId === contentTtsId
                    ? `${tts.progress.current}/${tts.progress.total}`
                    : "朗读"}
                />
              </>
            )}
            <button onClick={() => setShowQA(!showQA)}
              className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all ${
                showQA ? "bg-[rgba(110,86,207,0.2)] text-[#A78BFA] border border-[rgba(110,86,207,0.3)]" :
                "liquid-glass text-[#8A8A8E] hover:text-[#F5F5F7]"
              }`}>
              <MessageCircle size={14} />
              <span className="hidden sm:inline">AI 问答</span>
            </button>
          </div>
        </div>

        {/* 内容主体 */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          <div
            ref={contentScrollRef}
            className={`flex-1 overflow-y-auto p-0 md:p-6 ${showQA ? "" : "w-full"}`}
          >
            {!content && !isLoading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center px-4">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[rgba(110,86,207,0.1)] flex items-center justify-center mb-4">
                  <Sparkles size={24} className="text-[#6E56CF]" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-[#F5F5F7] mb-2 text-center">准备生成学习内容</h3>
                <p className="text-xs md:text-sm text-[#8A8A8E] mb-4 md:mb-6 text-center max-w-md">AI 将为你生成关于「{todayItem?.title}」的个性化学习内容。</p>
                <button onClick={handleGenerateContent}
                  className="flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-xl font-medium text-sm transition-colors brand-glow">
                  <Sparkles size={16} /> 生成学习内容
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="reading-layout">
                {isLoading && !content ? (
                  <div className="flex flex-col items-center justify-center py-20 w-full">
                    <Loader2 size={28} className="text-[#6E56CF] animate-spin mb-3" />
                    <p className="text-sm text-[#8A8A8E]">AI 正在生成学习内容...</p>
                    <p className="text-xs text-[#8A8A8E] mt-1">首次生成可能需要 10-30 秒</p>
                  </div>
                ) : (
                  <>
                    <ReadingShell
                      mode={readingPrefs.mode}
                      fontSize={readingPrefs.fontSize}
                      lineHeight={readingPrefs.lineHeight}
                      progress={readProgress}
                      breakReminder={showBreakReminder && !breakDismissed}
                      onDismissBreak={() => {
                        setBreakDismissed(true);
                        setShowBreakReminder(false);
                      }}
                    >
                      <ReadingToolbar
                        mode={readingPrefs.mode}
                        fontSize={readingPrefs.fontSize}
                        lineHeight={readingPrefs.lineHeight}
                        focusMode={readingPrefs.focusMode}
                        onCycleMode={cycleMode}
                        onDecreaseFont={decreaseFontSize}
                        onIncreaseFont={increaseFontSize}
                        onToggleLineHeight={toggleLineHeight}
                        onToggleFocus={toggleFocusMode}
                        onOpenToc={() => setShowReadingToc(true)}
                        showTocButton={tocItems.length > 0}
                      />
                      <ReadingMarkdown
                        content={content}
                        knowledgeName={todayItem?.title || ""}
                        onQuizSubmitted={handleQuizSubmitted}
                      />
                      {isStreaming && (
                        <div className="flex items-center gap-2 mt-4 text-[#6E56CF]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-pulse" />
                          <span className="text-xs">AI 正在输出...</span>
                        </div>
                      )}
                      {content && !isStreaming && (
                        <div className="mt-4 pt-3 border-t border-[var(--reading-card-border)]">
                          <button
                            onClick={() => { setContent(""); handleGenerateContent(); }}
                            className="text-xs text-[var(--reading-text-muted)] hover:text-[#6E56CF] transition-colors"
                          >
                            重新生成内容
                          </button>
                        </div>
                      )}
                    </ReadingShell>

                    <ReadingToc
                      items={tocItems}
                      activeId={activeTocId}
                      onNavigate={scrollToSection}
                      mobileOpen={showReadingToc}
                      onMobileClose={() => setShowReadingToc(false)}
                    />
                  </>
                )}
              </motion.div>
            )}
          </div>

          {/* ===== 桌面端 QA 侧边栏 ===== */}
          <AnimatePresence>
            {showQA && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }} className="hidden lg:flex border-l border-[rgba(255,255,255,0.05)] flex-col bg-[rgba(0,0,0,0.3)] flex-shrink-0 overflow-hidden">
                <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[rgba(110,86,207,0.15)]">
                    <img src="/ai-avatar.png" alt="AI" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#F5F5F7]">AI 学习导师</h3>
                    <p className="text-[10px] text-[#8A8A8E] truncate max-w-[240px]">{qaContextLabel}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {qaMessages.length === 0 && (
                    <div className="text-center py-10">
                      <MessageCircle size={28} className="mx-auto mb-2 text-[#8A8A8E]" />
                      <p className="text-xs text-[#8A8A8E]">
                        {canAskQA ? "有任何问题都可以问我" : "请先生成今日学习内容"}
                      </p>
                      {canAskQA && (
                        <p className="text-[10px] text-[#8A8A8E] mt-1">我会结合今日材料为你解答</p>
                      )}
                    </div>
                  )}
                  {qaMessages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`flex flex-col gap-1 max-w-[85%] ${msg.type === "user" ? "items-end" : "items-start"}`}>
                        <div className={`px-4 py-3 rounded-2xl text-sm ${
                          msg.type === "user" ? "bg-[#6E56CF] text-white rounded-br-md" : "liquid-glass text-[#E0E0E5] rounded-bl-md"
                        }`}>
                          <MarkdownRenderer content={msg.text} />
                        </div>
                        {msg.type === "ai" && (
                          <TtsButton
                            id={`qa-${i}`}
                            text={msg.text}
                            status={tts.getStatus(`qa-${i}`)}
                            onPlay={tts.play}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {showAiPlaceholder && (
                    <div className="flex justify-start">
                      <div className="liquid-glass px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={qaEndRef} />
                </div>
                <div className="p-4 border-t border-[rgba(255,255,255,0.05)] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                      placeholder={qaInputPlaceholder} disabled={!canAskQA}
                      className="flex-1 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl text-sm text-[#F5F5F7] placeholder-[#8A8A8E] focus:outline-none focus:border-[#6E56CF] transition-all disabled:opacity-50" />
                    <button onClick={handleAskQuestion} disabled={!question.trim() || isAiTyping || !canAskQA}
                      className="p-2.5 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl transition-colors">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== 移动端：QA 全屏弹层 ===== */}
      <AnimatePresence>
        {showQA && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[rgba(110,86,207,0.15)]">
                  <img src="/ai-avatar.png" alt="AI" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[#F5F5F7]">AI 学习导师</h3>
                  <p className="text-[10px] text-[#8A8A8E] truncate max-w-[200px]">{qaContextLabel}</p>
                </div>
              </div>
              <button onClick={() => setShowQA(false)} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {qaMessages.length === 0 && (
                <div className="text-center py-10">
                  <MessageCircle size={32} className="mx-auto mb-3 text-[#8A8A8E]" />
                  <p className="text-sm text-[#8A8A8E] mb-1">
                    {canAskQA ? "有任何问题都可以问我" : "请先生成今日学习内容"}
                  </p>
                  {canAskQA && (
                    <p className="text-xs text-[#8A8A8E]">我会结合今日材料为你解答</p>
                  )}
                </div>
              )}
              {qaMessages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex flex-col gap-1 max-w-[85%] ${msg.type === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.type === "user" ? "bg-[#6E56CF] text-white rounded-br-md" : "liquid-glass text-[#E0E0E5] rounded-bl-md"
                    }`}>
                      <MarkdownRenderer content={msg.text} />
                    </div>
                    {msg.type === "ai" && (
                      <TtsButton
                        id={`qa-mobile-${i}`}
                        text={msg.text}
                        status={tts.getStatus(`qa-mobile-${i}`)}
                        onPlay={tts.play}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
              {showAiPlaceholder && (
                <div className="flex justify-start">
                  <div className="liquid-glass px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6E56CF] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={qaEndRef} />
            </div>
            <div className="p-4 border-t border-[rgba(255,255,255,0.05)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                  placeholder={qaInputPlaceholder} disabled={!canAskQA}
                  className="flex-1 px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl text-sm text-[#F5F5F7] placeholder-[#8A8A8E] focus:outline-none focus:border-[#6E56CF] transition-all disabled:opacity-50" />
                <button onClick={handleAskQuestion} disabled={!question.trim() || isAiTyping || !canAskQA}
                  className="p-3 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl transition-colors">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 移动端大纲弹层遮罩 */}
      <AnimatePresence>
        {showOutline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setShowOutline(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
