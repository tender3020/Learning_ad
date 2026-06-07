import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useLearningStore } from "@/stores/useLearningStore";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  HelpCircle,
  RotateCcw,
} from "lucide-react";

/** 从HTML注释块解析quiz数据
 * 
 * 支持两种格式：
 * 1. 完整格式：<!-- quiz ... -->
 * 2. 不完整格式（流式生成中）：<!-- quiz ...（没有 -->）
 * 
 * 同时支持 explanation 跨多行
 */
export function parseQuizFromComment(raw: string): QuizData | null {
  // 移除 <!-- quiz 开头标记（支持 <!-- quiz、<!--quiz、<!--  quiz 等变体）
  let body = raw.replace(/^<!--\s*quiz\s*/i, "").trim();
  
  // 移除 --> 结尾标记（如果存在）
  body = body.replace(/\s*-->\s*$/, "").trim();
  
  if (!body) return null;

  const lines = body.split("\n").map((l) => l.trimRight()).filter((l) => l.trim());
  const data: Partial<QuizData> = { options: {} };
  let currentField: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 检查是否是新的字段开始
    if (trimmed.startsWith("question:")) {
      data.question = trimmed.slice("question:".length).trim();
      currentField = "question";
    } else if (trimmed.startsWith("A:")) {
      data.options = { ...data.options, A: trimmed.slice("A:".length).trim() };
      currentField = "A";
    } else if (trimmed.startsWith("B:")) {
      data.options = { ...data.options, B: trimmed.slice("B:".length).trim() };
      currentField = "B";
    } else if (trimmed.startsWith("C:")) {
      data.options = { ...data.options, C: trimmed.slice("C:".length).trim() };
      currentField = "C";
    } else if (trimmed.startsWith("D:")) {
      data.options = { ...data.options, D: trimmed.slice("D:".length).trim() };
      currentField = "D";
    } else if (trimmed.startsWith("correct:")) {
      data.correct = trimmed.slice("correct:".length).trim() as QuizOption;
      currentField = "correct";
    } else if (trimmed.startsWith("explanation:")) {
      data.explanation = trimmed.slice("explanation:".length).trim();
      currentField = "explanation";
    } else if (currentField === "explanation" && data.explanation) {
      // explanation 支持多行：将续行追加到 explanation
      data.explanation += "\n" + trimmed;
    }
    // 其他续行情况：目前忽略（或可根据需要扩展）
  }

  const hasQuestion = !!data.question;
  const hasCorrect = !!data.correct && /^[A-D]$/.test(data.correct);
  const optionCount = data.options ? Object.keys(data.options).length : 0;

  if (hasQuestion && hasCorrect && optionCount >= 2) {
    return data as QuizData;
  }
  
  // 调试日志：解析失败时输出原因
  if (import.meta.env.DEV) {
    console.warn("[parseQuizFromComment] 解析失败:", { 
      hasQuestion, hasCorrect, optionCount,
      question: data.question?.slice(0, 30),
      correct: data.correct,
      raw: raw.slice(0, 100) + "..." 
    });
  }
  return null;
}

/** 从完整markdown中提取所有quiz注释
 * 
 * 策略：
 * 1. 先匹配完整的 <!-- quiz ... -->
 * 2. 如果末尾有不完整的 <!-- quiz ...（没有 -->），也尝试解析
 */
export function extractQuizzes(markdown: string): Array<{
  fullMatch: string;
  quiz: QuizData;
  index: number;
}> {
  const results: Array<{ fullMatch: string; quiz: QuizData; index: number }> = [];
  
  // 策略1：匹配完整的 <!-- quiz ... -->
  const completeRegex = /<!--\s*quiz[\s\S]*?-->/gi;
  let match: RegExpExecArray | null;
  const matchedIndices = new Set<number>();

  while ((match = completeRegex.exec(markdown)) !== null) {
    const quiz = parseQuizFromComment(match[0]);
    if (quiz) {
      results.push({ fullMatch: match[0], quiz, index: match.index });
      matchedIndices.add(match.index);
    }
  }

  // 策略2：检查末尾是否有不完整的 quiz 块（流式生成中常见）
  // 查找最后一个 <!-- quiz 开头，且没有被上面的正则匹配
  const incompleteRegex = /<!--\s*quiz\s+(?:(?!<!--\s*quiz)[\s\S])*$/i;
  const incompleteMatch = incompleteRegex.exec(markdown);
  if (incompleteMatch && !matchedIndices.has(incompleteMatch.index)) {
    const quiz = parseQuizFromComment(incompleteMatch[0]);
    if (quiz) {
      results.push({ fullMatch: incompleteMatch[0], quiz, index: incompleteMatch.index });
    }
  }

  // 按 index 排序
  results.sort((a, b) => a.index - b.index);

  return results;
}

type QuizOption = "A" | "B" | "C" | "D";

interface QuizData {
  question: string;
  options: Record<string, string>;
  correct: QuizOption;
  explanation?: string;
}

interface QuizCardProps {
  quiz: QuizData;
  knowledgeName: string;
  onSubmitted?: () => void;
}

