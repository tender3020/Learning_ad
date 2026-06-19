# 弈智 AI 学习成长系统

> 基于 DeepSeek AI 的自适应学习平台，为每位学习者量身定制个性化学习路径。

## 项目概览

弈智是一个全栈 AI 驱动的学习平台，通过 DeepSeek 大模型实现智能课程生成、个性化授课、交互式答题和掌握度追踪。系统采用自适应学习算法，根据学生的学习数据动态调整学习节奏和难度。

## 核心功能

### Mermaid 图表支持
- 网络关联型内容现在支持自动渲染因果网络图
- 使用标准的mermaid语法，在代码块中使用```mermaid标记
- 支持flowchart、graph等多种图表类型
- 自动适配暗色主题，与整体UI风格一致

| 模块 | 功能描述 |
|------|----------|
| **AI 学习计划生成** | 输入学习目标，AI 自动生成 N 天的结构化学习大纲 |
| **DeepSeek 流式授课** | AI 实时生成 Markdown 格式的学习内容，含知识讲解和代码示例 |
| **能力评估系统** | 支持 5 级能力评测（L1-L5），自适应调整难度 |
| **交互式答题系统** | 学习内容中嵌入选择题，答完即时反馈对错和解析 |
| **AI 问答辅导** | 学习过程中随时向 AI 导师提问，结合上下文智能回答 |
| **掌握度分析** | 四维加权算法实时计算知识点掌握程度 |
| **多计划管理** | 支持同时管理 7 个学习计划，可自由切换 |
| **学习历史追踪** | 记录所有问答交互和答题记录，支持回顾 |
| **用户数据隔离** | localStorage 按用户 ID 隔离，切换账户不串数据 |
| **主题切换** | 支持深色/浅色模式切换 |
| **浏览器通知** | 学习提醒和新内容推送 |

## 技术架构

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| React Router | 7.6.1 | 路由管理 |
| TypeScript | 5.9.3 | 类型安全 |
| Vite | 7.2.4 | 构建工具 |
| Tailwind CSS + shadcn/ui | - | 样式系统 |
| Framer Motion | 12.40.0 | 动画效果 |
| Three.js (@react-three/fiber) | 9.6.1 | 3D 星轨背景 |
| React Markdown + Syntax Highlighter | 10.1.0 / 16.1.1 | Markdown 渲染和代码高亮 |
| Recharts | 2.15.4 | 数据可视化图表 |
| React Query | 5.90.16 | 异步数据获取与缓存 |
| Zustand | 5.0.14 | 状态管理 |
| tRPC Client | 11.8.1 | 类型安全的 API 调用 |
| KaTeX | 0.17.0 | 数学公式渲染 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Hono | 4.8.3 | HTTP 框架 |
| tRPC Server | 11.8.1 | 端到端类型安全 API |
| Drizzle ORM | 0.45.1 | 数据库 ORM |
| MySQL 2 | 3.14.1 | MySQL 驱动 |
| MySQL / TiDB | - | 数据库 |
| DeepSeek API | - | AI 内容生成 |
| JWT (jose) | 6.1.3 | 身份认证 |
| AWS S3 SDK | 3.965.0 | 文件存储 |
| dotenv | 17.2.3 | 环境变量管理 |

### 开发工具

- **TypeScript** - 类型安全和代码质量
- **ESLint** - 代码规范检查
- **Prettier** - 代码格式化
- **Vitest** - 单元测试框架
- **Drizzle Kit** - 数据库迁移工具

## 数据库 Schema

### 核心表

- `users` - 用户表（手机号登录）
- `verification_codes` - 验证码表
- `learning_plans` - 学习计划表（支持 7 个并行计划）
- `learning_outline` - 学习大纲表（每天的主题）
- `learning_contents` - 学习内容表（AI 生成的 Markdown）

### 学习追踪表

- `study_sessions` - 学习会话记录（包含时长追踪）
- `quiz_results` - 答题记录表
- `qa_history` - 问答历史表
- `mastery_scores` - 掌握度评分表

### 评估表

- `assessments` - 能力评估记录（5 级评测）
- `assessment_answers` - 评估答题细节表

### 后台表

- `generation_tasks` - AI 生成任务状态表（支持进度追踪）

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

## 能力评估系统

支持 5 级能力评测，根据答题情况动态调整难度：

| 等级 | 难度 | 说明 |
|------|------|------|
| L1 | 基础 | 基本概念理解 |
| L2 | 初级 | 知识点掌握 |
| L3 | 中级 | 综合应用能力 |
| L4 | 高级 | 深入理解 |
| L5 | 专家 | 精通与创新 |

## 多计划管理

每个用户可同时管理最多 **7 个学习计划**，支持以下操作：

### 计划限制规则

- **上限**：最多 7 个进行中的 `active` 计划
- **已完成计划**：标记为 `completed` 的不计入限制
- **暂停计划**：支持 `paused` 状态，可随时恢复
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
- 每个计划卡片显示独立进度条和掌握度
- 已完成的计划以绿色标识，可回顾但不可编辑进度
- 暂停的计划以灰色标识，支持恢复

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
5. 记录到 `quiz_results` 表并触发掌握度重算

## 学习时长追踪

系统自动追踪每个学习会话的学习时长：

- **Session 记录**：记录在 `study_sessions` 表
- **掌握度计算**：时长数据参与四维掌握度算法
- **统计展示**：Dashboard 和 Mastery 页面展示学习时长统计

## 快速开始

### 环境要求

- Node.js 20+
- MySQL 8.0+ / TiDB
- DeepSeek API Key
- AWS S3 账户（可选，用于文件存储）

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=mysql://user:password@host:port/database

# AI API
DEEPSEEK_API_KEY=your_deepseek_api_key

# 认证
JWT_SECRET=your_jwt_secret

# AWS S3（可选）
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=your_region
```

