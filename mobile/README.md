# 弈智 Android App（Capacitor 套壳）

App 本质是 **全屏 WebView**，打开你服务器上的网站（与手机浏览器访问 IP/域名相同）。  
后端仍跑在服务器，**不需要**把数据库或 API 打进 APK。

## 原理

```
安卓 APK（弈智）
  └─ WebView → http://你的公网IP  （或 https://域名）
        └─ 与浏览器相同的 React 页面 + tRPC + SSE
```

## 环境准备（Windows）

1. **Node.js 20+**（已有）
2. **Android Studio**  
   https://developer.android.com/studio  
   安装时勾选 Android SDK、Android SDK Platform、Android Virtual Device
3. 环境变量（安装后 Android Studio 一般会配好）  
   - `ANDROID_HOME` = `C:\Users\你的用户名\AppData\Local\Android\Sdk`
   - 把 `%ANDROID_HOME%\platform-tools` 加入 PATH（`adb` 命令可用）

## 一次性配置

```bash
cd /path/to/app

# 1. 安装依赖（含 @capacitor/*）
npm install

# 2. 配置服务器地址
cp .env.capacitor.example .env.capacitor
# 编辑 .env.capacitor，例如：
# CAPACITOR_SERVER_URL=http://123.45.67.89

# 3. 若尚未生成 android 工程（仓库里已有可跳过）
npx cap add android

# 4. 同步配置到 Android 工程
npm run cap:sync
```

## 打包 APK

### 方式 A：Android Studio（推荐）

```bash
npm run cap:open
```

在 Android Studio 中：

1. 等待 Gradle 同步完成  
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
3. 完成后点通知里的 **locate**，得到 `app-debug.apk`  
4. 传到手机安装（需允许「未知来源」）

### 方式 B：命令行

```bash
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Windows PowerShell：

```powershell
cd android
.\gradlew.bat assembleDebug
```

## 真机调试

1. 手机开启 **开发者选项 → USB 调试**  
2. USB 连接电脑，`adb devices` 能看到设备  
3. `npm run cap:run` 或 Android Studio 点 Run ▶

## 修改服务器地址后

改 `.env.capacitor` 后必须重新同步并打包：

```bash
npm run cap:sync
# 再重新 Build APK
```

## 服务器侧注意

| 项 | 说明 |
|----|------|
| 防火墙 | 手机用 **移动网络** 访问时，需放行公网 **80/443** |
| HTTP | 用 IP + HTTP 时，Capacitor 已配置 `cleartext: true` |
| HTTPS | 更推荐；自签证书需在 Android 网络安全配置里额外处理 |
| 备案 | 套壳 App 仍访问你的 IP/域名，与浏览器规则相同 |

## 常见问题

**白屏**  
- 检查 `.env.capacitor` 的 URL 手机能否在浏览器打开  
- 不要用 `localhost` / `127.0.0.1`（那是手机本机）

**无法登录 / 接口失败**  
- 确认服务器 Nginx/Node 已启动  
- 手机与服务器网络互通（公网 IP 或同一 WiFi 下的局域网 IP）

**AI 流式不出字**  
- 确认 Nginx 对 `/api/ai/stream` 关闭了 `proxy_buffering`（见 `deploy/conf.d/yizhi.conf`）

## npm 脚本

| 命令 | 作用 |
|------|------|
| `npm run cap:sync` | 把 Capacitor 配置同步到 `android/` |
| `npm run cap:open` | 用 Android Studio 打开工程 |
| `npm run cap:run` | 在已连接设备/模拟器上运行 |
