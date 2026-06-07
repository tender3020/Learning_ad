import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { verificationCodes } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { findUserByPhone, createUser, updateUserSignIn } from "./queries/phone-users";
import { createToken } from "./lib/jwt";

// 生成 6 位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 开发模式：直接返回固定验证码方便测试
const DEV_MODE = true;
const DEV_CODE = "123456";

export const phoneAuthRouter = createRouter({
  // 发送验证码
  sendCode: publicQuery
    .input(
      z.object({
        phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const phone = input.phone;

      // 开发模式：直接返回固定验证码，不存入数据库
      if (DEV_MODE) {
        // 但仍然存入数据库，让验证流程能走通
        const code = DEV_CODE;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

        // 将之前的验证码标记为已使用
        await db
          .update(verificationCodes)
          .set({ used: "true" })
          .where(eq(verificationCodes.phone, phone));

        // 创建新的验证码
        await db.insert(verificationCodes).values({
          phone,
          code,
          purpose: "login",
          expiresAt,
          used: "false",
        });

        return {
          success: true,
          message: "验证码已发送（开发模式：123456）",
          devCode: DEV_CODE,
        };
      }

      // 生产模式：生成随机验证码
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

      // 将之前的验证码标记为已使用
      await db
        .update(verificationCodes)
        .set({ used: "true" })
        .where(eq(verificationCodes.phone, phone));

      // 创建新的验证码
      await db.insert(verificationCodes).values({
        phone,
        code,
        purpose: "login",
        expiresAt,
        used: "false",
      });

      // TODO: 接入阿里云/腾讯云短信服务发送真实验证码
      // await sendSms(phone, code);

      return {
        success: true,
        message: "验证码已发送",
      };
    }),

  // 验证码登录
  login: publicQuery
    .input(
      z.object({
        phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
        code: z.string().length(6, "验证码为 6 位数字"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { phone, code } = input;

      // 开发模式：跳过验证码验证
      if (DEV_MODE && code === DEV_CODE) {
        // 查找或创建用户
        let user = await findUserByPhone(phone);
        let isNewUser = false;

        if (!user) {
          await createUser({ phone });
          user = await findUserByPhone(phone);
          isNewUser = true;
        }

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "用户创建失败",
          });
        }

        // 更新最后登录时间
        await updateUserSignIn(user.id);

        // 生成 JWT token
        const token = await createToken({ userId: user.id, phone });

        // 设置 cookie
        ctx.resHeaders.append(
          "set-cookie",
          `yizhi_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
        );

        return {
          success: true,
          token,
          user: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
          },
          isNewUser,
        };
      }

      // 生产模式：验证验证码
      const codes = await db
        .select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.phone, phone),
            eq(verificationCodes.code, code),
            eq(verificationCodes.used, "false"),
          )
        )
        .orderBy(desc(verificationCodes.createdAt))
        .limit(1);

      if (codes.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "验证码错误或已过期",
        });
      }

      const codeRecord = codes[0];

      // 检查是否过期
      if (new Date() > new Date(codeRecord.expiresAt)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "验证码已过期",
        });
      }

      // 标记验证码为已使用
      await db
        .update(verificationCodes)
        .set({ used: "true" })
        .where(eq(verificationCodes.id, codeRecord.id));

      // 查找或创建用户
      let user = await findUserByPhone(phone);
      let isNewUser = false;

      if (!user) {
        await createUser({ phone });
        user = await findUserByPhone(phone);
        isNewUser = true;
      }

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "用户创建失败",
        });
      }

      // 更新最后登录时间
      await updateUserSignIn(user.id);

      // 生成 JWT token
      const token = await createToken({ userId: user.id, phone });

      // 设置 cookie
      ctx.resHeaders.append(
        "set-cookie",
        `yizhi_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
        },
        isNewUser,
      };
    }),
});
