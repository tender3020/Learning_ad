import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getUserFromRequest } from "./lib/request-auth";
import { streamContent } from "./services/aiService";
import { synthesizeSpeech, streamSpeechSegments } from "./lib/volcengine-tts";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

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

const ttsInputSchema = z.object({
  text: z.string().min(1).max(8000),
});

app.post("/api/tts/speak", async (c) => {
  const user = await getUserFromRequest(c.req.raw);
  if (!user) {
    return c.json({ error: "请先登录" }, 401);
  }

  let body: z.infer<typeof ttsInputSchema>;
  try {
    body = ttsInputSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "请求参数无效" }, 400);
  }

  try {
    const audio = await synthesizeSpeech(body.text);
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

app.post("/api/tts/stream", async (c) => {
  const user = await getUserFromRequest(c.req.raw);
  if (!user) {
    return c.json({ error: "请先登录" }, 401);
  }

  let body: z.infer<typeof ttsInputSchema>;
  try {
    body = ttsInputSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "请求参数无效" }, 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const segment of streamSpeechSegments(body.text)) {
          if (c.req.raw.signal.aborted) break;

          const payload = JSON.stringify({
            index: segment.index,
            total: segment.total,
            audio: segment.audio.toString("base64"),
          });
          controller.enqueue(
            encoder.encode(`event: segment\ndata: ${payload}\n\n`),
          );
        }
        if (!c.req.raw.signal.aborted) {
          controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "语音合成失败";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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
