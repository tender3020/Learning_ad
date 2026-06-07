import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useLearningStore } from "@/stores/useLearningStore";
import { aiService } from "@/services/aiService";
import { TYPE_LABELS, type LearningType } from "@shared/typeEngine";
import WireframeSphere from "@/components/3d/WireframeSphere";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Brain,
  Target,
  Zap,
  AlertCircle,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Award,
} from "lucide-react";

type Difficulty = "basic" | "intermediate" | "advanced" | "expert";
type Step = "welcome" | "input" | "detecting_type" | "generating_quiz" | "assessing" | "generating_plan" | "complete" | "limit";

interface QuizQuestion {
  id?: number;
  questionIndex: number;
  question: string;
  optionsA: string;
  optionsB: string;
  optionsC: string;
  optionsD: string;
  correctAnswer: string;
  explanation: string | null;
  difficulty: Difficulty;
  userAnswer?: string;
  isCorrect?: boolean;
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  basic: "基础", intermediate: "进阶", advanced: "高级", expert: "专家",
};
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  basic: "#34C759", intermediate: "#0A84FF", advanced: "#FF9500", expert: "#FF3B30",
};
const LEVEL_NAMES: Record<string, string> = {
  l1: "零基础", l2: "入门", l3: "中级", l4: "进阶", l5: "高级",
};
const LEVEL_COLORS: Record<string, string> = {
  l1: "#FF3B30", l2: "#FF9500", l3: "#0A84FF", l4: "#A78BFA", l5: "#34C759",
};

