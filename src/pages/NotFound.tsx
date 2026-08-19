import { Link } from "react-router";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="liquid-glass rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="text-4xl font-bold text-token-primary mb-2">404</p>
        <p className="text-sm text-token-secondary mb-6">页面不存在或已被移动</p>
        <Link
          to="/today"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-white bg-token-brand hover:opacity-90 transition-opacity"
        >
          <Sparkles size={16} />
          返回今日学习
        </Link>
      </div>
    </div>
  );
}
