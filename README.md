# 弈智 AI 学习成长系统

> 基于 DeepSeek AI 的自适应学习平台，为每位学习者量身定制个性化学习路径。

## 项目概览

弈智是一个全栈 AI 驱动的学习平台，通过 DeepSeek 大模型实现智能课程生成、个性化授课、交互式答题和掌握度追踪。系统采用自适应学习算法，根据学习者的答题表现、学习时长和互动频率实时调整内容难度和推荐策略。

## 核心功能

| 模块 | 功能描述 |
|------|----------|
| **AI 学习计划生成** | 输入学习目标，AI 自动生成 N 天的结构化学习大纲 |
| **DeepSeek 流式授课** | AI 实时生成 Markdown 格式的学习内容，含知识讲解和代码示例 |
| **交互式答题系统** | 学习内容中嵌入选择题，答完即时反馈对错和解析 |
| **AI 问答辅导** | 学习过程中随时向 AI 导师提问，结合上下文智能回答 |
| **掌握度分析** | 四维加权算法实时计算知识点掌握程度 |
| **多计划管理** | 支持同时管理 7 个学习计划，可自由切换 |
| **交互式答题系统** | 学习内容中嵌入选择题，答完即时反馈对错和解析 |
| **AI 问答辅导** | 学习过程中随时向 AI 导师提问，结合上下文智能回答 |
| **学习历史追踪** | 记录所有问答交互，支持回顾 |
| **用户数据隔离** | localStorage 按用户 ID 隔离，切换账户不串数据 |
| **主题切换** | 支持深色/浅色模式切换 |
| **浏览器通知** | 学习提醒和新内容推送 |

## 技术架构

### 前端

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | UI 框架 |
| Vite | 构建工具 |
| Tailwind CSS + shadcn/ui | 样式系统 |
| Framer Motion | 动画效果 |
| Three.js (@react-three/fiber) | 3D 星轨背景 |
| ReactMarkdown + Prism | Markdown 渲染和代码高亮 |
| Zustand | 状态管理 |
| tRPC Client | 类型安全的 API 调用 |

### 后端

| 技术 | 用途 |
|------|------|
| Hono | HTTP 框架 |
| tRPC 11.x | 端到端类型安全 API |
| Drizzle ORM | 数据库 ORM |
| MySQL (TiDB) | 数据库 |
| DeepSeek API | AI 内容生成 |
| JWT (jose) | 身份认证 |

### 数据库 Schema

- `users` - 用户表（手机号登录）
- `verification_codes` - 验证码表
- `learning_plans` - 学习计划表
- `learning_outline` - 学习大纲表（每天的主题）
- `learning_contents` - 学习内容表（AI 生成的 Markdown）
- `mastery_scores` - 掌握度评分表
- `quiz_results` - 答题记录表
- `qa_history` - 问答历史表
- `study_sessions` - 学习会话记录表
- `generation_tasks` - AI 生成任务状态表

## 掌握度分析算法

掌握度评分采用**四维加权模型**，综合评估学习者对知识点的理解程度：

```
MasteryScore = min(100, round(
  StudyTimeScore   * 0.25 +   -- 学习时长 (25%)
  QAScore          * 0.20 +   -- 问答互动 (20%)
  QuizScore        * 0.40 +   -- 练习正确率 (40%)
  FrequencyScore   * 0.15     -- 学习频率 (15%)
))
```

### 各维度计算方式

| 维度 | 计算方式 | 权重 |
|------|----------|------|
| **学习时长** | `studyMinutes / targetMinutes * 100` | 25% |
| **问答互动** | `questionsAsked * 20 + correctAnswers * 10` | 20% |
| **练习正确率** | 加权正确率，首次权重1.0，第二次0.7，第三次0.5，之后0.3 | 40% |
| **学习频率** | `consecutiveDays * 14.3`，7天连续学习=100分 | 15% |

### 答题权重衰减机制

同一知识点的重复答题，权重逐次递减，避免刷题 inflate 分数：

| 答题次数 | 权重 |
|----------|------|
| 第1次 | 1.0 |
| 第2次 | 0.7 |
| 第3次 | 0.5 |
| 第4次+ | 0.3 |

