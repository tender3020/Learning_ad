import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "path";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getUserFromRequest } from "./lib/request-auth";
import { streamContent, streamQAWithContext } from "./services/aiService";
import {
  prepareQARequest,
  saveQARecord,
  pipeQAStreamWithSave,
  QAContextError,
} from "./services/qaService";
import { getDb } from "./queries/connection";
import { synthesizeSentence } from "./lib/volcengine-tts";
import { recordQAMastery } from "./services/masteryService";

const app = new Hono<{ Bindings: HttpBindings }>();

const dataRoot = path.resolve(import.meta.dirname, "../data");

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// 学习内容配图静态资源
app.use(
  "/uploads/*",
  serveStatic({
    root: dataRoot,
  }),
);

// tRPC 路由
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

const streamInputSchema = z.object({
  prompt: z.string().min(1),
  learningType: z
    .enum([
      "abstract_logic",
      "operation_logic",
      "language",
      "network_assoc",
      "model_apply",
      "perception",
      "practical",
    ])
    .default("abstract_logic"),
  skillLevel: z.string().default("l1"),
});

app.post("/api/ai/stream", async (c) => {
  const user = await getUserFromRequest(c.req.raw);
  if (!user) {
    return c.json({ error: "请先登录" }, 401);
  }

  let body: z.infer<typeof streamInputSchema>;
  try {
    body = streamInputSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "请求参数无效" }, 400);
  }

  try {
    const upstream = await streamContent(
      body.prompt,
      body.learningType,
      body.skillLevel,
      c.req.raw.signal,
    );

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return c.json(
        { error: (errorData as { error?: { message?: string } }).error?.message || "AI 请求失败" },
        502,
      );
    }

    if (!upstream.body) {
      return c.json({ error: "无法读取 AI 响应流" }, 502);
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return c.json({ error: message }, 500);
  }
});

const qaStreamInputSchema = z.object({
  planId: z.number(),
  dayNumber: z.number().min(1),
  question: z.string().min(1).max(2000),
});

app.post("/api/ai/qa/stream", async (c) => {
  const user = await getUserFromRequest(c.req.raw);
  if (!user) {
    return c.json({ error: "请先登录" }, 401);
  }

  let body: z.infer<typeof qaStreamInputSchema>;
  try {
    body = qaStreamInputSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "请求参数无效" }, 400);
  }

  const db = getDb();

  try {
    const prepared = await prepareQARequest(
      db,
      user.id,
      body.planId,
      body.dayNumber,
    );

    const upstream = await streamQAWithContext(
      body.question,
      prepared.dayContext,
      prepared.history,
      c.req.raw.signal,
    );

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return c.json(
        {
          error:
            (errorData as { error?: { message?: string } }).error?.message ||
            "AI 请求失败",
        },
        502,
      );
    }

    const outputStream = await pipeQAStreamWithSave(
      upstream,
      async (fullAnswer) => {
        const qaId = await saveQARecord(
          db,
          user.id,
          body.planId,
          body.dayNumber,
          body.question,
          fullAnswer,
          prepared.contextSnapshot,
        );
        await recordQAMastery(
          db,
          user.id,
          body.planId,
          prepared.dayContext.dayTitle,
          prepared.targetMinutes,
        );
        return qaId;
      },
      c.req.raw.signal,
    );

    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof QAContextError) {
      return c.json({ error: error.message }, error.status as 404 | 412);
    }
    const message = error instanceof Error ? error.message : "未知错误";
    return c.json({ error: message }, 500);
  }
});

const ttsInputSchema = z.object({
  text: z.string().min(1).max(500),
});

/** 单句 TTS：前端流水线按句请求，停止后不再消耗后续字符 */
app.post("/api/tts/speak", async (c) => {
  const user = await getUserFromRequest(c.req.raw);
  if (!user) {
    return c.json({ error: "请先登录" }, 401);
  }

  let body: z.infer<typeof ttsInputSchema>;
  try {
    body = ttsInputSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "单句文本无效或超过 500 字" }, 400);
  }

  try {
    const audio = await synthesizeSentence(body.text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "语音合成失败";
    return c.json({ error: message }, 500);
  }
});

// 生产环境静态文件服务
if (env.isProduction) {
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);
}

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
