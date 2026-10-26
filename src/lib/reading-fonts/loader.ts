import {
  ROMAN_FONT,
  getReadingFont,
  type ReadingFontId,
} from "./catalog";

const CACHE_NAME = "yizhi-reading-fonts-v1";
const loaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function needsWebFont(id: ReadingFontId) {
  if (id === "system") return false;
  const spec = getReadingFont(id);
  return spec.useRoman || Boolean(spec.urls?.length || spec.stylesheet);
}

function isLocalFont(family: string, sample: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.font = `72px "${family}", monospace`;
  const withNamed = ctx.measureText(sample).width;
  ctx.font = "72px monospace";
  const fallback = ctx.measureText(sample).width;
  return Math.abs(withNamed - fallback) > 0.75;
}

function hasAnyLocalFont(families: readonly string[], sample: string) {
  return families.some((name) => isLocalFont(name, sample));
}

async function fetchFontBuffer(urls: readonly string[]): Promise<ArrayBuffer> {
  if ("caches" in window) {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urls) {
      const hit = await cache.match(url);
      if (hit) return hit.arrayBuffer();
    }
  }

  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const copy = res.clone();
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 1024) continue;
      if ("caches" in window) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, copy);
      }
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("字体下载失败");
}

function injectStylesheet(href: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-yizhi-font="${href}"]`);
  if (existing) {
    return existing.dataset.loaded === "1"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("字体样式加载失败")), { once: true });
        });
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.yizhiFont = href;
    link.onload = () => {
      link.dataset.loaded = "1";
      resolve();
    };
    link.onerror = () => reject(new Error("字体样式加载失败"));
    document.head.appendChild(link);
  });
}

async function registerFace(family: string, urls: readonly string[]) {
  const buffer = await fetchFontBuffer(urls);
  const face = new FontFace(family, buffer, { display: "swap", weight: "400" });
  document.fonts.add(await face.load());
}

async function once(key: string, run: () => Promise<void>) {
  if (loaded.has(key)) return;
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = run().then(() => {
    loaded.add(key);
  });
  inflight.set(key, task);
  try {
    await task;
  } finally {
    inflight.delete(key);
  }
}

async function ensureRoman() {
  if (hasAnyLocalFont(ROMAN_FONT.systemFamilies, "AgWw12mmlli")) {
    loaded.add("roman");
    return;
  }
  await once("roman", () => registerFace(ROMAN_FONT.family, ROMAN_FONT.urls));
}

export async function ensureReadingFont(id: ReadingFontId) {
  if (id === "system") return;
  const spec = getReadingFont(id);
  if (spec.useRoman) await ensureRoman();
  if (loaded.has(id)) return;
  if (spec.systemFamilies.length && hasAnyLocalFont(spec.systemFamilies, "汉字楷体宋体MmWw12")) {
    loaded.add(id);
    return;
  }
  if (!spec.urls?.length && !spec.stylesheet) {
    loaded.add(id);
    return;
  }

  await once(id, async () => {
    if (spec.webFamily && spec.urls?.length) {
      try {
        await registerFace(spec.webFamily, spec.urls);
        return;
      } catch {
        /* 本地 woff2 没有时走 stylesheet / 抛给调用方 */
      }
    }
    if (spec.stylesheet) {
      await injectStylesheet(spec.stylesheet);
      await document.fonts.ready;
      return;
    }
    throw new Error("字体下载失败");
  });
}
