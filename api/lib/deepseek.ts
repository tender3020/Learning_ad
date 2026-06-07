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
      ...rest,
    }),
    signal: init?.signal,
  });
}
