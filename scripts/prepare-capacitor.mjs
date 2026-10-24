import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadServerUrl() {
  const envPath = path.join(root, ".env.capacitor");
  if (fs.existsSync(envPath)) {
    const line = fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("CAPACITOR_SERVER_URL=") && !l.startsWith("#"));
    if (line) {
      const value = line.slice("CAPACITOR_SERVER_URL=".length).trim();
      if (value) return value;
    }
  }
  return process.env.CAPACITOR_SERVER_URL?.trim() || "http://YOUR_SERVER_IP";
}

const serverUrl = loadServerUrl();
const usesHttp = serverUrl.startsWith("http://");

const config = {
  appId: "com.yizhi.learning",
  appName: "弈智",
  webDir: "mobile/shell",
  server: {
    url: serverUrl,
    cleartext: usesHttp,
    androidScheme: usesHttp ? "http" : "https",
  },
  android: {
    allowMixedContent: true,
  },
};

fs.writeFileSync(path.join(root, "capacitor.config.json"), `${JSON.stringify(config, null, 2)}\n`);
console.log(`✅ capacitor.config.json → server.url = ${serverUrl}`);
