export const Session = {
  cookieName: "yizhi_token",
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

export const ErrorMessages = {
  unauthenticated: "请先登录",
  insufficientRole: "权限不足",
} as const;

export const Paths = {
  login: "/login",
} as const;
