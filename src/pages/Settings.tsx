import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import WireframeSphere from "@/components/3d/WireframeSphere";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  ChevronRight,
  LogOut,
  X,
  Check,
  Edit3,
  Moon,
  Sun,
  Smartphone,
  Mail,
  Clock,
  Eye,
  Database,
  FileText,
} from "lucide-react";

// 本地设置类型
interface LocalSettings {
  notifyStudyReminder: boolean;
  notifyNewContent: boolean;
  theme: "dark" | "light";
}

function getLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem("yizhi_settings");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    notifyStudyReminder: true,
    notifyNewContent: true,
    theme: "dark",
  };
}

function saveLocalSettings(settings: LocalSettings) {
  localStorage.setItem("yizhi_settings", JSON.stringify(settings));
}

// 应用主题到 document
function applyThemeToDocument(theme: "dark" | "light") {
  if (theme === "light") {
    document.documentElement.classList.add("theme-light");
  } else {
    document.documentElement.classList.remove("theme-light");
  }
}

// 请求浏览器通知权限
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

// 发送测试通知
function sendTestNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo.png",
      });
    } catch {
      // 某些环境不支持
    }
  }
}

export default function Settings() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [settings, setSettings] = useState<LocalSettings>(getLocalSettings);
  const [notifyMsg, setNotifyMsg] = useState<string>("");

  // 个人信息编辑
  const [editName, setEditName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setSavingName(false);
      setActiveModal(null);
    },
    onError: () => {
      setSavingName(false);
    },
  });

  const displayName = user?.name || (user?.phone ? `用户${user.phone.slice(-4)}` : "学习者");

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setSavingName(true);
    await updateProfile.mutateAsync({ name: editName.trim() });
  };

  const toggleSetting = useCallback((key: keyof LocalSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveLocalSettings(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: "dark" | "light") => {
    setSettings((prev) => {
      const next = { ...prev, theme };
      saveLocalSettings(next);
      applyThemeToDocument(theme);
      return next;
    });
  }, []);

  // 处理通知开关
  const handleNotifyToggle = async (key: "notifyStudyReminder" | "notifyNewContent") => {
    const nextValue = !settings[key];

    if (nextValue) {
      // 开启时请求权限
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotifyMsg("请在浏览器设置中允许通知权限");
        setTimeout(() => setNotifyMsg(""), 3000);
        return;
      }
      // 发送一条测试通知
      if (key === "notifyStudyReminder") {
        sendTestNotification("弈智 AI", "学习提醒已开启，我会准时提醒你学习！");
      } else {
        sendTestNotification("弈智 AI", "新内容推送已开启，学习内容生成后我会通知你。");
      }
    }

    toggleSetting(key);
  };

  return (
    <div className="h-full relative overflow-y-auto">
      <WireframeSphere opacity={0.1} />

      {/* 短暂提示 */}
      <AnimatePresence>
        {notifyMsg && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-0 right-0 z-[70] flex justify-center pointer-events-none">
            <div className="liquid-glass px-4 py-2 rounded-full text-xs text-[#FF9500]">{notifyMsg}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 px-3 py-3 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-8">
          <h1 className="text-lg md:text-3xl font-semibold mb-1 md:mb-2" style={{ color: 'var(--text-primary)' }}>设置</h1>
          <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>管理你的账户和偏好设置</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="liquid-glass rounded-xl md:rounded-2xl p-3 md:p-6 mb-3 md:mb-6">
          <div className="flex items-center gap-2.5 md:gap-4">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#6E56CF] to-[#A78BFA] flex items-center justify-center flex-shrink-0">
              <span className="text-sm md:text-xl font-semibold text-white">{displayName[0]?.toUpperCase() || "U"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm md:text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</h2>
              <p className="text-[11px] md:text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.phone?.replace(/(\d{3})(\d{4})(\d{4})/, "$1****$3") || "未绑定手机号"}</p>
            </div>
            <button onClick={() => { setEditName(user?.name || ""); setActiveModal("profile"); }}
              className="p-1.5 md:p-2 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] transition-all flex-shrink-0">
              <Edit3 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </motion.div>

        {/* Account Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-3 md:mb-6">
          <h3 className="text-[9px] md:text-xs font-medium uppercase tracking-wider mb-1.5 md:mb-3 px-1" style={{ color: 'var(--text-secondary)' }}>
            账户
          </h3>
          <div className="liquid-glass rounded-xl md:rounded-2xl overflow-hidden">
            {/* 个人信息 */}
            <button onClick={() => { setEditName(user?.name || ""); setActiveModal("profile"); }}
              className="w-full flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(110,86,207,0.1)] flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-[#6E56CF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>个人信息</p>
                <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>管理你的姓名和头像</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
            </button>

            {/* 通知设置 */}
            <button onClick={() => setActiveModal("notifications")}
              className="w-full flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(255,149,0,0.1)] flex items-center justify-center flex-shrink-0">
                <Bell size={14} className="text-[#FF9500]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>通知设置</p>
                <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>学习提醒和推送</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(settings.notifyStudyReminder || settings.notifyNewContent) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                )}
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
              </div>
            </button>

            {/* 隐私安全 */}
            <button onClick={() => setActiveModal("privacy")}
              className="w-full flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.02)]">
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(52,199,89,0.1)] flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-[#34C759]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>隐私安全</p>
                <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>账户安全和数据隐私</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
            </button>
          </div>
        </motion.div>

        {/* Preferences Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-3 md:mb-6">
          <h3 className="text-[9px] md:text-xs font-medium uppercase tracking-wider mb-1.5 md:mb-3 px-1" style={{ color: 'var(--text-secondary)' }}>
            偏好
          </h3>
          <div className="liquid-glass rounded-xl md:rounded-2xl overflow-hidden">
            {/* 主题外观 */}
            <button onClick={() => setActiveModal("theme")}
              className="w-full flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(167,139,250,0.1)] flex items-center justify-center flex-shrink-0">
                <Palette size={14} className="text-[#A78BFA]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>主题外观</p>
                <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>{settings.theme === "dark" ? "深色模式" : "浅色模式"}</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
            </button>

            {/* 语言 */}
            <button onClick={() => setActiveModal("language")}
              className="w-full flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 text-left transition-all hover:bg-[rgba(255,255,255,0.02)]">
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(10,132,255,0.1)] flex items-center justify-center flex-shrink-0">
                <Globe size={14} className="text-[#0A84FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>语言</p>
                <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>简体中文</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
            </button>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full liquid-glass rounded-xl md:rounded-2xl p-2.5 md:p-4 flex items-center gap-2.5 md:gap-4 text-left hover:bg-[rgba(255,59,48,0.05)] transition-all">
            <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[rgba(255,59,48,0.1)] flex items-center justify-center flex-shrink-0">
              <LogOut size={14} className="text-[#FF3B30]" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-medium text-[#FF3B30]">退出登录</p>
              <p className="text-[9px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>退出当前账户</p>
            </div>
          </button>
        </motion.div>

        {/* ========== 弹窗区域 ========== */}
        <AnimatePresence>
          {/* --- 个人信息弹窗 --- */}
          {activeModal === "profile" && (
            <ModalWrapper onClose={() => setActiveModal(null)} title="个人信息" icon={<User size={16} className="text-[#6E56CF]" />}>
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#6E56CF] to-[#A78BFA] flex items-center justify-center">
                    <span className="text-xl md:text-2xl font-semibold text-white">{displayName[0]?.toUpperCase() || "U"}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>昵称</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    placeholder="输入你的昵称"
                    className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-[#6E56CF] transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>手机号</label>
                  <div className="w-full px-4 py-3 border rounded-xl text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {user?.phone?.replace(/(\d{3})(\d{4})(\d{4})/, "$1****$3") || "未绑定"}
                  </div>
                </div>
                <button onClick={handleUpdateName} disabled={savingName || !editName.trim()}
                  className="w-full py-3 bg-[#6E56CF] hover:bg-[#5A45B0] disabled:bg-[rgba(255,255,255,0.05)] disabled:text-[#8A8A8E] text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
                  {savingName ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> 保存修改</>
                  )}
                </button>
              </div>
            </ModalWrapper>
          )}

          {/* --- 通知设置弹窗 --- */}
          {activeModal === "notifications" && (
            <ModalWrapper onClose={() => setActiveModal(null)} title="通知设置" icon={<Bell size={16} className="text-[#FF9500]" />}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="text-[#6E56CF]" />
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>学习提醒</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>每日学习提醒通知</p>
                    </div>
                  </div>
                  <Switch checked={settings.notifyStudyReminder} onCheckedChange={() => handleNotifyToggle("notifyStudyReminder")} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <Smartphone size={16} className="text-[#34C759]" />
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>新内容推送</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>学习内容生成完成时通知</p>
                    </div>
                  </div>
                  <Switch checked={settings.notifyNewContent} onCheckedChange={() => handleNotifyToggle("notifyNewContent")} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border opacity-40"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-[#A78BFA]" />
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>邮件通知</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>学习周报和进度报告（即将上线）</p>
                    </div>
                  </div>
                  <Switch disabled checked={false} />
                </div>

                {/* 通知说明 */}
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(110,86,207,0.05)', borderColor: 'rgba(110,86,207,0.1)' }}>
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    通知通过浏览器推送发送。开启后，系统会在你设置的学习时间发送提醒。
                    请确保浏览器允许通知权限。
                  </p>
                </div>
              </div>
            </ModalWrapper>
          )}

          {/* --- 主题外观弹窗 --- */}
          {activeModal === "theme" && (
            <ModalWrapper onClose={() => setActiveModal(null)} title="主题外观" icon={<Palette size={16} className="text-[#A78BFA]" />}>
              <div className="space-y-3">
                <button onClick={() => setTheme("dark")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    settings.theme === "dark" ? "bg-[rgba(110,86,207,0.1)] border-[rgba(110,86,207,0.3)]" : "border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.04)]"
                  }`}>
                  <div className="w-10 h-10 rounded-lg border border-[rgba(255,255,255,0.1)] flex items-center justify-center" style={{ background: '#1a1a2e' }}>
                    <Moon size={18} className="text-[#A78BFA]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>深色模式</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>护眼的暗色背景</p>
                  </div>
                  {settings.theme === "dark" && <Check size={18} className="text-[#6E56CF]" />}
                </button>
                <button onClick={() => setTheme("light")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    settings.theme === "light" ? "bg-[rgba(110,86,207,0.1)] border-[rgba(110,86,207,0.3)]" : "border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.04)]"
                  }`}>
                  <div className="w-10 h-10 rounded-lg border flex items-center justify-center" style={{ background: '#F5F5F7', borderColor: 'rgba(0,0,0,0.1)' }}>
                    <Sun size={18} className="text-[#FF9500]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>浅色模式</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>明亮的阅读体验</p>
                  </div>
                  {settings.theme === "light" && <Check size={18} className="text-[#6E56CF]" />}
                </button>
              </div>
            </ModalWrapper>
          )}

          {/* --- 隐私安全弹窗 --- */}
          {activeModal === "privacy" && (
            <ModalWrapper onClose={() => setActiveModal(null)} title="隐私安全" icon={<Shield size={16} className="text-[#34C759]" />}>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Eye size={16} className="text-[#6E56CF] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>数据可见性</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>你的学习数据仅存储在你的账户下，不会与其他用户共享。AI 问答内容仅用于提供更好的学习建议。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Database size={16} className="text-[#34C759] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>数据存储</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>所有学习数据存储在加密的数据库中。你的手机号仅用于登录认证，不会用于其他用途。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <FileText size={16} className="text-[#FF9500] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>AI 使用说明</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>学习内容由 DeepSeek AI 生成，仅供学习参考。问答交互数据可能被用于改进 AI 回复质量。</p>
                  </div>
                </div>
              </div>
            </ModalWrapper>
          )}

          {/* --- 语言弹窗 --- */}
          {activeModal === "language" && (
            <ModalWrapper onClose={() => setActiveModal(null)} title="语言设置" icon={<Globe size={16} className="text-[#0A84FF]" />}>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(110,86,207,0.3)]" style={{ backgroundColor: 'rgba(110,86,207,0.1)' }}>
                  <span className="text-lg">CN</span>
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>简体中文</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>当前语言</p>
                  </div>
                  <Check size={18} className="text-[#6E56CF]" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-lg">EN</span>
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>English</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>即将上线</p>
                  </div>
                </div>
              </div>
            </ModalWrapper>
          )}

          {/* --- 退出确认 --- */}
          {showLogoutConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
              onClick={() => setShowLogoutConfirm(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="liquid-glass rounded-2xl p-5 md:p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base md:text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>确认退出？</h3>
                <p className="text-xs md:text-sm mb-5 md:mb-6" style={{ color: 'var(--text-secondary)' }}>退出后需要重新登录才能访问你的学习数据。</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>取消</button>
                  <button onClick={logout}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] text-white text-sm font-medium hover:bg-[#E6352B] transition-all">退出</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===== 通用弹窗组件 =====
function ModalWrapper({ children, onClose, title, icon }: { children: React.ReactNode; onClose: () => void; title: string; icon: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[60]"
      onClick={onClose}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:mx-4 liquid-glass rounded-t-2xl md:rounded-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {/* 弹窗头部 - 固定在顶部 */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.05)] bg-inherit backdrop-blur-xl rounded-t-2xl">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm md:text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        {/* 弹窗内容 - 底部增加 pb-20 给 Tab Bar 留空间 */}
        <div className="p-4 md:p-5 pb-20 md:pb-5">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
