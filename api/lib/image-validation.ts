import fs from "fs/promises";
import { env } from "./env";

/** 用 DashScope 多模态模型校验图片是否体现预期元素 */
export async function validateImageMatch(params: {
  imagePath: string;
  uniqueIdentifiers: string[];
  anchorText: string;
}): Promise<boolean> {
  if (!env.imageValidationEnabled || !env.dashscopeApiKey) {
    return true;
  }

  if (params.uniqueIdentifiers.length === 0) {
    return true;
  }

  let imageBase64: string;
  try {
    const buffer = await fs.readFile(params.imagePath);
    imageBase64 = buffer.toString("base64");
  } catch {
    return true;
  }

  const elements = params.uniqueIdentifiers.join("、");
  const url = `${env.dashscopeApiBase}/services/aigc/multimodal-generation/generation`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.dashscopeApiKey}`,
    },
    body: JSON.stringify({
      model: env.dashscopeVisionModel,
      input: {
        messages: [
          {
            role: "user",
            content: [
              { image: `data:image/png;base64,${imageBase64}` },
              {
                text: `这是一张教育学习配图。对应的学习内容句子是：「${params.anchorText}」。
请判断图片是否体现了以下至少 2 个元素：${elements}
只回答「是」或「否」，不要其他内容。`,
              },
            ],
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    return true;
  }

  const data = (await response.json()) as {
    output?: {
      choices?: Array<{
        message?: { content?: Array<{ text?: string }> | string };
      }>;
    };
  };

  const content = data.output?.choices?.[0]?.message?.content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content.find((c) => c.text)?.text ?? "";
  }

  return text.includes("是") && !text.startsWith("否");
}

/** 校验失败时增强 prompt 重试 */
export function enhancePromptForRetry(
  prompt: string,
  uniqueIdentifiers: string[],
): string {
  const extra = uniqueIdentifiers.slice(0, 4).join("、");
  return `${prompt}。画面必须清晰体现以下元素：${extra}。不要出现任何文字、水印或 logo。`;
}
