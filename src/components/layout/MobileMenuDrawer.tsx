import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, SquarePen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import UserAvatar from "@/components/UserAvatar";
import Dashboard from "@/pages/Dashboard";

type MobileMenuDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/** 移动端全屏菜单：头像/新建 + 完整计划管理（与 /plans 同一套内容） */
export default function MobileMenuDrawer({ open, onClose }: MobileMenuDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const displayName = user?.name || (user?.phone ? `用户${user.phone.slice(-4)}` : "学习者");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handlePlanActivated = () => {
    onClose();
    if (location.pathname !== "/today") {
      navigate("/today");
    } else {
      // 切换计划后刷新阅读页内容
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-20 md:hidden flex flex-col"
          style={{ backgroundColor: "var(--bg-primary)" }}
          role="dialog"
          aria-modal="true"
          aria-label="菜单"
        >
          <div className="min-h-10 safe-area-pt flex-shrink-0" />

          <div className="px-4 pt-3 pb-3 flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => go("/settings")} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <UserAvatar
                name={displayName}
                avatar={user?.avatar}
                className="w-11 h-11"
                textClassName="text-base"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-token-primary truncate">{displayName}</p>
                <p className="type-caption text-token-secondary">账户与设置</p>
              </div>
              <ChevronRight size={16} className="text-token-secondary flex-shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => go("/onboarding")}
              aria-label="新建学习计划"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-token-primary hover-surface flex-shrink-0"
            >
              <SquarePen size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 safe-area-pb" style={{ WebkitOverflowScrolling: "touch" }}>
            <Dashboard embedded onPlanActivated={handlePlanActivated} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
