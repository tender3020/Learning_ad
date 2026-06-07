import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useLearningStore } from "@/stores/useLearningStore";
import WireframeSphere from "@/components/3d/WireframeSphere";
import {
  Target,
  TrendingUp,
  Clock,
  Brain,
  Award,
  CheckCircle2,
} from "lucide-react";

export default function Mastery() {
  const { currentPlanId } = useLearningStore();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const { data: scores } = trpc.mastery.getScores.useQuery(
    { planId: currentPlanId || 0 },
    { enabled: !!currentPlanId }
  );
  const { data: stats } = trpc.mastery.getStats.useQuery(
    { planId: currentPlanId || 0 },
    { enabled: !!currentPlanId }
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#34C759";
    if (score >= 60) return "#FF9500";
    return "#FF3B30";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "优秀";
    if (score >= 60) return "良好";
    if (score >= 40) return "一般";
    return "需加强";
  };

  // 计算各维度统计数据
  const totalCorrect = scores?.reduce((sum, s) => sum + s.correctAnswers, 0) || 0;
  const totalAttempts = (scores?.reduce((s, sc) => s + sc.questionsAsked, 0) || 0) + totalCorrect;
  const quizAccuracy = totalCorrect > 0 && totalAttempts > 0
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;

  return (
    <div className="h-full relative overflow-y-auto">
      <WireframeSphere opacity={0.1} />

      <div className="relative z-10 px-3 py-3 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-8">
          <h1 className="text-lg md:text-3xl font-semibold text-[#F5F5F7] mb-1 md:mb-2">掌握度分析</h1>
          <p className="text-xs md:text-sm text-[#8A8A8E]">基于学习时长、问答互动、练习正确率、学习频率四维加权计算</p>
        </motion.div>

        {/* Stats - 2x2(手机) / 4列(桌面) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-8">
          {[
            { label: "总体掌握度", value: `${Math.round(stats?.avgScore || 0)}%`, icon: Target, color: "#6E56CF", detail: "加权综合评分" },
            { label: "已学知识点", value: `${stats?.totalTopics || 0}`, icon: Brain, color: "#34C759", detail: "个知识模块" },
            { label: "学习时长", value: `${stats?.totalStudyMinutes || 0}m`, icon: Clock, color: "#FF9500", detail: "累计分钟" },
            { label: "练习正确率", value: `${quizAccuracy}%`, icon: CheckCircle2, color: "#A78BFA", detail: `${totalCorrect} 次正确` },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-5">
              <div className="flex items-center justify-between mb-1.5 md:mb-3">
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div className="text-lg md:text-2xl font-semibold text-[#F5F5F7] mb-0.5 md:mb-1">{stat.value}</div>
              <div className="text-[11px] md:text-xs text-[#8A8A8E]">{stat.label}</div>
              <div className="text-[9px] md:text-xs text-[#8A8A8E] mt-0.5">{stat.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* Mastery Ring + Topic List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          {/* Mastery Ring */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="liquid-glass rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col items-center">
            <h3 className="text-xs md:text-sm font-medium text-[#8A8A8E] mb-4 md:mb-6">总体掌握度</h3>
            <div className="relative w-28 h-28 md:w-40 md:h-40 mb-4">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#masteryGradientMain)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(stats?.avgScore || 0) * 2.64} 264`}
                  initial={{ strokeDasharray: "0 264" }}
                  animate={{ strokeDasharray: `${(stats?.avgScore || 0) * 2.64} 264` }}
                  transition={{ duration: 1.5, ease: "easeOut" }} className="progress-ring-circle" />
                <defs><linearGradient id="masteryGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6E56CF" /><stop offset="100%" stopColor="#34C759" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="text-xl md:text-3xl font-bold text-[#F5F5F7]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  {Math.round(stats?.avgScore || 0)}%
                </motion.span>
                <span className="text-[10px] md:text-xs text-[#8A8A8E]">综合评分</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                <span className="text-[10px] md:text-xs text-[#8A8A8E]">{scores?.filter((s) => s.masteryScore >= 80).length || 0} 优秀</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FF9500]" />
                <span className="text-[10px] md:text-xs text-[#8A8A8E]">{scores?.filter((s) => s.masteryScore >= 60 && s.masteryScore < 80).length || 0} 良好</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FF3B30]" />
                <span className="text-[10px] md:text-xs text-[#8A8A8E]">{scores?.filter((s) => s.masteryScore < 60).length || 0} 需加强</span>
              </div>
            </div>
          </motion.div>

          {/* Topic Scores */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="lg:col-span-2 liquid-glass rounded-xl md:rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-5">
              <h3 className="text-[11px] md:text-sm font-medium text-[#8A8A8E]">知识点掌握度详情</h3>
              <Award size={14} className="text-[#6E56CF]" />
            </div>

            {scores && scores.length > 0 ? (
              <div className="space-y-3">
                {scores.map((score, i) => {
                  const isSelected = selectedTopic === score.knowledgeName;
                  const color = getScoreColor(score.masteryScore);
                  return (
                    <motion.div key={score.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedTopic(isSelected ? null : score.knowledgeName)}
                      className={`p-2.5 md:p-4 rounded-lg md:rounded-xl cursor-pointer transition-all ${
                        isSelected ? "bg-[rgba(110,86,207,0.1)] border border-[rgba(110,86,207,0.2)]" :
                        "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.04)]"
                      }`}>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                            <Brain size={12} style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm font-medium text-[#F5F5F7] truncate">{score.knowledgeName}</p>
                            <p className="text-[9px] md:text-xs text-[#8A8A8E]">提问 {score.questionsAsked} 次 · 学习 {score.studyMinutes} 分钟 · 答对 {score.correctAnswers} 题</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-sm md:text-lg font-semibold" style={{ color }}>{Math.round(score.masteryScore)}%</span>
                          <span className="text-[9px] md:text-xs text-[#8A8A8E] ml-1 md:ml-2">{getScoreLabel(score.masteryScore)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: color }}
                          initial={{ width: 0 }} animate={{ width: `${score.masteryScore}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                      </div>
                      {isSelected && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                          <div className="grid grid-cols-4 gap-2 md:gap-4">
                            <div className="text-center"><p className="text-sm md:text-lg font-semibold text-[#FF9500]">{score.studyMinutes}</p><p className="text-[9px] md:text-xs text-[#8A8A8E]">学习分钟</p></div>
                            <div className="text-center"><p className="text-sm md:text-lg font-semibold text-[#0A84FF]">{score.questionsAsked}</p><p className="text-[9px] md:text-xs text-[#8A8A8E]">问答次数</p></div>
                            <div className="text-center"><p className="text-sm md:text-lg font-semibold text-[#34C759]">{score.correctAnswers}</p><p className="text-[9px] md:text-xs text-[#8A8A8E]">正确答题</p></div>
                            <div className="text-center"><p className="text-sm md:text-lg font-semibold text-[#A78BFA]">{Math.round(score.masteryScore)}%</p><p className="text-[9px] md:text-xs text-[#8A8A8E]">综合评分</p></div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <TrendingUp size={40} className="mx-auto mb-3 text-[#8A8A8E]" />
                <p className="text-sm text-[#8A8A8E]">还没有掌握度数据</p>
                <p className="text-xs text-[#8A8A8E] mt-1">开始学习、答题或问答后，系统会自动追踪你的掌握度</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
