# 弈智生产部署（Nginx 反向代理 + systemd）

本目录提供将 **Nginx 反代到 Node `:3000`** 的推荐配置。Node（`dist/boot.js`）同时负责 SPA 静态资源、tRPC、SSE（AI/问答）、TTS 与 `/uploads`。

> 不要用「Nginx 直接读 `/usr/share/nginx/html`」那套 `try_files` 当主站——会绕过 API 与 SSE。

## 架构

```
浏览器 → Nginx :80/:443 → Node 127.0.0.1:3000
                              ├─ /api/trpc/*
                              ├─ /api/ai/stream（SSE）
                              ├─ /api/ai/qa/stream（SSE）
                              ├─ /api/tts/speak
                              ├─ /uploads/*
                              └─ dist/public（SPA）
```

## 文件说明

| 文件 | 用途 |
|------|------|
| [nginx.conf](nginx.conf) | 主配置示例：gzip、open_file_cache、`$connection_upgrade` map |
| [conf.d/yizhi.conf](conf.d/yizhi.conf) | 站点 server：反代、SSE、静态强缓存、安全头 |
| [yizhi.service](yizhi.service) | systemd 单元，常驻 `node dist/boot.js` |

## 1. 准备 Node 应用

```bash
# 假设代码在 /opt/yizhi/app
cd /opt/yizhi/app
npm ci
npm run build

# 确认 .env 已配置 DATABASE_URL、JWT_SECRET、各 API Key 等
# NODE_ENV=production PORT=3000
```

建议独立系统用户：

```bash
sudo useradd -r -s /usr/sbin/nologin yizhi
sudo chown -R yizhi:yizhi /opt/yizhi/app
```

## 2. 安装 systemd

```bash
# 按实际路径编辑 WorkingDirectory / EnvironmentFile
sudo cp deploy/yizhi.service /etc/systemd/system/yizhi.service
sudo nano /etc/systemd/system/yizhi.service

sudo systemctl daemon-reload
sudo systemctl enable --now yizhi
sudo systemctl status yizhi
```

本地冒烟：

```bash
curl -sI http://127.0.0.1:3000/ | head -n 5
# 应看到 HTTP/1.1 200（或 304）
```

## 3. 安装 Nginx

```bash
# 主配置：确保 http {} 内有 map $http_upgrade（见 deploy/nginx.conf）
# 然后只装站点片段即可：
sudo cp deploy/conf.d/yizhi.conf /etc/nginx/conf.d/yizhi.conf

# 若旧 default server 抢 80，先禁用：
# sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

sudo nginx -t
sudo systemctl reload nginx
```

**注意：** 主配置 `http {}` 里必须有：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

否则 `yizhi.conf` 里的 `$connection_upgrade` 会报错。

## 4. 验证

```bash
sudo nginx -t

# 未登录时 401 也说明反代到了 Node API
curl -sI http://www.longxuexi.xyz/api/trpc/learning.getPlans

# 首页应返回 HTML
curl -sI http://www.longxuexi.xyz/

# SSE：在浏览器 DevTools → Network 触发「生成今日课程」
# 确认 Content-Type: text/event-stream，且响应体逐字增长（未被缓冲）
```

```bash
# Node 进程应为 dist/boot.js，不应长期跑 vite
ps aux | grep -E 'node dist/boot|vite'
journalctl -u yizhi -f
```

## 5. HTTPS（可选）

```bash
sudo dnf install certbot python3-certbot-nginx   # 或 apt install certbot python3-certbot-nginx
sudo certbot --nginx -d www.longxuexi.xyz -d longxuexi.xyz
```

或手动填好 `conf.d/yizhi.conf` 末尾注释掉的 `listen 443` 块，再在 HTTP server 打开 `return 301`。

## 后续优化（可选）

1. **Nginx 直出 `/uploads`**：减少 Node IO（需保证 `alias` 指向 `data/uploads`，并与应用写路径一致）。
2. **`limit_req_zone`**：对 `/api/` 限流防刷。
3. **仅本机可访问 3000**：`firewalld`/`ufw` 只开放 80/443，Node 只监听 `127.0.0.1`。

## 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| AI 生成一整段才出现 | `proxy_buffering` 未关 | 使用本仓库 `yizhi.conf`，确认 `proxy_buffering off` |
| `nginx -t` 报 `$connection_upgrade` unknown | 缺少 map | 把 `deploy/nginx.conf` 中的 map 拷进主配置 |
| 502 Bad Gateway | Node 未起或端口不对 | `systemctl status yizhi`，确认 `PORT=3000` |
| 静态更新不及时 | 强缓存了 `index.html` | 本配置只对扩展名资源 `expires 30d`；HTML 走 `/` 反代，由 Node/浏览器协商 |