/** 单道答题卡片 */
export function QuizCard({ quiz, knowledgeName, onSubmitted }: QuizCardProps) {
  const [selected, setSelected] = useState<QuizOption | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const store = useLearningStore();
  const submitQuiz = trpc.mastery.submitQuiz.useMutation({
    onSuccess: () => {
      onSubmitted?.();
    },
  });

  const handleSelect = useCallback((option: QuizOption) => {
    if (submitted) return;
    setSelected(option);
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (!selected || submitted) return;
    setSubmitted(true);
    setShowExplanation(true);

    // 提交到后端
    if (store.currentPlanId) {
      submitQuiz.mutate({
        planId: store.currentPlanId,
        dayNumber: store.currentDay,
        knowledgeName,
        question: quiz.question,
        userAnswer: selected,
        correctAnswer: quiz.correct,
        isCorrect: selected === quiz.correct,
      });
    }
  }, [selected, submitted, quiz, knowledgeName, store, submitQuiz]);

  const handleRetry = useCallback(() => {
    setSelected(null);
    setSubmitted(false);
    setShowExplanation(false);
  }, []);

  const isCorrect = selected === quiz.correct;
  const optionKeys = Object.keys(quiz.options) as QuizOption[];

  const getOptionStyle = (key: QuizOption) => {
    if (!submitted) {
      return selected === key
        ? "border-[#6E56CF] bg-[rgba(110,86,207,0.15)]"
        : "border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.03)]";
    }
    if (key === quiz.correct) {
      return "border-[#34C759] bg-[rgba(52,199,89,0.1)]";
    }
    if (selected === key && key !== quiz.correct) {
      return "border-[#FF3B30] bg-[rgba(255,59,48,0.1)]";
    }
    return "border-[rgba(255,255,255,0.05)] opacity-40";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-5 rounded-2xl border border-[rgba(110,86,207,0.2)] overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(110,86,207,0.08) 0%, rgba(110,86,207,0.02) 100%)" }}
    >
      {/* 头部 */}
      <div className="px-4 py-3 md:px-5 md:py-4 flex items-center gap-2 border-b border-[rgba(110,86,207,0.1)]">
        <HelpCircle size={16} className="text-[#6E56CF]" />
        <span className="text-xs font-medium text-[#A78BFA]">练习题</span>
      </div>

      {/* 题目 */}
      <div className="px-4 py-3 md:px-5 md:py-4">
        <p className="text-sm md:text-base font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {quiz.question}
        </p>
      </div>

      {/* 选项 */}
      <div className="px-4 md:px-5 pb-3 space-y-2">
        {optionKeys.map((key) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            disabled={submitted}
            className={`w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-xl border text-left transition-all ${getOptionStyle(key)}`}
          >
            <div
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs md:text-sm font-semibold ${
                submitted && key === quiz.correct
                  ? "bg-[#34C759] text-white"
                  : submitted && selected === key
                    ? "bg-[#FF3B30] text-white"
                    : selected === key
                      ? "bg-[#6E56CF] text-white"
                      : "bg-[rgba(255,255,255,0.05)]"
              }`}
            >
              {submitted && key === quiz.correct ? (
                <CheckCircle2 size={16} />
              ) : submitted && selected === key ? (
                <XCircle size={16} />
              ) : (
                key
              )}
            </div>
            <span className="text-xs md:text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {quiz.options[key]}
            </span>
          </button>
        ))}
      </div>

      {/* 提交按钮 */}
      {!submitted && (
        <div className="px-4 md:px-5 pb-4">
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="w-full py-2.5 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl text-sm font-medium transition-colors"
          >
            提交答案
          </button>
        </div>
      )}

      {/* 结果反馈 */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[rgba(255,255,255,0.05)]"
          >
            {/* 对错提示 */}
            <div
              className={`px-4 md:px-5 py-3 flex items-center gap-2 ${
                isCorrect ? "text-[#34C759]" : "text-[#FF3B30]"
              }`}
            >
              {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span className="text-sm font-medium">
                {isCorrect ? "回答正确！" : `回答错误，正确答案是 ${quiz.correct}`}
              </span>
            </div>

            {/* 解析 */}
            {quiz.explanation && showExplanation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 md:px-5 pb-4"
              >
                <div
                  className="p-3 md:p-4 rounded-xl border"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} className="text-[#FF9500]" />
                    <span className="text-xs font-medium text-[#FF9500]">答案解析</span>
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {quiz.explanation}
                  </p>
                </div>
              </motion.div>
            )}

            {/* 再试一次 */}
            <div className="px-4 md:px-5 pb-4 flex gap-2">
              <button
                onClick={handleRetry}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "var(--text-primary)",
                }}
              >
                <RotateCcw size={14} /> 再试一次
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** 将包含quiz注释的markdown分割为普通文本和quiz块 */
export function splitContentWithQuizzes(
  markdown: string
): Array<{ type: "text"; content: string } | { type: "quiz"; quiz: QuizData }> {
  const quizzes = extractQuizzes(markdown);
  if (quizzes.length === 0) return [{ type: "text", content: markdown }];

  const parts: Array<{ type: "text"; content: string } | { type: "quiz"; quiz: QuizData }> = [];
  let lastIndex = 0;

  for (const { fullMatch, quiz, index } of quizzes) {
    if (index > lastIndex) {
      parts.push({ type: "text", content: markdown.slice(lastIndex, index) });
    }
    parts.push({ type: "quiz", quiz });
    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < markdown.length) {
    parts.push({ type: "text", content: markdown.slice(lastIndex) });
  }

  return parts;
}