### 数据库初始化

```bash
# 生成迁移文件
npm run db:generate

# 执行迁移
npm run db:migrate

# 或者一键推送 schema（开发阶段推荐）
npm run db:push
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 代码检查与格式化

```bash
# TypeScript 类型检查
npm run check

# ESLint 代码规范检查
npm run lint

# Prettier 代码格式化
npm run format

# 单元测试
npm run test
```

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
.
├── api/                           # 后端 API
│   ├── boot.ts                   # 应用启动入口
│   ├── router.ts                 # tRPC 路由注册
│   ├── user-router.ts            # 用户管理（注册、登录、信息）
│   ├── phone-auth-router.ts      # 手机号认证（验证码发送、验证）
│   ├── learning-router.ts        # 学习计划管理
│   ├── content-router.ts         # 学习内容生成和查询
│   ├── qa-router.ts              # 问答历史管理
│   ├── mastery-router.ts         # 掌握度评分和算法
│   ├── assessment-router.ts      # 能力评估
│   ├── middleware.ts             # 认证和错误处理中间件
│   └── utils/                    # 工具函数
│
├── db/
│   ├── schema.ts                 # 数据库完整 schema
│   └── index.ts                  # 数据库连接配置
│
├── src/
│   ├── pages/                    # 页面组件
│   │   ├── Dashboard.tsx         # 学习看板（计划列表、进度）
│   │   ├── Study.tsx             # 学习页面（学习内容展示、计时）
│   │   ├── Mastery.tsx           # 掌握度分析页面
│   │   ├── Assessment.tsx        # 能力评估页面
│   │   ├── Settings.tsx          # 用户设置
│   │   ├── Login.tsx             # 登录页面
│   │   └── NotFound.tsx          # 404 页面
│   │
│   ├── components/
│   │   ├── quiz/                 # 答题模块
│   │   │   ├── QuizRenderer.tsx  # 题目解析和渲染
│   │   │   ├── QuizCard.tsx      # 题目卡片组件
│   │   │   └── QuizStats.tsx     # 答题统计
│   │   │
│   │   ├── markdown/             # Markdown 相关
│   │   │   ├── MarkdownRenderer.tsx  # Markdown 渲染
│   │   │   └── CodeBlock.tsx     # 代码块组件
│   │   │
│   │   ├── layout/               # 布局组件
│   │   │   ├── AppLayout.tsx     # 主布局
│   │   │   ├── Sidebar.tsx       # 侧边栏导航
│   │   │   └── TopBar.tsx        # 顶部栏
│   │   │
│   │   ├── charts/               # 图表组件
│   │   │   ├── MasteryChart.tsx  # 掌握度可视化
│   │   │   └── ProgressChart.tsx # 进度图表
│   │   │
│   │   └── common/               # 通用组件
│   │       ├── Loading.tsx       # 加载动画
│   │       ├── Modal.tsx         # 弹窗
│   │       └── Toast.tsx         # 提示
│   │
│   ├── services/
│   │   ├── aiService.ts          # DeepSeek API 封装
│   │   ├── trpcClient.ts         # tRPC 客户端配置
│   │   └── api.ts                # 其他 API 调用
│   │
│   ├── stores/
│   │   ├── useLearningStore.ts   # 学习状态管理
│   │   ├── useAuthStore.ts       # 认证状态管理
│   │   └── useUIStore.ts         # UI 状态管理
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # 认证 hook
│   │   ├── useStudyTimer.ts      # 学习计时 hook
│   │   ├── useMastery.ts         # 掌握度 hook
│   │   └── useQuery.ts           # React Query hook
│   │
│   ├── utils/
│   │   ├── formatters.ts         # 数据格式化
│   │   ├── validators.ts         # 数据验证
│   │   └── constants.ts          # 常量定义
│   │
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   │
│   ├── App.tsx                   # 应用主组件
│   └── main.tsx                  # 应用入口
│
├── contracts/                    # 前后端共享类型定义
│   └── index.ts
│
├── .env                         # 环境变量配置
├── package.json                 # 项目依赖
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 配置
├── tailwind.config.ts          # Tailwind CSS 配置
└── README.md                   # 项目说明文档
```

