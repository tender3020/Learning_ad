import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useLearningStore } from "@/stores/useLearningStore";
import MarkdownRenderer from "@/components/markdown/MarkdownRenderer";
import WireframeSphere from "@/components/3d/WireframeSphere";
import {
  MessageCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";

export default function History() {
  const { currentPlanId } = useLearningStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "day">("all");

  const { data: history } = trpc.qa.getHistory.useQuery(
    { planId: currentPlanId || 0, limit: 100 },
    { enabled: !!currentPlanId }
  );

  const toggleExpand = (id: number) => setExpandedId(expandedId === id ? null : id);
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const groupedByDay = history?.reduce((acc, item) => {
    const day = item.dayNumber;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {} as Record<number, typeof history>);

  return (
    <div className="h-full relative overflow-y-auto">
      <WireframeSphere opacity={0.1} />

      <div className="relative z-10 px-3 py-3 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-8">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-3xl font-semibold text-[#F5F5F7] mb-1 md:mb-2">问答历史</h1>
              <p className="text-xs md:text-sm text-[#8A8A8E]">查看你与 AI 导师的所有对话记录</p>
            </div>
            <div className="flex items-center gap-2 liquid-glass rounded-xl p-1 w-fit">
              <button onClick={() => setFilter("all")}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm transition-all ${filter === "all" ? "bg-[rgba(110,86,207,0.2)] text-[#A78BFA]" : "text-[#8A8A8E] hover:text-[#F5F5F7]"}`}>全部</button>
              <button onClick={() => setFilter("day")}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm transition-all ${filter === "day" ? "bg-[rgba(110,86,207,0.2)] text-[#A78BFA]" : "text-[#8A8A8E] hover:text-[#F5F5F7]"}`}>按天分组</button>
            </div>
          </div>
        </motion.div>

        {/* Stats - 1列(手机) / 3列(平板+) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="liquid-glass rounded-2xl p-4 md:p-5 flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[rgba(110,86,207,0.15)] flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-[#6E56CF]" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-semibold text-[#F5F5F7]">{history?.length || 0}</p>
              <p className="text-xs text-[#8A8A8E]">总问答数</p>
            </div>
          </div>
          <div className="liquid-glass rounded-2xl p-4 md:p-5 flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[rgba(52,199,89,0.15)] flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} className="text-[#34C759]" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-semibold text-[#F5F5F7]">{new Set(history?.map((h) => h.dayNumber)).size || 0}</p>
              <p className="text-xs text-[#8A8A8E]">涉及天数</p>
            </div>
          </div>
          <div className="liquid-glass rounded-2xl p-4 md:p-5 flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[rgba(255,149,0,0.15)] flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-[#FF9500]" />
            </div>
            <div>
              <p className="text-sm md:text-2xl font-semibold text-[#F5F5F7]">{history && history.length > 0 ? formatDate(history[0].createdAt) : "-"}</p>
              <p className="text-xs text-[#8A8A8E]">最近提问</p>
            </div>
          </div>
        </motion.div>

        {/* History List */}
        {filter === "all" ? (
          <div className="space-y-2 md:space-y-3">
            {history && history.length > 0 ? (
              history.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="liquid-glass rounded-2xl overflow-hidden">
                  <button onClick={() => toggleExpand(item.id)}
                    className="w-full flex items-center gap-3 md:gap-4 p-4 md:p-5 text-left">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[rgba(110,86,207,0.15)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] md:text-xs font-medium text-[#6E56CF]">D{item.dayNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">{item.question}</p>
                      <p className="text-[10px] md:text-xs text-[#8A8A8E] mt-0.5">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {expandedId === item.id ? <ChevronUp size={16} className="text-[#8A8A8E]" /> : <ChevronDown size={16} className="text-[#8A8A8E]" />}
                    </div>
                  </button>
                  {expandedId === item.id && item.answer && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="px-4 md:px-5 pb-4 md:pb-5 border-t border-[rgba(255,255,255,0.05)]">
                      <div className="pt-3 md:pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[rgba(110,86,207,0.15)] flex items-center justify-center">
                            <img src="/ai-avatar.png" alt="AI" className="w-3 h-3 md:w-4 md:h-4 rounded-full" />
                          </div>
                          <span className="text-[10px] md:text-xs font-medium text-[#6E56CF]">AI 导师</span>
                        </div>
                        <div className="pl-6 md:pl-8">
                          <MarkdownRenderer content={item.answer} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 md:py-16">
                <MessageCircle size={40} className="mx-auto mb-4 text-[#8A8A8E]" />
                <p className="text-base md:text-lg text-[#8A8A8E] mb-2">还没有问答记录</p>
                <p className="text-xs md:text-sm text-[#8A8A8E]">在学习页面向 AI 导师提问，记录会显示在这里</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5 md:space-y-6">
            {groupedByDay && Object.keys(groupedByDay).length > 0 ? (
              Object.entries(groupedByDay).sort(([a], [b]) => Number(b) - Number(a)).map(([day, items]) => (
                <motion.div key={day} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <Calendar size={14} className="text-[#6E56CF]" />
                    <h3 className="text-sm font-medium text-[#F5F5F7]">第 {day} 天</h3>
                    <span className="text-[10px] md:text-xs text-[#8A8A8E]">({items?.length} 条问答)</span>
                  </div>
                  <div className="space-y-2">
                    {items?.map((item) => (
                      <div key={item.id} className="liquid-glass rounded-xl p-3 md:p-4">
                        <p className="text-sm text-[#F5F5F7] mb-2">{item.question}</p>
                        {item.answer && <div className="text-xs text-[#8A8A8E] line-clamp-2"><MarkdownRenderer content={item.answer} /></div>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 md:py-16">
                <MessageCircle size={40} className="mx-auto mb-4 text-[#8A8A8E]" />
                <p className="text-base md:text-lg text-[#8A8A8E]">还没有问答记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
