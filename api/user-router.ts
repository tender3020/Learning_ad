import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { findUserById } from "./queries/phone-users";

export const userRouter = createRouter({
  // 获取当前登录用户信息
  me: authedQuery.query(async ({ ctx }) => {
    const user = await findUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "用户不存在",
      });
    }
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }),

  // 更新用户资料（昵称）
  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(1, "昵称不能为空").max(50, "昵称最长 50 个字符"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({ name: input.name })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
});
