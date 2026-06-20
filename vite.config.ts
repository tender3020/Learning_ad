import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({
      entry: "api/boot.ts",
      // /api/* 与 /uploads/* 走 Hono（配图静态文件在 data/uploads）
      exclude: [/^\/(?!api\/|uploads\/).*$/],
    }),
    inspectAttr(), react()],
  server: {
    port: 3000,
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