## 多计划管理

每个用户可同时管理最多 **7 个学习计划**，支持以下操作：

### 计划限制规则

- **上限**：最多 7 个进行中的 `active` 计划
- **已完成计划**：标记为 `completed` 的不计入限制
- **新建判断**：创建新计划时自动检测，超限则提示先完成现有计划

### 数据隔离机制

用户切换账户时，系统自动完成以下操作：

1. **localStorage 隔离**：学习状态存储在 `yizhi_learning_state_${userId}` 中
2. **自动切换**：`useAuth` hook 检测到 `user.id` 变化时，自动调用 `switchUser()`
3. **状态重置**：登出时清除所有学习状态并刷新页面
4. **独立恢复**：每个用户登录时只加载自己的最近学习计划

### 计划切换

Dashboard 看板展示所有计划列表，点击即可切换当前学习上下文：
- 当前计划以紫色边框高亮
- 每个计划卡片显示独立进度条
- 已完成的计划以绿色标识，可回顾但不可编辑进度

## 交互式答题系统

### AI 题目生成格式

AI 生成学习内容时，练习题使用标准 HTML 注释格式：

```markdown
<!-- quiz
question: 以下哪个是 React 的核心特性？
A: 双向数据绑定
B: 虚拟 DOM
C: 依赖注入
D: 模板引擎
correct: B
explanation: React 使用虚拟 DOM 来提高渲染性能。当状态变化时，React 先在虚拟 DOM 上计算差异，然后只更新实际需要变化的节点。
-->
```

### 前端渲染流程

1. `MarkdownRenderer` 解析 Markdown 内容
2. `QuizRenderer.extractQuizzes()` 识别 `<!-- quiz ... -->` 注释块
3. `QuizCard` 组件渲染交互式答题卡片
4. 用户选择答案 → 即时显示对错 + 解析
5. 调用 `mastery.submitQuiz` 提交到后端更新掌握度

## 快速开始

### 环境要求

- Node.js 20+
- MySQL / TiDB 数据库
- DeepSeek API Key

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
# .env
DATABASE_URL=mysql://user:password@host:port/database
DEEPSEEK_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret
```

### 数据库初始化

```bash
npm run db:push
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
.
├── api/                     # 后端 API
│   ├── router.ts            # tRPC 路由注册
│   ├── user-router.ts       # 用户管理
│   ├── phone-auth-router.ts # 手机号认证
│   ├── learning-router.ts   # 学习计划
│   ├── content-router.ts    # 学习内容
│   ├── qa-router.ts         # 问答历史
│   ├── mastery-router.ts    # 掌握度算法
│   └── middleware.ts        # 认证中间件
├── db/
│   ├── schema.ts            # 数据库表定义
│   └── add-quiz-table.ts    # 表迁移脚本
├── src/
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.tsx    # 学习看板
│   │   ├── Study.tsx        # 学习页面（含学习时长追踪）
│   │   ├── Mastery.tsx      # 掌握度分析
│   │   ├── Settings.tsx     # 设置
│   │   └── ...
│   ├── components/
│   │   ├── quiz/            # 答题模块
│   │   │   └── QuizRenderer.tsx
│   │   ├── markdown/
│   │   │   └── MarkdownRenderer.tsx
│   │   └── layout/
│   │       └── AppLayout.tsx
│   ├── services/
│   │   └── aiService.ts     # DeepSeek API 封装
│   ├── stores/
│   │   └── useLearningStore.ts
│   └── hooks/
│       └── useAuth.ts
└── contracts/               # 前后端共享类型
```

## 响应式设计

- **桌面端**（>= 768px）：左侧固定侧边栏导航 + 主内容区
- **移动端**（< 768px）：顶部紧凑标题栏 + 底部 Tab Bar 导航
- **手机端优化**：
  - 顶部栏高度 40px（原 48px）
  - 底部 Tab Bar 高度 48px（原 56px）
  - Stat 卡片 2x2 网格布局
  - 弹窗底部增加 padding 防止被 Tab Bar 遮挡

## License

MIT
