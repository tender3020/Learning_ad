import { env } from "./env";

/** 3:2 横向，总像素在万相文生图允许范围内 */
export const WANXIANG_IMAGE_SIZE = "1536*1024";
export const WANXIANG_IMAGE_RATIO = 3 / 2;

type WanxiangContentItem = {
  type?: string;
  image?: string;
  text?: string;
};

type WanxiangResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: WanxiangContentItem[];
      };
    }>;
    finished?: boolean;
  };
  code?: string;
  message?: string;
};

export function isWanxiangConfigured(): boolean {
  return Boolean(env.dashscopeApiKey);
}

export async function generateWanxiangImage(prompt: string): Promise<string> {
  if (!env.dashscopeApiKey) {
    throw new Error("DASHSCOPE_API_KEY 未配置");
  }

  const url = `${env.dashscopeApiBase}/services/aigc/multimodal-generation/generation`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.dashscopeApiKey}`,
    },
    body: JSON.stringify({
      model: env.dashscopeImageModel,
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        size: WANXIANG_IMAGE_SIZE,
        n: 1,
        watermark: false,
        thinking_mode: false,
      },
    }),
  });

  const data = (await response.json()) as WanxiangResponse;

  if (!response.ok) {
    throw new Error(data.message || `万相 API 错误: ${response.status}`);
  }

  const contents = data.output?.choices?.[0]?.message?.content ?? [];
  const imageUrl = contents.find((c) => c.image)?.image;

  if (!imageUrl) {
    throw new Error(data.message || "万相 API 未返回图片");
  }

  return imageUrl;
}