## 响应式设计

系统支持全端适配：

### 桌面端（≥ 768px）
- 左侧固定侧边栏导航
- 主内容区自适应宽度
- 完整功能展示

### 移动端（< 768px）
- 顶部紧凑标题栏（高度 40px）
- 底部 Tab Bar ���航（高度 48px）
- Stat 卡片 2x2 网格布局
- 弹窗底部增加 padding 防止被 Tab Bar 遮挡
- 单列布局优化

## 核心流程

### 1. 学习计划生成流程

```
用户输入学习目标 
  ↓
调用 DeepSeek API 生成学习大纲
  ↓
保存到 learning_outline 表
  ↓
生成 N 天的课程结构
  ↓
用户开始学习
```

### 2. 学习内容生成流程

```
用户点击学习某一天
  ↓
检查 learning_contents 是否已缓存
  ↓
若未缓存，调用 DeepSeek 流式生成内容
  ↓
实时显示 Markdown 内容
  ↓
提取 quiz 并渲染答题卡片
  ↓
保存内容和状态
```

### 3. 掌握度更新流程

```
用户完成学习、做题、提问等操作
  ↓
记录到相应数据表（quiz_results, qa_history, study_sessions）
  ↓
触发掌握度重算
  ↓
四维算法实时计算分数
  ↓
更新 mastery_scores 表
  ↓
Dashboard 和 Mastery 页面实时展示
```

### 4. 多计划切换流程

```
用户切换学习计划
  ↓
自动保存当前计划状态到 localStorage
  ↓
加载新计划的学习数据
  ↓
恢复到上次学习位置
  ↓
更新 UI 和学习进度
```

## 性能优化

- **前端缓存**：使用 React Query 缓存 API 响应，减少重复请求
- **流式响应**：DeepSeek 内容生成采用流式传输，优化用户体验
- **数据库索引**：关键字段添加索引加快查询
- **增量更新**：掌握度算法采用增量更新，避免全量重算
- **图片优化**：头像等图片使用 AWS S3 存储和 CDN 分发

## 安全特性

- **JWT 认证**：使用 JWT token 进行身份验证
- **手机号验证**：发送验证码到手机确认身份
- **SQL 防注入**：使用 Drizzle ORM 防止 SQL 注入
- **CORS 配置**：严格的跨域资源共享策略
- **环境变量隔离**：敏感信息通过环境变量管理

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 开发规范

- **代码风格**：遵循 ESLint 和 Prettier 配置
- **提交信息**：使用有意义的 commit 信息
- **类型安全**：所有代码必须通过 TypeScript 类型检查
- **测试覆盖**：重要功能需要单元测试

## 常见问题

### Q: 如何重置用户数据？
A: 删除 localStorage 中 `yizhi_learning_state_${userId}` 的数据，或调用 API 重置。

### Q: 支持离线模式吗？
A: 暂不支持，但缓存的内容可在网络恢复后同步。

### Q: 如何集成自己的 LLM？
A: 修改 `src/services/aiService.ts` 中的 DeepSeek 调用，替换为你的 LLM 接口。

### Q: 数据库可以使用其他类型吗？
A: 可以，修改 `db/schema.ts` 中的 Drizzle 配置即可。

## 许可证

MIT

## 联系方式

有问题或建议？欢迎提交 Issue 或 PR。

---

**最后更新**: 2026 年 6 月
**最后更新**: 2026 年 6 月

### Mermaid 图表支持
- 网络关联型内容现在支持自动渲染因果网络图
- 使用标准的mermaid语法，在代码块中使用```mermaid标记
- 支持flowchart、graph等多种图表类型
- 自动适配暗色主题，与整体UI风格一致
