import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import UserAvatar from "@/components/UserAvatar";
import Dashboard from "@/pages/Dashboard";
import SwipeCloseSheet from "@/components/layout/SwipeCloseSheet";

type MobileMenuDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/** 移动端全屏菜单：头像/新建 + 完整计划管理（从左滑入，左滑返回） */
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
      window.location.reload();
    }
  };

  return (
    <SwipeCloseSheet
      open={open}
      onClose={onClose}
      side="left"
      aria-label="菜单"
      className="fixed inset-0 z-[25] flex desk:hidden flex-col"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="app-mobile-chrome-offset" aria-hidden />

      <div className="px-4 pt-3 pb-3 flex items-center gap-2 flex-shrink-0">
        <button type="button" onClick={() => go("/settings")} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <UserAvatar
            name={displayName}
            avatar={user?.avatar}
            className="w-11 h-11"
            textClassName="text-base"
          />
          <p className="text-base font-semibold text-token-primary truncate min-w-0 flex-1">{displayName}</p>
        </button>
        <button
          type="button"
          onClick={() => go("/onboarding")}
          aria-label="新建学习计划"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-token-primary hover-surface flex-shrink-0"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 safe-area-pb" style={{ WebkitOverflowScrolling: "touch" }}>
        <Dashboard embedded onPlanActivated={handlePlanActivated} />
      </div>
    </SwipeCloseSheet>
  );
}
