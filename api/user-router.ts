import { z } from "zod";
import { TRPCError } from "@trpc/server";
import path from "path";
import fs from "fs/promises";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { findUserById } from "./queries/phone-users";

const AVATAR_DIR = path.resolve(import.meta.dirname, "../data/uploads/avatars");

async function removeOldAvatar(avatarUrl: string | null | undefined) {
  if (!avatarUrl?.startsWith("/uploads/avatars/")) return;
  const filename = path.basename(avatarUrl.split("?")[0]);
  if (!filename || filename.includes("..")) return;
  try {
    await fs.unlink(path.join(AVATAR_DIR, filename));
  } catch {
    // 旧文件不存在时忽略
  }
}

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

  updateAvatar: authedQuery
    .input(
      z.object({
        dataUrl: z
          .string()
          .min(1)
          .max(3_500_000)
          .refine((v) => v.startsWith("data:image/jpeg;base64,"), "请上传 JPEG 图片"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const base64 = input.dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length < 32 || buffer.length > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "图片大小不合适" });
      }

      await fs.mkdir(AVATAR_DIR, { recursive: true });
      const filename = `${ctx.user.id}-${Date.now()}.jpg`;
      await fs.writeFile(path.join(AVATAR_DIR, filename), buffer);

      const current = await findUserById(ctx.user.id);
      await removeOldAvatar(current?.avatar);

      const avatar = `/uploads/avatars/${filename}`;
      const db = getDb();
      await db.update(users).set({ avatar }).where(eq(users.id, ctx.user.id));

      return { success: true, avatar };
    }),
});
