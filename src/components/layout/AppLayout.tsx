import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import MobileMenuDrawer from "@/components/layout/MobileMenuDrawer";
import Progress from "@/pages/Progress";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { path: "/today", label: "今日", icon: Sun },
  { path: "/plans", label: "计划", icon: LayoutDashboard },
  { path: "/progress", label: "进度", icon: BarChart3 },
  { path: "/settings", label: "设置", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

function isNavActive(pathname: string, itemPath: string) {
  if (itemPath === "/today") return pathname === "/today" || pathname === "/study";
  if (itemPath === "/progress") return pathname === "/progress" || pathname === "/mastery" || pathname === "/history";
  return pathname === itemPath;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { logout } = useAuth();

  // 移动端全屏视图：none=路由页面, menu=左侧菜单, progress=右侧进度
  const [mobileView, setMobileView] = useState<"none" | "menu" | "progress">("none");

  // 路由变化时关闭全屏视图
  useEffect(() => {
    setMobileView("none");
  }, [location.pathname]);

  // 全屏视图打开时锁定背景滚动
  useEffect(() => {
    if (mobileView === "none") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileView]);



  return (
    <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="hidden md:flex h-full w-full">
        <aside className="w-[220px] lg:w-[240px] liquid-glass border-r border-token-surface z-20 flex flex-col flex-shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <img src="/logo.png" alt="弈智" className="w-7 h-7 rounded-lg flex-shrink-0" />
            <span className="text-base font-semibold text-token-primary">弈智</span>
            <span className="type-caption font-medium text-token-brand bg-token-brand-muted px-1.5 py-0.5 rounded-full">AI</span>
          </div>

          <nav className="flex-1 px-2.5 py-1 space-y-0.5">
            {navItems.map((item) => {
              const isActive = isNavActive(location.pathname, item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 relative ${
                    isActive
                      ? "bg-token-brand-muted text-token-primary"
                      : "text-token-secondary hover:text-token-primary hover-surface"
                  }`}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    />
                  )}
                  <Icon size={17} className="flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-2.5 border-t border-token-surface">
            <button
              onClick={logout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-token-secondary hover:text-token-primary hover-surface transition-all w-full text-sm"
            >
              <LogOut size={16} />
              <span>退出</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <div className="md:hidden flex flex-col h-full w-full">
        {/* 顶栏：左三条杠菜单，右进度 */}
        <div
          className="app-mobile-topbar min-h-10 safe-area-pt backdrop-blur-xl border-b border-token-surface z-30 flex items-center justify-between px-2 flex-shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-primary) 80%, transparent)" }}
        >
          <button
            type="button"
            onClick={() => setMobileView(mobileView === "menu" ? "none" : "menu")}
            aria-label={mobileView === "menu" ? "关闭菜单" : "打开菜单"}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-token-primary"
          >
            {mobileView === "menu" ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            type="button"
            onClick={() => setMobileView(mobileView === "progress" ? "none" : "progress")}
            aria-label="学习进度"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              mobileView === "progress" ? "text-token-brand-light" : "text-token-primary"
            }`}
          >
            <BarChart3 size={20} />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto min-w-0" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </main>

        {/* 左侧菜单全屏视图（含用户信息 + 计划列表） */}
        <MobileMenuDrawer open={mobileView === "menu"} onClose={() => setMobileView("none")} />

        {/* 进度全屏视图（右侧滑入） */}
        <AnimatePresence>
          {mobileView === "progress" && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-20 md:hidden flex flex-col"
              style={{ backgroundColor: "var(--bg-primary)" }}
              role="dialog"
              aria-modal="true"
              aria-label="学习进度"
            >
              {/* 顶栏占位（顶栏在其上方，可点击关闭） */}
              <div className="min-h-10 safe-area-pt flex-shrink-0" />
              <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: "touch" }}>
                <Progress />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
