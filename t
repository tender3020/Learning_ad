[33mtag v1.0.2[m
Tagger: tender3020 <“tender_cys@163.com”>
Date:   Thu Aug 20 01:57:36 2026 +0800

生成大纲优化。根据逻辑性

[33mcommit b071ae23b0abef8ae6519d7613172951b8a88bb2[m[33m ([m[1;36mHEAD -> [m[1;32mmain[m[33m, [m[1;33mtag: v1.0.2[m[33m)[m
Author: tender3020 <“tender_cys@163.com”>
Date:   Thu Aug 20 01:55:19 2026 +0800

    生成大纲优化，更具逻辑性

[1mdiff --git a/README.md b/README.md[m
[1mindex 8cbf78c..8382fe2 100644[m
[1m--- a/README.md[m
[1m+++ b/README.md[m
[36m@@ -7,6 +7,8 @@[m
 弈智是一个全栈 AI 驱动的学习平台，通过 DeepSeek 大模型实现智能课程生成、流式授课、交互式答题和掌握度追踪。系统内置 **7 类学习引擎**，根据学习目标自动选择内容模板；支持万相 AI 插画与 Mermaid 图表混合配图、TTS 朗读、阅读模式与按天隔离的 AI 问答。[m
 [m
 > **功能需求链路文档**：[docs/functional-requirements.md](docs/functional-requirements.md) — 按用户旅程与系统模块整理的完整实现链路（页面、API、数据流、配图与掌握度等）。[m
[32m+[m[32m>[m
[32m+[m[32m> **架构通读与评估**：[docs/architecture-review.md](docs/architecture-review.md) — UI、后端、数据库、性能与架构债的完整评估报告。[m
 [m
 ## 核心功能[m
 [m
[36m@@ -249,6 +251,15 @@[m [mnpm run build[m
 npm start              # NODE_ENV=production，默认 PORT=3000[m
 ```[m
 [m
[32m+[m[32m**切勿在生产环境长期运行 `npm run dev`。** 开发模式会启用 Vite HMR，对外暴露时任意无效路径（如扫描器探测的 `/.aws/config`）都可能触发读盘错误 overlay。生产进程应为 `node dist/boot.js`，可用以下命令确认：[m
[32m+[m
[32m+[m[32m```bash[m
[32m+[m[32m# Linux：应看到 node dist/boot.js，不应有 vite 进程[m
[32m+[m[32mps aux | grep -E 'node dist/boot|vite'[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32m若当前误用 dev 模式对外，改为 `npm run build && npm start` 后重启服务即可消除此类 overlay。[m
[32m+[m
 ### 代码检查[m
 [m
 ```bash[m
[1mdiff --git a/api/learning-router.ts b/api/learning-router.ts[m
[1mindex 1626c78..2e7a8f8 100644[m
[1m--- a/api/learning-router.ts[m
[1m+++ b/api/learning-router.ts[m
[36m@@ -152,6 +152,11 @@[m [mexport const learningRouter = createRouter({[m
             goal: z.string().optional(),[m
             keywords: z.string().optional(),[m
             estimatedMinutes: z.number().optional(),[m
[32m+[m[32m            phaseName: z.string().optional(),[m
[32m+[m[32m            phaseOrder: z.number().optional(),[m
[32m+[m[32m            difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),[m
[32m+[m[32m            prerequisites: z.string().optional(),[m
[32m+[m[32m            learningObjective: z.string().optional(),[m
           })[m
         ),[m
       })[m
[36m@@ -191,6 +196,11 @@[m [mexport const learningRouter = createRouter({[m
             goal: item.goal || null,[m
             keywords: item.keywords || null,[m
             estimatedMinutes: item.estimatedMinutes || 30,[m
[32m+[m[32m            phaseName: item.phaseName || null,[m
[32m+[m[32m            phaseOrder: item.phaseOrder ?? null,[m
[32m+[m[32m            difficulty: item.difficulty || null,[m
[32m+[m[32m            prerequisites: item.prerequisites || null,[m
[32m+[m[32m            learningObjective: item.learningObjective || null,[m
           }))[m
         );[m
       }[m
[1mdiff --git a/api/lib/env.ts b/api/lib/env.ts[m
[1mindex 0cab113..e2b48ba 100644[m
[1m--- a/api/lib/env.ts[m
[1m+++ b/api/lib/env.ts[m
[36m@@ -13,7 +13,7 @@[m [mexport const env = {[m
   databaseUrl: required("DATABASE_URL"),[m
   deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",[m
   deepseekApiBase: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",[m
[31m-  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",[m
[32m+[m[32m  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",[m
   jwtSecret: process.env.JWT_SECRET ?? "yizhi_default_secret",[m
   // 火山引擎 TTS（新版控制台用 API Key，旧版用 AppId + AccessKey）[m
   volcengineTtsApiKey: process.env.VOLCENGINE_TTS_API_KEY ?? "",[m
[1mdiff --git a/api/services/aiService.ts b/api/services/aiService.ts[m
[1mindex 70d83c5..51a1a6c 100644[m
[1m--- a/api/services/aiService.ts[m
[1m+++ b/api/services/aiService.ts[m
[36m@@ -3,18 +3,14 @@[m [mimport {[m
   getTypeDetectionPrompt,[m
   parseTypeFromAIResponse,[m
   getTypeSystemPrompt,[m
[31m-  getTypeOutlinePrompt,[m
   getTypeAssessmentPrompt,[m
 } from "@shared/typeEngine";[m
[32m+[m[32mimport { allocatePhases, type AllocatedPhase } from "@shared/outlinePhases";[m
[32m+[m[32mimport { validateOutline } from "@shared/outlineValidation";[m
[32m+[m[32mimport type { OutlineItem } from "@shared/outlineTypes";[m
 import { chatCompletion } from "../lib/deepseek";[m
 [m
[31m-export type OutlineItem = {[m
[31m-  dayNumber: number;[m
[31m-  title: string;[m
[31m-  goal: string;[m
[31m-  keywords: string;[m
[31m-  estimatedMinutes: number;[m
[31m-};[m
[32m+[m[32mexport type { OutlineItem } from "@shared/outlineTypes";[m
 [m
 export type AssessmentQuestion = {[m
   questionIndex: number;[m
[36m@@ -66,96 +62,222 @@[m [mexport async function generateOutline([m
   learningType: LearningType = "abstract_logic",[m
   skillLevel: string = "l1",[m
 ): Promise<OutlineItem[]> {[m
[31m-  const systemPrompt = getTypeOutlinePrompt(learningType, goal, totalDays, skillLevel);[m
[32m+[m[32m  const phases = allocatePhases(learningType, totalDays);[m
[32m+[m[32m  let outline = await expandAllPhasesSequential(goal, learningType, skillLevel, phases);[m
[32m+[m
[32m+[m[32m  let validation = validateOutline(outline, totalDays);[m
[32m+[m[32m  if (!validation.valid) {[m
[32m+[m[32m    console.warn("[generateOutline] 校验未通过，重试:", validation.errors.join("; "));[m
[32m+[m[32m    outline = await expandAllPhasesSequential(goal, learningType, skillLevel, phases, 0.35);[m
[32m+[m[32m    validation = validateOutline(outline, totalDays);[m
[32m+[m[32m    if (!validation.valid) {[m
[32m+[m[32m      console.warn("[generateOutline] 重试后仍有问题:", validation.errors.join("; "));[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  if (outline.length === 0) {[m
[32m+[m[32m    throw new Error("大纲生成失败：AI 未返回有效数据，请重试");[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  return outline.slice(0, totalDays);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32masync function expandAllPhasesSequential([m
[32m+[m[32m  goal: string,[m
[32m+[m[32m  learningType: LearningType,[m
[32m+[m[32m  skillLevel: string,[m
[32m+[m[32m  phases: AllocatedPhase[],[m
[32m+[m[32m  temperature = 0.4,[m
[32m+[m[32m): Promise<OutlineItem[]> {[m
[32m+[m[32m  const phaseResults: OutlineItem[][] = [];[m
[32m+[m[32m  let prevLastTitle: string | undefined;[m
[32m+[m
[32m+[m[32m  for (const phase of phases) {[m
[32m+[m[32m    const items = await expandPhaseOutline([m
[32m+[m[32m      goal,[m
[32m+[m[32m      learningType,[m
[32m+[m[32m      skillLevel,[m
[32m+[m[32m      phase,[m
[32m+[m[32m      prevLastTitle,[m
[32m+[m[32m      temperature,[m
[32m+[m[32m    );[m
[32m+[m[32m    phaseResults.push(items);[m
[32m+[m[32m    if (items.length > 0) prevLastTitle = items[items.length - 1]?.title;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  return mergePhaseOutlines(phases, phaseResults, phases.reduce((s, p) => s + p.dayCount, 0));[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction mergePhaseOutlines([m
[32m+[m[32m  phases: AllocatedPhase[],[m
[32m+[m[32m  phaseResults: OutlineItem[][],[m
[32m+[m[32m  totalDays: number,[m
[32m+[m[32m): OutlineItem[] {[m
[32m+[m[32m  const flat = phaseResults.flat();[m
[32m+[m[32m  const byDay = new Map<number, OutlineItem>();[m
[32m+[m[32m  for (const item of flat) {[m
[32m+[m[32m    byDay.set(item.dayNumber, item);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const merged: OutlineItem[] = [];[m
[32m+[m[32m  for (let day = 1; day <= totalDays; day++) {[m
[32m+[m[32m    const existing = byDay.get(day);[m
[32m+[m[32m    const phase = phases.find((p) => day >= p.startDay && day <= p.endDay);[m
[32m+[m[32m    if (existing) {[m
[32m+[m[32m      merged.push({[m
[32m+[m[32m        ...existing,[m
[32m+[m[32m        phaseName: existing.phaseName ?? phase?.name,[m
[32m+[m[32m        phaseOrder: existing.phaseOrder ?? phase?.order,[m
[32m+[m[32m        difficulty: existing.difficulty ?? phase?.difficulty,[m
[32m+[m[32m      });[m
[32m+[m[32m    } else if (phase) {[m
[32m+[m[32m      merged.push({[m
[32m+[m[32m        dayNumber: day,[m
[32m+[m[32m        title: `${phase.name}：${phase.topicHints[0]}`,[m
[32m+[m[32m        goal: phase.goal,[m
[32m+[m[32m        keywords: phase.topicHints.join(", "),[m
[32m+[m[32m        estimatedMinutes: 30,[m
[32m+[m[32m        phaseName: phase.name,[m
[32m+[m[32m        phaseOrder: phase.order,[m
[32m+[m[32m        difficulty: phase.difficulty,[m
[32m+[m[32m        learningObjective: phase.goal,[m
[32m+[m[32m        prerequisites: day > 1 ? String(day - 1) : undefined,[m
[32m+[m[32m      });[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m[32m  return merged;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32masync function expandPhaseOutline([m
[32m+[m[32m  goal: string,[m
[32m+[m[32m  learningType: LearningType,[m
[32m+[m[32m  skillLevel: string,[m
[32m+[m[32m  phase: AllocatedPhase,[m
[32m+[m[32m  prevPhaseLastTitle?: string,[m
[32m+[m[32m  temperature = 0.4,[m
[32m+[m[32m): Promise<OutlineItem[]> {[m
[32m+[m[32m  const prevHint = prevPhaseLastTitle[m
[32m+[m[32m    ? `\n上一阶段最后一天主题：「${prevPhaseLastTitle}」。本阶段第 ${phase.startDay} 天应在此基础上递进，不要重复相同主题。`[m
[32m+[m[32m    : "";[m
[32m+[m[32m  const dayRange =[m
[32m+[m[32m    phase.dayCount === 1[m
[32m+[m[32m      ? `第 ${phase.startDay} 天（仅 1 天）`[m
[32m+[m[32m      : `第 ${phase.startDay} 至 ${phase.endDay} 天（共 ${phase.dayCount} 天）`;[m
 [m
   const response = await chatCompletion({[m
     messages: [[m
       {[m
         role: "system",[m
[31m-        content: `${systemPrompt}[m
[31m-[m
[31m-【极其重要】请严格按以下 JSON 格式返回，只返回 JSON 数组，不要 markdown 代码块，不要任何其他文字：[m
[31m-[[m
[31m-  {"dayNumber": 1, "title": "具体学习主题A", "goal": "当天学习目标", "keywords": "关键词1, 关键词2", "estimatedMinutes": 30},[m
[31m-  {"dayNumber": 2, "title": "具体学习主题B", "goal": "当天学习目标", "keywords": "关键词3, 关键词4", "estimatedMinutes": 35}[m
[31m-][m
[31m-[m
[31m-【严格要求 - 必须遵守】[m
[31m-1. 每天的 title 必须是**不同的**具体主题，绝对不能重复或相似[m
[31m-2. title 禁止写成笼统的目标本身（如目标是"学英语"，标题不能是"学习英语""继续学英语"，必须是"机场问路对话""过去时态用法"等具体主题）[m
[31m-3. 相邻两天的主题要有明显差异，不要只是换了个编号[m
[31m-4. 大纲要循序渐进，难度与学习者的等级匹配[m
[31m-5. estimatedMinutes 在 20-60 之间[m
[31m-6. 必须返回完整的 ${totalDays} 天大纲，不能省略[m
[31m-[m
[31m-【错误示例】（这些标题是错误的，不要输出）[m
[31m-- "学习英语第1天" / "学习英语第2天" — 太笼统[m
[31m-- "基础词汇" / "基础词汇2" — 重复[m
[31m-- "继续学习" / "深入学习" — 不具体[m
[31m-[m
[31m-【正确示例】（目标="学英语"时）[m
[31m-- D1: "机场入境与海关对话"[m
[31m-- D2: "酒店入住与问路表达"[m
[31m-- D3: "餐厅点餐与食物词汇"`,[m
[32m+[m[32m        content: `你是课程大纲设计专家。为学习目标「${goal}」展开一个学习阶段的大纲。[m
[32m+[m[32m学习类型：${learningType}，学习者水平：${skillLevel}。[m
[32m+[m
[32m+[m[32m【输出格式】只返回 JSON 数组，不要 markdown 代码块：[m
[32m+[m[32m[{"dayNumber": ${phase.startDay}, "title": "具体主题", "goal": "当日目标", "keywords": "词1, 词2", "estimatedMinutes": 30, "learningObjective": "可测量的当日目标", "prerequisites": "前置天编号", "phaseName": "${phase.name}", "phaseOrder": ${phase.order}, "difficulty": "${phase.difficulty}"}][m
[32m+[m
[32m+[m[32m【要求】[m
[32m+[m[32m1. 必须输出恰好 ${phase.dayCount} 条，dayNumber 从 ${phase.startDay} 到 ${phase.endDay}[m
[32m+[m[32m2. title 必须具体唯一，禁止「第N天学习」「继续学习」等笼统标题[m
[32m+[m[32m3. 相邻天主题递进，同一阶段内由浅入深[m
[32m+[m[32m4. prerequisites 填写前置 dayNumber（逗号分隔）或前置知识点短语`,[m
       },[m
       {[m
         role: "user",[m
[31m-        content: `请为「${goal}」制定一个 ${totalDays} 天的学习大纲。学习类型：${learningType}，水平：${skillLevel}`,[m
[32m+[m[32m        content: `阶段「${phase.name}」(${dayRange})[m
[32m+[m[32m阶段目标：${phase.goal}[m
[32m+[m[32m建议子主题方向：${phase.topicHints.join("、")}${prevHint}[m
[32m+[m
[32m+[m[32m请生成该阶段 ${phase.dayCount} 天的完整大纲 JSON。`,[m
       },[m
     ],[m
[31m-    temperature: 0.5,[m
[31m-    max_tokens: 8192,[m
[32m+[m[32m    temperature,[m
[32m+[m[32m    max_tokens: Math.min(8192, 400 + phase.dayCount * 280),[m
   });[m
 [m
   if (!response.ok) {[m
[31m-    const errorData = (await response.json().catch(() => ({}))) as {[m
[31m-      error?: { message?: string };[m
[31m-    };[m
[31m-    throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);[m
[32m+[m[32m    return buildFallbackPhaseOutline(goal, phase);[m
   }[m
 [m
   const data = (await response.json()) as {[m
     choices?: Array<{ message?: { content?: string } }>;[m
   };[m
   const content = data.choices?.[0]?.message?.content || "";[m
[32m+[m[32m  const parsed = parseOutlineJson(content);[m
[32m+[m
[32m+[m[32m  if (parsed.length >= phase.dayCount) {[m
[32m+[m[32m    return parsed[m
[32m+[m[32m      .filter((item) => item.dayNumber >= phase.startDay && item.dayNumber <= phase.endDay)[m
[32m+[m[32m      .slice(0, phase.dayCount)[m
[32m+[m[32m      .map((item) => normalizeOutlineItem(item, phase));[m
[32m+[m[32m  }[m
 [m
[32m+[m[32m  return buildFallbackPhaseOutline(goal, phase);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction parseOutlineJson(content: string): OutlineItem[] {[m
   try {[m
     let jsonStr = content.trim();[m
[31m-    if (!jsonStr) throw new Error("AI 返回内容为空");[m
[31m-[m
[32m+[m[32m    if (!jsonStr) return [];[m
     jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();[m
[31m-    jsonStr = jsonStr.replace(/^\s*"outline"\s*:\s*/, "").trim();[m
[31m-[m
     const lastArrayEnd = jsonStr.lastIndexOf("]");[m
[31m-    const lastObjectEnd = jsonStr.lastIndexOf("}");[m
     if (lastArrayEnd > 0 && jsonStr.startsWith("[")) {[m
       jsonStr = jsonStr.slice(0, lastArrayEnd + 1);[m
[31m-    } else if (lastObjectEnd > 0 && jsonStr.startsWith("{")) {[m
[31m-      jsonStr = jsonStr.slice(0, lastObjectEnd + 1);[m
     }[m
[31m-[m
     const parsed = JSON.parse(jsonStr);[m
     const outline = Array.isArray(parsed) ? parsed : parsed.outline;[m
[31m-[m
[31m-    if (Array.isArray(outline) && outline.length > 0) {[m
[31m-      return outline.slice(0, totalDays).map((item: Record<string, unknown>, index: number) => ({[m
[31m-        dayNumber: (item.dayNumber as number) || index + 1,[m
[31m-        title: (item.title as string) || `第 ${index + 1} 天`,[m
[31m-        goal: (item.goal as string) || "学习目标",[m
[31m-        keywords: (item.keywords as string) || "",[m
[31m-        estimatedMinutes: (item.estimatedMinutes as number) || 30,[m
[31m-      }));[m
[31m-    }[m
[31m-    throw new Error(`大纲解析为空，原始内容: ${content.slice(0, 200)}`);[m
[31m-  } catch (e: unknown) {[m
[31m-    const message = e instanceof Error ? e.message : String(e);[m
[31m-    console.warn("[generateOutline] JSON 解析失败，尝试文本解析:", message);[m
[32m+[m[32m    if (!Array.isArray(outline)) return [];[m
[32m+[m[32m    return outline.map((item: Record<string, unknown>, index: number) => ({[m
[32m+[m[32m      dayNumber: (item.dayNumber as number) || index + 1,[m
[32m+[m[32m      title: String(item.title || ""),[m
[32m+[m[32m      goal: String(item.goal || item.learningObjective || ""),[m
[32m+[m[32m      keywords: String(item.keywords || ""),[m
[32m+[m[32m      estimatedMinutes: (item.estimatedMinutes as number) || 30,[m
[32m+[m[32m      phaseName: item.phaseName as string | undefined,[m
[32m+[m[32m      phaseOrder: item.phaseOrder as number | undefined,[m
[32m+[m[32m      difficulty: item.difficulty as OutlineItem["difficulty"],[m
[32m+[m[32m      prerequisites: item.prerequisites as string | undefined,[m
[32m+[m[32m      learningObjective: String(item.learningObjective || item.goal || ""),[m
[32m+[m[32m    }));[m
[32m+[m[32m  } catch {[m
[32m+[m[32m    return [];[m
   }[m
[32m+[m[32m}[m
 [m
[31m-  const fallback = parseOutlineFromText(content, totalDays, goal);[m
[31m-  if (fallback.length > 0) return fallback;[m
[32m+[m[32mfunction normalizeOutlineItem(item: OutlineItem, phase: AllocatedPhase): OutlineItem {[m
[32m+[m[32m  return {[m
[32m+[m[32m    dayNumber: item.dayNumber,[m
[32m+[m[32m    title: item.title || `第 ${item.dayNumber} 天`,[m
[32m+[m[32m    goal: item.goal || phase.goal,[m
[32m+[m[32m    keywords: item.keywords || phase.topicHints.slice(0, 3).join(", "),[m
[32m+[m[32m    estimatedMinutes: item.estimatedMinutes || 30,[m
[32m+[m[32m    phaseName: item.phaseName || phase.name,[m
[32m+[m[32m    phaseOrder: item.phaseOrder ?? phase.order,[m
[32m+[m[32m    difficulty: item.difficulty || phase.difficulty,[m
[32m+[m[32m    prerequisites:[m
[32m+[m[32m      item.prerequisites ||[m
[32m+[m[32m      (item.dayNumber > phase.startDay ? String(item.dayNumber - 1) : undefined),[m
[32m+[m[32m    learningObjective: item.learningObjective || item.goal || phase.goal,[m
[32m+[m[32m  };[m
[32m+[m[32m}[m
 [m
[31m-  throw new Error("大纲生成失败：AI 未返回有效数据，请重试");[m
[32m+[m[32mfunction buildFallbackPhaseOutline(goal: string, phase: AllocatedPhase): OutlineItem[] {[m
[32m+[m[32m  const items: OutlineItem[] = [];[m
[32m+[m[32m  for (let d = phase.startDay; d <= phase.endDay; d++) {[m
[32m+[m[32m    const idx = d - phase.startDay;[m
[32m+[m[32m    const topic = phase.topicHints[idx % phase.topicHints.length];[m
[32m+[m[32m    items.push({[m
[32m+[m[32m      dayNumber: d,[m
[32m+[m[32m      title: `${topic}`,[m
[32m+[m[32m      goal: `${goal} — ${phase.goal}`,[m
[32m+[m[32m      keywords: phase.topicHints.join(", "),[m
[32m+[m[32m      estimatedMinutes: 30,[m
[32m+[m[32m      phaseName: phase.name,[m
[32m+[m[32m      phaseOrder: phase.order,[m
[32m+[m[32m      difficulty: phase.difficulty,[m
[32m+[m[32m      prerequisites: d > 1 ? String(d - 1) : undefined,[m
[32m+[m[32m      learningObjective: `掌握${topic}相关要点`,[m
[32m+[m[32m    });[m
[32m+[m[32m  }[m
[32m+[m[32m  return items;[m
 }[m
 [m
 export async function generateAssessmentQuestions([m
[36m@@ -355,51 +477,6 @@[m [mexport async function streamContent([m
   );[m
 }[m
 [m
[31m-function parseOutlineFromText([m
[31m-  text: string,[m
[31m-  totalDays: number,[m
[31m-  fallbackGoal: string,[m
[31m-): Outli