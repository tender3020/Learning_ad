import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Study from "./pages/Study";
import Mastery from "./pages/Mastery";
import History from "./pages/History";
import Settings from "./pages/Settings";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // 加载中显示 spinner
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <img src="/logo.png" alt="弈智" className="w-full h-full object-cover" />
          </div>
          <div className="w-6 h-6 border-2 border-[#6E56CF] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#8A8A8E]">加载中...</p>
        </div>
      </div>
    );
  }

  // 未认证重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// 已登录用户访问登录页时重定向到首页
function LoginRouteGuard() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#6E56CF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRouteGuard />} />
      <Route path="/onboarding" element={
        <AuthenticatedLayout>
          <Onboarding />
        </AuthenticatedLayout>
      } />
      <Route path="/" element={
        <AuthenticatedLayout>
          <Dashboard />
        </AuthenticatedLayout>
      } />
      <Route path="/study" element={
        <AuthenticatedLayout>
          <Study />
        </AuthenticatedLayout>
      } />
      <Route path="/mastery" element={
        <AuthenticatedLayout>
          <Mastery />
        </AuthenticatedLayout>
      } />
      <Route path="/history" element={
        <AuthenticatedLayout>
          <History />
        </AuthenticatedLayout>
      } />
      <Route path="/settings" element={
        <AuthenticatedLayout>
          <Settings />
        </AuthenticatedLayout>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
