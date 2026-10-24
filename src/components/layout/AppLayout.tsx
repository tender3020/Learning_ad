import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Sun,
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name || (user?.phone ? `用户${user.phone.slice(-4)}` : "学习者");
  const isToday = isNavActive(location.pathname, "/today");
  const currentNav = navItems.find((n) => isNavActive(location.pathname, n.path));

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
        <div
          className="min-h-10 safe-area-pt backdrop-blur-xl border-b border-token-surface z-30 flex items-center justify-between px-3 flex-shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-primary) 80%, transparent)" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/logo.png" alt="弈智" className="w-5 h-5 rounded flex-shrink-0" />
            <span className="text-sm font-semibold text-token-primary truncate">
              {isToday ? "弈智" : currentNav?.label || "弈智"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate("/settings")}
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))" }}
            >
              <span className="type-caption font-semibold text-white">{(displayName[0] || "U").toUpperCase()}</span>
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto min-w-0" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </main>

        <nav
          className="min-h-12 backdrop-blur-xl border-t border-token-surface z-30 flex items-center justify-around flex-shrink-0 safe-area-pb"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-secondary) 90%, transparent)" }}
        >
          {navItems.map((item) => {
            const isActive = isNavActive(location.pathname, item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0 w-14 h-full rounded-lg transition-all relative ${
                  isActive ? "text-token-brand-light" : "text-token-secondary"
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="type-caption font-medium">{item.label}</span>
                {isActive && (
                  <div
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
