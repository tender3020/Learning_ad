/**
 * 下载地址与 src/lib/reading-fonts/catalog.ts 保持一致。
 * 加字体时：先改 catalog，再把对应 woff2 补进 FILES。
 *
 * jsDelivr 在国内常超时。已有文件直接跳过；没有则依次试 npmmirror / unpkg / jsDelivr。
 * 全部失败只警告，不阻断 vite build（运行时 catalog 里还有 CDN 兜底）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "fonts");
const MIN_SKIP_BYTES = 8_000;
const FETCH_MS = 20_000;

const FILES = [
  {
    name: "song.woff2",
    npm: "@fontsource/noto-serif-sc@5.2.5/files/noto-serif-sc-chinese-simplified-400-normal.woff2",
  },
  {
    name: "hei.woff2",
    npm: "@fontsource/noto-sans-sc@5.2.5/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
  },
  {
    name: "yuan.woff2",
    npm: "@fontsource/zcool-xiaowei@5.2.5/files/zcool-xiaowei-chinese-simplified-400-normal.woff2",
  },
  {
    name: "roman.woff2",
    npm: "@fontsource/tinos@5.2.5/files/tinos-latin-400-normal.woff2",
  },
  {
    name: "huangyou.woff2",
    npm: "@fontsource/zcool-qingke-huangyou@5.2.5/files/zcool-qingke-huangyou-chinese-simplified-400-normal.woff2",
  },
  {
    name: "kuaile.woff2",
    npm: "@fontsource/zcool-kuaile@5.2.5/files/zcool-kuaile-chinese-simplified-400-normal.woff2",
  },
  {
    name: "mashan.woff2",
    npm: "@fontsource/ma-shan-zheng@5.2.5/files/ma-shan-zheng-chinese-simplified-400-normal.woff2",
  },
  {
    name: "longcang.woff2",
    npm: "@fontsource/long-cang@5.2.5/files/long-cang-chinese-simplified-400-normal.woff2",
  },
];

function mirrors(npmPath) {
  return [
    `https://cdn.jsdmirror.com/npm/${npmPath}`,
    `https://jsd.onmicrosoft.cn/npm/${npmPath}`,
    `https://testingcf.jsdelivr.net/npm/${npmPath}`,
    `https://gcore.jsdelivr.net/npm/${npmPath}`,
    `https://unpkg.com/${npmPath}`,
    `https://cdn.jsdelivr.net/npm/${npmPath}`,
  ];
}

async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_SKIP_BYTES) throw new Error(`too small (${buf.length} B) ${url}`);
  return buf;
}

async function download(file, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size >= MIN_SKIP_BYTES) {
    console.log(`skip ${file.name}`);
    return;
  }

  let lastError;
  for (const url of mirrors(file.npm)) {
    try {
      const buf = await fetchBuffer(url);
      fs.writeFileSync(dest, buf);
      console.log(`saved ${file.name} (${Math.round(buf.length / 1024)} KB) from ${new URL(url).host}`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`retry ${file.name}: ${error.cause?.code || error.message}`);
    }
  }
  console.warn(`warn skip ${file.name}: ${lastError?.cause?.code || lastError?.message || "download failed"}`);
}

fs.mkdirSync(outDir, { recursive: true });
for (const file of FILES) {
  await download(file, path.join(outDir, file.name));
}
