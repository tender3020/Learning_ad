import { useEffect, useCallback, useMemo, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useLearningStore } from "@/stores/useLearningStore";

export function useAuth() {
  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
  } = trpc.user.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // 用户切换检测：当 user.id 变化时，切换 store 中的用户
  const prevUserIdRef = useRef<number | null>(null);
  const switchUser = useLearningStore((s) => s.switchUser);
  const reset = useLearningStore((s) => s.reset);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;

    if (currentUserId && currentUserId !== prevUserId) {
      // 新用户登录（或切换到不同用户）
      switchUser(currentUserId);
      prevUserIdRef.current = currentUserId;
    } else if (!currentUserId && prevUserId) {
      // 用户登出
      reset();
      prevUserIdRef.current = null;
    }
  }, [user?.id, switchUser, reset]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      // 清除 localStorage 中的 token
      localStorage.removeItem("yizhi_token");
      // 清除学习状态
      reset();
      // 清除所有查询缓存
      await utils.invalidate();
      // 刷新页面以重置所有状态
      window.location.reload();
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading,
      logout,
    }),
    [user, isLoading, logout],
  );
}
