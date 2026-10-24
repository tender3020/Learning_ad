import fs from "fs/promises";
import path from "path";

/** 打包后 boot.js 在 dist/，数据目录在仓库根下的 data/ */
export const DATA_ROOT = path.resolve(import.meta.dirname, "../data");
export const UPLOADS_ROOT = path.join(DATA_ROOT, "uploads");
export const AVATAR_DIR = path.join(UPLOADS_ROOT, "avatars");

export async function ensureUploadDirs() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  await fs.mkdir(path.join(UPLOADS_ROOT, "content-images"), { recursive: true });
}

export function isFsPermissionError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}
