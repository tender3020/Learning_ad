import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { Sparkles, Smartphone, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const sendCode = trpc.phoneAuth.sendCode.useMutation({
    onSuccess: () => {
      setStep("code");
      setError("");
      // 开始倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const login = trpc.phoneAuth.login.useMutation({
    onSuccess: (data) => {
      // 保存 token
      localStorage.setItem("yizhi_token", data.token);
      // 刷新页面
      window.location.reload();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSendCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }
    setError("");
    sendCode.mutate({ phone });
  };

  const handleLogin = () => {
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位验证码");
      return;
    }
    setError("");
    login.mutate({ phone, code });
  };

  const handleBack = () => {
    setStep("phone");
    setCode("");
    setError("");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "url(/hero-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-[#050505]/80 to-[#050505]" />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        <div className="liquid-glass rounded-3xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden"
            >
              <img src="/logo.png" alt="弈智" className="w-full h-full object-cover" />
            </motion.div>
            <h1 className="text-2xl font-semibold text-token-primary mb-1">弈智</h1>
            <p className="text-sm text-token-secondary">AI 驱动的自适应学习平台</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)] text-sm text-[#FF3B30] text-center"
            >
              {error}
            </motion.div>
          )}

          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Phone Input */}
              <div className="mb-6">
                <label className="block text-xs text-token-secondary uppercase tracking-wider mb-2">
                  手机号
                </label>
                <div className="relative">
                  <Smartphone
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-token-secondary"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setPhone(val);
                      setError("");
                    }}
                    placeholder="请输入手机号"
                    className="input-field w-full pl-11 pr-4 py-3.5 rounded-xl text-base"
                    autoFocus
                  />
                </div>
              </div>

              {/* Dev hint */}
              <div className="mb-6 p-3 rounded-xl bg-[rgba(110,86,207,0.08)] border border-[rgba(110,86,207,0.15)]">
                <p className="text-xs text-token-brand-light flex items-center gap-1.5">
                  <Sparkles size={12} />
                  开发模式：验证码固定为 123456
                </p>
              </div>

              {/* Send Code Button */}
              <button
                onClick={handleSendCode}
                disabled={sendCode.isPending || phone.length !== 11}
                className="btn-brand w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium brand-glow"
              >
                {sendCode.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    获取验证码
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Phone display */}
              <div className="mb-4 text-center">
                <p className="text-sm text-token-secondary">
                  验证码已发送至{" "}
                  <span className="text-token-primary">{phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1****$3")}</span>
                </p>
              </div>

              {/* Code Input */}
              <div className="mb-6">
                <label className="block text-xs text-token-secondary uppercase tracking-wider mb-2">
                  验证码
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-token-secondary"
                  />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setCode(val);
                      setError("");
                    }}
                    placeholder="请输入 6 位验证码"
                    className="input-field w-full pl-11 pr-4 py-3.5 rounded-xl text-base tracking-widest text-center"
                    autoFocus
                  />
                </div>
              </div>

              {/* Resend */}
              <div className="mb-6 text-center">
                {countdown > 0 ? (
                  <span className="text-xs text-token-secondary">{countdown} 秒后重新发送</span>
                ) : (
                  <button
                    onClick={handleSendCode}
                    className="text-xs text-token-brand hover:text-token-brand-light transition-colors"
                  >
                    重新发送验证码
                  </button>
                )}
              </div>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={login.isPending || code.length !== 6}
                className="btn-brand w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium brand-glow mb-3"
              >
                {login.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    登录
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Back */}
              <button
                onClick={handleBack}
                className="w-full py-2 text-sm text-token-secondary hover:text-token-primary transition-colors"
              >
                更换手机号
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
