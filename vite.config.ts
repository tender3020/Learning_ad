import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

/** 拦截常见扫描路径，避免 Vite 读盘 ENOENT 触发 HMR overlay */
function blockSensitivePaths(): Plugin {
  const blockedPrefixes = ["/.aws/", "/.git/", "/wp-admin/"];
  const blockedExact = ["/.env", "/.aws/config", "/.aws/credentials"];

  return {
    name: "block-sensitive-paths",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (
          blockedExact.includes(url) ||
          blockedPrefixes.some((prefix) => url.startsWith(prefix)) ||
          url.startsWith("/.env.")
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    blockSensitivePaths(),
    devServer({
      entry: "api/boot.ts",
      // /api/* 与 /uploads/* 走 Hono（配图静态文件在 data/uploads）
      exclude: [/^\/(?!api\/|uploads\/).*$/],
    }),
    inspectAttr(), react()],
  server: {
    port: 3000,
    // 仅开发模式：通过反向代理访问时使用；生产请用 npm run build && npm start
    allowedHosts: [
      'www.longxuexi.xyz',
      'longxuexi.xyz'  // 建议两个都加上
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
