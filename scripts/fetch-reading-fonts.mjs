/**
 * 下载地址与 src/lib/reading-fonts/catalog.ts 保持一致。
 * 加字体时：先改 catalog，再把对应 woff2 补进 FILES。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "fonts");

const FILES = [
  {
    name: "song.woff2",
    url: "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.2.5/files/noto-serif-sc-chinese-simplified-400-normal.woff2",
  },
  {
    name: "hei.woff2",
    url: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
  },
  {
    name: "yuan.woff2",
    url: "https://cdn.jsdelivr.net/npm/@fontsource/zcool-xiaowei@5.2.5/files/zcool-xiaowei-chinese-simplified-400-normal.woff2",
  },
  {
    name: "roman.woff2",
    url: "https://cdn.jsdelivr.net/npm/@fontsource/tinos@5.2.5/files/tinos-latin-400-normal.woff2",
  },
];

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 50_000) {
    console.log(`skip ${path.basename(dest)}`);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`saved ${path.basename(dest)} (${Math.round(buf.length / 1024)} KB)`);
}

fs.mkdirSync(outDir, { recursive: true });
for (const file of FILES) {
  await download(file.url, path.join(outDir, file.name));
}
