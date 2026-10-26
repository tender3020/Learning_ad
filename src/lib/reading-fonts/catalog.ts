/**
 * 阅读字体唯一清单。服务器不用安装系统字体。
 *
 * 加一种字体（三步，缺一不可）：
 * 1. 下面追加一项（id / label / webFamily / urls）
 * 2. 把对应 woff2 放到 public/fonts/（或补进 scripts/fetch-reading-fonts.mjs）
 * 3. 本地 npm run build，把整个 dist（含 dist/public/fonts）上传到服务器
 *
 * 只把 woff2 丢进服务器 fonts 目录不会出现新按钮，按钮名单在这份 catalog 里。
 */
type FontSpecBase = {
  label: string;
  generic: "serif" | "sans-serif";
  /** 西文/数字走新罗马 */
  useRoman: boolean;
  /** 本机已有则不再下载 */
  systemFamilies: readonly string[];
  /** FontFace 注册名（下载兜底） */
  webFamily?: string;
  urls?: readonly string[];
  stylesheet?: string;
};

const ROMAN_STACK = ['"Times New Roman"', '"Yizhi Roman"'] as const;

export const READING_FONT_CATALOG = {
  system: {
    label: "系统",
    generic: "sans-serif",
    useRoman: false,
    systemFamilies: [],
  },
  songti: {
    label: "宋体",
    generic: "serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "LXGW Neo ZhiSong CHS",
    stylesheet:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-lxgw-neo-zhi-song-chs-regular-lxgw-neo-zhi-song@1.0.0/font.css",
  },
  heiti: {
    label: "黑体",
    generic: "sans-serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "LXGW Neo XiHei",
    stylesheet: "https://cdn.jsdelivr.net/npm/cn-fontsource-lxgw-neo-xi-hei-regular@1.0.1/font.css",
  },
  zhengkai: {
    label: "正楷",
    generic: "serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "LXGW WenKai Screen",
    stylesheet: "https://cdn.jsdelivr.net/npm/cn-fontsource-lxgw-wen-kai-screen@1.0.6/font.css",
  },
  song: {
    label: "思源宋体",
    generic: "serif",
    useRoman: true,
    systemFamilies: ["SimSun", "宋体", "Songti SC", "STSong", "NSimSun"],
    webFamily: "Yizhi Song",
    urls: [
      "/fonts/song.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.2.5/files/noto-serif-sc-chinese-simplified-400-normal.woff2",
    ],
  },
  hei: {
    label: "思源黑体",
    generic: "sans-serif",
    useRoman: true,
    systemFamilies: ["Microsoft YaHei", "微软雅黑", "PingFang SC", "Heiti SC", "Source Han Sans SC"],
    webFamily: "Yizhi Hei",
    urls: [
      "/fonts/hei.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
    ],
  },
  kai: {
    label: "霞鹜文楷",
    generic: "serif",
    useRoman: true,
    systemFamilies: ["KaiTi", "楷体", "STKaiti", "Kaiti SC", "KaiTi_GB2312"],
    webFamily: "LXGW WenKai Lite",
    urls: ["/fonts/kai.woff2"],
    stylesheet: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.1.0/lxgwwenkailite-regular.css",
  },
  yuan: {
    label: "站酷小薇",
    generic: "sans-serif",
    useRoman: true,
    systemFamilies: ["YouYuan", "幼圆", "STYuanti", "Yuanti SC"],
    webFamily: "Yizhi Yuan",
    urls: [
      "/fonts/yuan.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-xiaowei@5.2.5/files/zcool-xiaowei-chinese-simplified-400-normal.woff2",
    ],
  },
  huangyou: {
    label: "黄油体",
    generic: "sans-serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "Yizhi Huangyou",
    urls: [
      "/fonts/huangyou.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-qingke-huangyou@5.2.5/files/zcool-qingke-huangyou-chinese-simplified-400-normal.woff2",
    ],
  },
  kuaile: {
    label: "快乐体",
    generic: "sans-serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "Yizhi Kuaile",
    urls: [
      "/fonts/kuaile.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-kuaile@5.2.5/files/zcool-kuaile-chinese-simplified-400-normal.woff2",
    ],
  },
  mashan: {
    label: "马善政楷",
    generic: "serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "Yizhi Mashan",
    urls: [
      "/fonts/mashan.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/ma-shan-zheng@5.2.5/files/ma-shan-zheng-chinese-simplified-400-normal.woff2",
    ],
  },
  longcang: {
    label: "龙藏体",
    generic: "serif",
    useRoman: true,
    systemFamilies: [],
    webFamily: "Yizhi Longcang",
    urls: [
      "/fonts/longcang.woff2",
      "https://cdn.jsdelivr.net/npm/@fontsource/long-cang@5.2.5/files/long-cang-chinese-simplified-400-normal.woff2",
    ],
  },
} as const satisfies Record<string, FontSpecBase>;

export type ReadingFontId = keyof typeof READING_FONT_CATALOG;

export type ReadingFontSpec = FontSpecBase & { id: ReadingFontId };

export const ROMAN_FONT = {
  family: "Yizhi Roman",
  systemFamilies: ["Times New Roman", "Times"] as const,
  urls: [
    "/fonts/roman.woff2",
    "https://cdn.jsdelivr.net/npm/@fontsource/tinos@5.2.5/files/tinos-latin-400-normal.woff2",
  ],
};

const SYSTEM_STACK = [
  "system-ui",
  "Roboto",
  '"Noto Sans CJK SC"',
  '"PingFang SC"',
  '"Microsoft YaHei"',
  "sans-serif",
] as const;

export const READING_FONT_IDS = Object.keys(READING_FONT_CATALOG) as ReadingFontId[];

export const READING_FONTS: ReadingFontSpec[] = READING_FONT_IDS.map((id) => ({
  id,
  ...READING_FONT_CATALOG[id],
}));

export const READING_FONT_LABELS = Object.fromEntries(
  READING_FONTS.map((font) => [font.id, font.label]),
) as Record<ReadingFontId, string>;

export function isReadingFontId(value: unknown): value is ReadingFontId {
  return typeof value === "string" && value in READING_FONT_CATALOG;
}

function quoteFamily(name: string) {
  return /[\s\u4e00-\u9fff]/.test(name) ? `"${name}"` : name;
}

export function readingFontStack(id: ReadingFontId): string {
  if (id === "system") return SYSTEM_STACK.join(", ");
  const spec = READING_FONT_CATALOG[id];
  const parts: string[] = [];
  if (spec.useRoman) parts.push(...ROMAN_STACK);
  for (const name of spec.systemFamilies) parts.push(quoteFamily(name));
  if ("webFamily" in spec && spec.webFamily) parts.push(quoteFamily(spec.webFamily));
  parts.push(spec.generic);
  return parts.join(", ");
}

export function getReadingFont(id: ReadingFontId): FontSpecBase {
  return READING_FONT_CATALOG[id];
}
