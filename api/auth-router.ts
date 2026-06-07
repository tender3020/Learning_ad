import { createRouter, publicQuery } from "./middleware";

export const authRouter = createRouter({
  me: publicQuery.query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }
    return ctx.user;
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    // 清除 cookie
    ctx.resHeaders.append(
      "set-cookie",
      "yizhi_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    );
    return { success: true };
  }),
});
