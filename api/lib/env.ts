import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekApiBase: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  jwtSecret: process.env.JWT_SECRET ?? "yizhi_default_secret",
  // 火山引擎 TTS（新版控制台用 API Key，旧版用 AppId + AccessKey）
  volcengineTtsApiKey: process.env.VOLCENGINE_TTS_API_KEY ?? "",
  volcengineTtsAppId: process.env.VOLCENGINE_TTS_APP_ID ?? "",
  volcengineTtsAccessKey: process.env.VOLCENGINE_TTS_ACCESS_KEY ?? "",
  volcengineTtsResourceId: process.env.VOLCENGINE_TTS_RESOURCE_ID ?? "seed-tts-2.0",
  volcengineTtsSpeaker:
    process.env.VOLCENGINE_TTS_SPEAKER ?? "zh_female_shuangkuaisisi_moon_bigtts",
  volcengineTtsFormat: process.env.VOLCENGINE_TTS_FORMAT ?? "mp3",
  volcengineTtsSampleRate: parseInt(process.env.VOLCENGINE_TTS_SAMPLE_RATE ?? "24000", 10),
};
