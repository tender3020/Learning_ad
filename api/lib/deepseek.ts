import { env } from "./env";

type ChatCompletionBody = Record<string, unknown> & {
  model?: string;
  messages: Array<{ role: string; content: string }>;
};

export async function chatCompletion(
  body: ChatCompletionBody,
  init?: Pick<RequestInit, "signal">,
): Promise<Response> {
  if (!env.deepseekApiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置，请在 .env 中设置");
  }

  const { model, ...rest } = body;

  return fetch(`${env.deepseekApiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: model ?? env.deepseekModel,
      // deepseek-v4 系列默认开启推理，reasoning 会消耗 max_tokens 且不进入正文，
      // 导致流式长时间无输出、JSON 被截断。默认关闭，调用方可显式覆盖。
      thinking: { type: "disabled" },
      ...rest,
    }),
    signal: init?.signal,
  });
}
