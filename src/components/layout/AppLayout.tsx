import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  LayoutDashboard,
  BarChart3,
  MessageCircle,
  Settings,
  Flame,
  LogOut,
} from "lucide-react";

const navItems = [
  { path: "/", label: "看板", icon: LayoutDashboard },
  { path: "/study", label: "学习", icon: BookOpen },
  { path: "/mastery", label: "掌握度", icon: BarChart3 },
  { path: "/history", label: "历史", icon: MessageCircle },
  { path: "/settings", label: "设置", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name || (user?.phone ? `用户${user.phone.slice(-4)}` : "学习者");
  const currentNav = navItems.find((n) => n.path === location.pathname);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ===== 桌面端：flex 布局（侧边栏 + 主内容） ===== */}
      <div className="hidden md:flex h-full w-full">
        {/* 侧边栏 */}
        <aside className="w-[220px] lg:w-[240px] liquid-glass border-r border-[rgba(255,255,255,0.05)] z-20 flex flex-col flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4">
            <img src="/logo.png" alt="弈智" className="w-7 h-7 rounded-lg flex-shrink-0" />
            <span className="text-base font-semibold text-[#F5F5F7]">弈智</span>
            <span className="text-[10px] font-medium text-[#6E56CF] bg-[rgba(110,86,207,0.15)] px-1.5 py-0.5 rounded-full">AI</span>
          </div>

          {/* Streak */}
          <div className="mx-3 mb-3 p-2.5 rounded-xl bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.15)]">
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-[#FF9500]" />
              <span className="text-xs font-medium text-[#FF9500]">连续学习 7 天</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2.5 py-1 space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 relative ${
                    isActive ? "bg-[rgba(110,86,207,0.15)] text-white" : "text-[#8A8A8E] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.03)]"
                  }`}>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#6E56CF] rounded-r-full" />}
                  <Icon size={17} className="flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="p-2.5 border-t border-[rgba(255,255,255,0.05)]">
            <button onClick={logout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#8A8A8E] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.03)] transition-all w-full text-sm">
              <LogOut size={16} />
              <span>退出</span>
            </button>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="flex-1 overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ===== 移动端：顶部栏 + 内容 + 底部 Tab Bar ===== */}
      <div className="md:hidden flex flex-col h-full w-full">
        {/* 顶部栏 - 紧凑模式 */}
        <div className="h-10 backdrop-blur-xl border-b z-30 flex items-center justify-between px-3 flex-shrink-0"
          style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)', borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/logo.png" alt="弈智" className="w-5 h-5 rounded flex-shrink-0" />
            <span className="text-sm font-semibold text-[#F5F5F7] truncate">
              {currentNav?.label || "弈智"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[rgba(255,149,0,0.1)]">
              <Flame size={10} className="text-[#FF9500]" />
              <span className="text-[9px] text-[#FF9500] font-medium">7</span>
            </div>
            <button onClick={() => navigate("/settings")}
              className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6E56CF] to-[#A78BFA] flex items-center justify-center">
              <span className="text-[8px] font-semibold text-white">{(displayName[0] || "U").toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* 主内容（可滚动） */}
        <main className="flex-1 overflow-y-auto min-w-0" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </main>

        {/* 底部 Tab Bar - 紧凑模式 */}
        <nav className="h-12 backdrop-blur-xl border-t z-30 flex items-center justify-around flex-shrink-0 safe-area-pb"
          style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, transparent)', borderColor: 'rgba(255,255,255,0.06)' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center justify-center gap-0 w-14 h-full rounded-lg transition-all relative ${
                  isActive ? "text-[#A78BFA]" : "text-[#8A8A8E]"
                }`}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[9px] font-medium scale-75">{item.label}</span>
                {isActive && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#6E56CF]" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