const suggestedGoals = [
  "Python 量化交易",
  "托福词汇突破",
  "React 前端开发",
  "机器学习入门",
  "数据分析实战",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const store = useLearningStore();

  const [step, setStep] = useState<Step>("welcome");
  const [goalInput, setGoalInput] = useState("");
  const [totalDays, setTotalDays] = useState(30);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  // 评估相关状态
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [skillLevel, setSkillLevel] = useState<string>("l1");
  const [assessmentScore, setAssessmentScore] = useState(0);
  const [quizError, setQuizError] = useState("");
  const [planError, setPlanError] = useState("");

  // 学习类型检测
  const [detectedType, setDetectedType] = useState<LearningType>("abstract_logic");
  const [typeReason, setTypeReason] = useState("");

  // 用于 complete 页面显示
  const finalGoal = selectedGoal || goalInput;

  const { data: existingPlans } = trpc.learning.getPlans.useQuery();
  const activePlanCount = existingPlans?.filter((p) => p.status === "active").length || 0;
  const canCreate = activePlanCount < 7;

  const createPlanMut = trpc.learning.createPlan.useMutation();
  const saveOutlineMut = trpc.learning.saveOutline.useMutation();
  const createAssessmentMut = trpc.assessment.create.useMutation();
  const submitAnswerMut = trpc.assessment.submitAnswer.useMutation();
  const completeAssessmentMut = trpc.assessment.complete.useMutation();
  const utils = trpc.useUtils();

  // ============ Step 1: 开始 ============
  const handleStart = () => {
    if (!canCreate) { setStep("limit"); } else { setStep("input"); }
  };

  // ============ Step 2: 提交目标 → 生成评估题 ============
  const handleSubmitGoal = async () => {
    if (!finalGoal.trim()) return;
    setQuizError("");
    setPlanError("");
    setStep("detecting_type");

    try {
      // 1. AI 检测学习类型
      const { type, reason } = await aiService.detectLearningType(finalGoal);
      setDetectedType(type);
      setTypeReason(reason);

      // 2. 生成评估题（使用检测到的类型）
      setStep("generating_quiz");
      const questions = await aiService.generateAssessmentQuestions(finalGoal, type);

      // 3. 创建评估记录
      const { assessmentId: aid } = await createAssessmentMut.mutateAsync({
        planId: 0, goal: finalGoal,
        questions: questions.map((q, i) => ({ ...q, questionIndex: i + 1 })),
      });
      setAssessmentId(aid);

      // 4. 从数据库获取完整题目
      const data = await utils.assessment.getQuestions.fetch({ assessmentId: aid });
      if (data && data.questions.length > 0) {
        setQuizQuestions(data.questions.map((q) => ({
          id: q.id, questionIndex: q.questionIndex, question: q.question,
          optionsA: q.optionsA, optionsB: q.optionsB, optionsC: q.optionsC, optionsD: q.optionsD,
          correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty as Difficulty,
        })));
        setCurrentQIndex(0);
        setSelectedOption(null);
        setAnswerSubmitted(false);
        setStep("assessing");
      } else {
        throw new Error("题目生成失败");
      }
    } catch (err) {
      console.error("流程失败:", err);
      setQuizError("评估题目生成失败，请重试");
      setStep("input");
    }
  };

  // ============ Step 3: 评估答题 ============
  const handleSelectOption = (opt: string) => { if (!answerSubmitted) setSelectedOption(opt); };

  const handleSubmitAnswer = async () => {
    if (!selectedOption || !quizQuestions[currentQIndex].id) return;
    const q = quizQuestions[currentQIndex];
    try {
      const res = await submitAnswerMut.mutateAsync({ answerId: q.id!, userAnswer: selectedOption });
      setAnswerSubmitted(true);
      setQuizQuestions((prev) => prev.map((item, i) =>
        i === currentQIndex ? { ...item, userAnswer: selectedOption, isCorrect: res.isCorrect } : item
      ));
    } catch { /* ignore */ }
  };

  const handleNextQuestion = async () => {
    if (currentQIndex < quizQuestions.length - 1) {
      setCurrentQIndex((p) => p + 1);
      setSelectedOption(null);
      setAnswerSubmitted(false);
    } else {
      // 全部答完，计算等级
      let finalSkillLevel = skillLevel; // 使用当前 state 中的值作为默认
      if (assessmentId) {
        try {
          const result = await completeAssessmentMut.mutateAsync({ assessmentId });
          finalSkillLevel = result.skillLevel; // 使用评估返回的真实等级
          setSkillLevel(result.skillLevel);
          setAssessmentScore(result.score);
        } catch (e) {
          console.error("完成评估失败:", e);
          /* 失败时使用默认值继续 */
        }
      }
      // 进入计划生成阶段，传入确定的 skillLevel（避免闭包延迟问题）
      await generatePlan(finalSkillLevel);
    }
  };

  // ============ Step 4: 根据评估结果创建计划 + 生成大纲 ============
  const generatePlan = async (levelToUse: string = skillLevel) => {
    setStep("generating_plan");
    store.setStreaming(true);
    store.setGenerationProgress(10, "创建学习计划...");
    setPlanError("");

    try {
      console.log("[generatePlan] 开始创建计划，目标:", finalGoal, "类型:", detectedType, "等级:", levelToUse, "天数:", totalDays);

      // 创建计划时传入 learningType
      const planResult = await createPlanMut.mutateAsync({
        goal: finalGoal, subject: finalGoal, totalDays,
        learningType: detectedType,
      });
      const planId = planResult.planId;
      console.log("[generatePlan] 计划创建成功，planId:", planId);

      // 如果存在评估记录，更新其 planId（onboarding 时评估先于计划创建）
      if (assessmentId) {
        try {
          await utils.client.assessment.updatePlanId.mutate({ assessmentId, planId });
          console.log("[generatePlan] 评估记录 planId 更新成功");
        } catch (e) {
          console.error("[generatePlan] 更新评估 planId 失败（非阻塞）:", e);
        }
      }

      store.setGenerationProgress(40, `根据「${LEVEL_NAMES[levelToUse] || "零基础"}」水平生成${TYPE_LABELS[detectedType]?.name || ""}大纲...`);

      // 根据 learningType 和 skillLevel 生成对应的大纲
      console.log("[generatePlan] 开始生成大纲...");
      const outline = await aiService.generateOutline(finalGoal, totalDays, detectedType, levelToUse);
      console.log("[generatePlan] 大纲生成成功，条目数:", outline.length);

      if (outline.length === 0) {
        throw new Error("大纲生成结果为空，请重试");
      }

      store.setGenerationProgress(80, "保存学习计划...");
      await saveOutlineMut.mutateAsync({
        planId,
        outline: outline.map((item) => ({
          dayNumber: item.dayNumber, title: item.title, goal: item.goal,
          keywords: item.keywords, estimatedMinutes: item.estimatedMinutes,
        })),
      });
      console.log("[generatePlan] 大纲保存成功");

      store.setGenerationProgress(100, "计划生成完成！");
      store.setCurrentPlan(planId, finalGoal, finalGoal, totalDays);
      store.setOutline(outline);
      store.setCurrentDay(1);
      store.setStreaming(false);
      console.log("[generatePlan] 流程完成，进入 complete 状态");
      setStep("complete");
    } catch (error) {
      console.error("[generatePlan] 创建计划失败:", error);
      const errMsg = error instanceof Error ? error.message : "计划生成失败，请重试";
      setPlanError(errMsg);
      store.setStreaming(false);
      setStep("assessing");
    }
  };

  // ============ 跳过评估 ============
  const handleSkipAssessment = async () => {
    setSkillLevel("l1"); // 未评估默认零基础
    await generatePlan("l1");
  };

  const currentQ = quizQuestions[currentQIndex];
  const quizProgress = quizQuestions.length > 0 ? ((currentQIndex + (answerSubmitted ? 1 : 0)) / quizQuestions.length) * 100 : 0;

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <div className="h-full flex flex-col items-center justify-center overflow-hidden relative" style={{ backgroundColor: "var(--bg-primary)" }}>
      <WireframeSphere opacity={0.15} />
      <AnimatePresence mode="wait">

        {/* ====== WELCOME ====== */}
        {step === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="relative z-10 text-center max-w-2xl px-4 md:px-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 md:mb-8 rounded-2xl overflow-hidden">
              <img src="/logo.png" alt="弈智" className="w-full h-full object-cover" />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-3xl md:text-5xl font-semibold text-[#F5F5F7] mb-3 md:mb-4" style={{ letterSpacing: "-0.02em" }}>
              欢迎来到 <span className="text-[#A78BFA]">弈智</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-base md:text-lg text-[#8A8A8E] mb-8 md:mb-10">
              你的 AI 驱动的自适应学习伙伴
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="grid grid-cols-2 gap-2 md:gap-4 mb-8 md:mb-10 max-w-md mx-auto">
              {[{ icon: Brain, text: "AI 个性化教学" }, { icon: Target, text: "精准知识图谱" }, { icon: Zap, text: "实时进度追踪" }, { icon: BookOpen, text: "系统化课程" }].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.1 }}
                  className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl liquid-glass text-left">
                  <f.icon size={18} className="text-[#6E56CF] flex-shrink-0" />
                  <span className="text-xs md:text-sm text-[#E0E0E5]">{f.text}</span>
                </motion.div>
              ))}
            </motion.div>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleStart}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-2xl font-medium text-base md:text-lg transition-colors brand-glow">
              开始学习之旅 <ArrowRight size={20} />
            </motion.button>
          </motion.div>
        )}

        {/* ====== INPUT ====== */}
        {step === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="relative z-10 w-full max-w-lg px-4 md:px-6">
            {quizError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 p-3 rounded-xl bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.15)] text-xs text-[#FF3B30] text-center">
                {quizError}
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="liquid-glass rounded-2xl md:rounded-3xl p-5 md:p-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <Sparkles size={20} className="text-[#6E56CF]" />
                <h2 className="text-lg md:text-2xl font-semibold text-[#F5F5F7]">设定你的学习目标</h2>
              </div>
              <p className="text-xs md:text-sm text-[#8A8A8E] mb-4 md:mb-6">
                告诉我们你想学什么，AI 将先评估你的水平，再为你定制个性化学习路径
              </p>
              <div className="relative mb-4 md:mb-6">
                <input type="text" value={goalInput} onChange={(e) => { setGoalInput(e.target.value); setSelectedGoal(null); }}
                  placeholder="例如：学习 Python 编程..."
                  className="w-full px-4 md:px-5 py-3 md:py-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl md:rounded-2xl text-[#F5F5F7] placeholder-[#8A8A8E] focus:outline-none focus:border-[#6E56CF] transition-all text-sm md:text-base" />
              </div>
              <div className="mb-4 md:mb-6">
                <p className="text-[10px] md:text-xs text-[#8A8A8E] uppercase tracking-wider mb-2 md:mb-3">热门学习目标</p>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {suggestedGoals.map((sg) => (
                    <button key={sg} onClick={() => { setSelectedGoal(sg); setGoalInput(sg); }}
                      className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm transition-all ${
                        selectedGoal === sg ? "bg-[#6E56CF] text-white" : "bg-[rgba(255,255,255,0.03)] text-[#8A8A8E] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)]"
                      }`}>{sg}</button>
                  ))}
                </div>
              </div>
              <div className="mb-6 md:mb-8">
                <p className="text-[10px] md:text-xs text-[#8A8A8E] uppercase tracking-wider mb-2 md:mb-3">学习周期</p>
                <div className="grid grid-cols-5 gap-1.5 md:gap-3">
                  {[7, 14, 30, 60, 90].map((days) => (
                    <button key={days} onClick={() => setTotalDays(days)}
                      className={`py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all ${
                        totalDays === days ? "bg-[#6E56CF] text-white" : "bg-[rgba(255,255,255,0.03)] text-[#8A8A8E] hover:text-[#F5F5F7] border border-[rgba(255,255,255,0.08)]"
                      }`}>{days}天</button>
                  ))}
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleSubmitGoal}
                disabled={!goalInput.trim() && !selectedGoal}
                className="w-full flex items-center justify-center gap-2 py-3 md:py-4 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl md:rounded-2xl font-medium text-base md:text-lg transition-all brand-glow">
                <Target size={18} /> 进入能力评估
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* ====== DETECTING TYPE ====== */}
        {step === "detecting_type" && (
          <motion.div key="detecting_type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 text-center px-4">
            <Loader2 size={40} className="mx-auto mb-4 text-[#6E56CF] animate-spin" />
            <h2 className="text-lg md:text-xl font-semibold text-[#F5F5F7] mb-2">正在分析学习类型...</h2>
            <p className="text-sm text-[#8A8A8E]">AI 正在根据「{selectedGoal || goalInput}」判定最适合的学习模式</p>
          </motion.div>
        )}

        {/* ====== GENERATING QUIZ ====== */}
        {step === "generating_quiz" && (
          <motion.div key="generating_quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 text-center px-4">
            <Loader2 size={40} className="mx-auto mb-4 text-[#6E56CF] animate-spin" />
            <h2 className="text-lg md:text-xl font-semibold text-[#F5F5F7] mb-2">正在生成评估题目...</h2>
            <p className="text-sm text-[#8A8A8E]">
              已识别为「{TYPE_LABELS[detectedType]?.name || ""}」模式
              {typeReason ? ` · ${typeReason}` : ""}
            </p>
          </motion.div>
        )}

        {/* ====== ASSESSING ====== */}
        {step === "assessing" && currentQ && (
          <motion.div key="assessing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 w-full max-w-xl px-3 md:px-6 flex flex-col h-full">
            {/* 内容区：可滚动 */}
            <div className="flex-1 overflow-y-auto pb-16 md:pb-6 pt-4">
              {/* 错误提示 - 计划生成失败时显示 */}
              {planError && (
                <div className="mb-4 p-4 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)]">
                  <p className="text-sm text-[#FF3B30] font-medium mb-1">计划生成遇到问题</p>
                  <p className="text-xs text-[#FF3B30] opacity-80 mb-3">{planError}</p>
                  <button onClick={() => { setPlanError(""); generatePlan(skillLevel); }}
                    className="px-4 py-2 bg-[#FF3B30] hover:bg-[#E6352B] text-white rounded-lg text-xs font-medium transition-colors">
                    重新生成
                  </button>
                </div>
              )}
              {/* 进度条 */}
            <div className="w-full mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] md:text-xs text-[#8A8A8E]">能力评估 · 第 {currentQIndex + 1}/{quizQuestions.length} 题</span>
                <button onClick={handleSkipAssessment} className="text-[10px] md:text-xs text-[#8A8A8E] hover:text-[#F5F5F7] transition-colors">
                  跳过评估
                </button>
              </div>
              <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #6E56CF, #A78BFA)" }}
                  animate={{ width: `${quizProgress}%` }} transition={{ duration: 0.3 }} />
              </div>
            </div>

            {/* 难度标签 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                color: DIFFICULTY_COLORS[currentQ.difficulty],
                background: `${DIFFICULTY_COLORS[currentQ.difficulty]}15`,
              }}>{DIFFICULTY_LABELS[currentQ.difficulty]}</span>
            </div>

            {/* 题目 */}
            <h2 className="text-base md:text-lg font-medium text-[#F5F5F7] mb-5 leading-relaxed">{currentQ.question}</h2>

            {/* 选项 */}
            <div className="space-y-2.5 mb-5">
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const optionText = currentQ[`options${opt}` as keyof QuizQuestion] as string;
                const isSelected = selectedOption === opt;
                const isCorrect = currentQ.correctAnswer === opt;
                const isWrong = answerSubmitted && isSelected && !isCorrect;
                const showCorrect = answerSubmitted && isCorrect;

                return (
                  <button key={opt} onClick={() => handleSelectOption(opt)} disabled={answerSubmitted}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      showCorrect ? "border-[#34C759] bg-[rgba(52,199,89,0.1)]" :
                      isWrong ? "border-[#FF3B30] bg-[rgba(255,59,48,0.1)]" :
                      isSelected ? "border-[#6E56CF] bg-[rgba(110,86,207,0.1)]" :
                      "border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.03)]"
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                      showCorrect ? "bg-[#34C759] text-white" : isWrong ? "bg-[#FF3B30] text-white" :
                      isSelected ? "bg-[#6E56CF] text-white" : "bg-[rgba(255,255,255,0.05)]"
                    }`}>
                      {showCorrect ? <CheckCircle2 size={16} /> : isWrong ? <XCircle size={16} /> : opt}
                    </div>
                    <span className="text-sm text-[#F5F5F7] flex-1">{optionText}</span>
                  </button>
                );
              })}
            </div>

            {/* 解析 */}
            <AnimatePresence>
              {answerSubmitted && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-5">
                  <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-[#FF9500]" />
                      <span className="text-xs font-medium text-[#FF9500]">答案解析</span>
                    </div>
                    <p className="text-xs text-[#8A8A8E] leading-relaxed">
                      正确答案：<span className="text-[#34C759] font-medium">{currentQ.correctAnswer}</span>
                      {currentQ.userAnswer && currentQ.userAnswer !== currentQ.correctAnswer && (
                        <span className="text-[#FF3B30]"> · 你的答案：{currentQ.userAnswer}</span>
                      )}
                    </p>
                    {currentQ.explanation && (
                      <p className="text-xs text-[#8A8A8E] leading-relaxed mt-2">{currentQ.explanation}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            </div>

            {/* 按钮 - 固定底部，不被Tab Bar遮挡 */}
            <div className="flex-shrink-0 py-3 md:py-4 bg-[var(--bg-primary)] border-t border-[rgba(255,255,255,0.05)] -mx-3 md:mx-0 px-3 md:px-0">
              {!answerSubmitted ? (
                <button onClick={handleSubmitAnswer} disabled={!selectedOption}
                  className="w-full py-3 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl text-sm font-medium transition-colors">
                  提交答案
                </button>
              ) : (
                <button onClick={handleNextQuestion}
                  className="w-full py-3 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1">
                  {currentQIndex < quizQuestions.length - 1 ? "下一题 " : "完成评估 "}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ====== GENERATING PLAN ====== */}
        {step === "generating_plan" && (
          <motion.div key="generating_plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 text-center px-4">
            <div className="relative w-40 h-40 md:w-64 md:h-64 mx-auto mb-4 md:mb-8" style={{ perspective: "800px" }}>
              <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (360 / 12) * i;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1, rotateY: [angle, angle + 360] }}
                      transition={{ opacity: { delay: i * 0.05, duration: 0.3 }, scale: { delay: i * 0.05, duration: 0.3 }, rotateY: { delay: i * 0.05, duration: 5, repeat: Infinity, ease: "linear" } }}
                      className="absolute" style={{ transform: `rotateY(${angle}deg) translateZ(${typeof window !== 'undefined' && window.innerWidth < 768 ? '80px' : '120px'})`, transformStyle: "preserve-3d" }}>
                      <div className="w-8 h-10 md:w-12 md:h-16 bg-[rgba(255,255,255,0.9)] rounded-md md:rounded-lg flex items-center justify-center shadow-lg shadow-[rgba(110,86,207,0.3)]">
                        <span className="text-[10px] md:text-sm font-bold text-[#0A0A0A]">D{i + 1}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#6E56CF] opacity-20 blur-xl" />
              </div>
            </div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-xl md:text-2xl font-semibold text-[#F5F5F7] mb-2">
              正在构建你的「{LEVEL_NAMES[skillLevel] || "中级"}」学习路径
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-sm text-[#8A8A8E] mb-4 md:mb-6">AI 正在根据你的水平生成个性化课程...</motion.p>
            <div className="w-56 md:w-72 mx-auto">
              <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-[#6E56CF] to-[#A78BFA] rounded-full"
                  initial={{ width: "0%" }} animate={{ width: `${store.generationProgress}%` }} transition={{ duration: 0.5 }} />
              </div>
              <p className="text-[10px] md:text-xs text-[#8A8A8E] mt-2">{store.generationStage}</p>
            </div>
          </motion.div>
        )}

        {/* ====== COMPLETE ====== */}
        {step === "complete" && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 text-center px-4 max-w-md">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full flex items-center justify-center"
              style={{ background: `${LEVEL_COLORS[skillLevel]}15`, border: `1px solid ${LEVEL_COLORS[skillLevel]}30` }}>
              <Award size={36} style={{ color: LEVEL_COLORS[skillLevel] }} />
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-semibold text-[#F5F5F7] mb-2 md:mb-3">
              你的学习等级：{LEVEL_NAMES[skillLevel] || "中级"}
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-sm text-[#8A8A8E] mb-4">
              评估得分 {assessmentScore}/100 · 共 {totalDays} 天
            </motion.p>
            <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-2xl font-medium text-base md:text-lg transition-colors brand-glow">
              进入学习看板 <ArrowRight size={20} />
            </motion.button>
          </motion.div>
        )}

        {/* ====== LIMIT ====== */}
        {step === "limit" && (
          <motion.div key="limit" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="relative z-10 text-center px-4 max-w-md">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full bg-[rgba(255,149,0,0.1)] border border-[rgba(255,149,0,0.2)] flex items-center justify-center">
              <AlertCircle size={32} className="text-[#FF9500]" />
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-xl md:text-2xl font-semibold text-[#F5F5F7] mb-2 md:mb-3">计划数量已达上限</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-sm text-[#8A8A8E] mb-6">
              你已有 <span className="text-[#FF9500] font-medium">{activePlanCount}</span> 个进行中的学习计划，系统限制最多同时管理 7 个。
              请先完成部分现有计划，或删除不需要的计划后再添加新的学习内容。
            </motion.p>
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate("/")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#6E56CF] hover:bg-[#5A45B0] text-white rounded-xl font-medium text-sm transition-colors">
                管理现有计划 <ArrowRight size={16} />
              </motion.button>
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep("welcome")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-xl font-medium text-sm transition-colors">
                <ArrowLeft size={16} /> 返回
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
