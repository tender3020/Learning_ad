import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSync } from "@/lib/theme";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Study from "./pages/Study";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <img src="/logo.png" alt="弈智" className="w-full h-full object-cover" />
          </div>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand-primary)", borderTopColor: "transparent" }} />
          <p className="text-xs text-token-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function LoginRouteGuard() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/today" replace />;
  }

  return <Login />;
}

export default function App() {
  useThemeSync();
  return (
    <Routes>
      <Route path="/login" element={<LoginRouteGuard />} />
      <Route path="/onboarding" element={
        <AuthenticatedLayout>
          <Onboarding />
        </AuthenticatedLayout>
      } />
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/today" element={
        <AuthenticatedLayout>
          <Study />
        </AuthenticatedLayout>
      } />
      <Route path="/study" element={<Navigate to="/today" replace />} />
      <Route path="/plans" element={
        <AuthenticatedLayout>
          <Dashboard />
        </AuthenticatedLayout>
      } />
      <Route path="/progress" element={
        <AuthenticatedLayout>
          <Progress />
        </AuthenticatedLayout>
      } />
      <Route path="/mastery" element={<Navigate to="/progress" replace />} />
      <Route path="/history" element={<Navigate to="/progress?tab=records" replace />} />
      <Route path="/settings" element={
        <AuthenticatedLayout>
          <Settings />
        </AuthenticatedLayout>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
