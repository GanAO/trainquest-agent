# TrainQuest Agent

一个本地优先的训练记录 Agent，把训练日志、肌群成长、角色反馈和飞书自动化连接在一起。项目目标不是做一个制造焦虑的打卡工具，而是把训练记录变成可持续的正反馈系统：每次训练都会转化为属性经验、角色成长、成就反馈和可同步的结构化数据。

## 项目亮点

- **训练自然语言解析**：支持手动录入，也支持通过 AI/规则解析训练描述，生成标准训练记录。
- **RPG 成长系统**：将训练动作映射到胸、肩、背、腿、手臂、核心、心肺 7 类属性，并按训练量计算经验和等级。
- **像素角色反馈**：前端用移动端优先界面展示角色状态、属性进度、历史训练和数据看板。
- **飞书机器人接入**：支持飞书消息录入训练、待确认草稿、缺失字段追问、撤销、修改、查询最近训练和训练建议。
- **飞书多维表格同步**：将训练记录、动作明细、属性成长、成就和每日汇总同步到飞书 Base，方便做团队化/个人化数据看板。
- **本地优先数据模型**：使用 JSON 文件作为存储层，便于开发、备份、导出，也方便后续替换为数据库。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vite, React, TypeScript, Tailwind CSS |
| 状态与图表 | Zustand, Recharts |
| 后端 | Node.js, Express, TypeScript |
| 数据存储 | Local JSON repositories |
| AI 解析 | DeepSeek / OpenAI / OpenAI-compatible API, rule-based fallback |
| 飞书集成 | Lark/Feishu Open Platform SDK, lark-cli, bot message workflow, Base sync |

## 核心模块

### 1. 训练记录

用户可以录入力量训练或有氧训练，系统统一保存为标准 JSON：

```json
{
  "date": "2026-06-08",
  "feeling": "good",
  "exercises": [
    {
      "name": "卧推",
      "type": "strength",
      "sets": 3,
      "reps": 10,
      "weight": 60,
      "unit": "kg"
    }
  ]
}
```

### 2. 属性成长

动作会通过 `muscle-map.json` 映射到主要肌群和次要肌群。系统根据训练容量、时长和肌群贡献计算 XP，更新属性等级。

### 3. 飞书 Agent 工作流

飞书机器人不是简单转发消息，而是一个轻量训练记录 Agent：

- 解析自然语言训练记录。
- 对缺失字段进行追问，例如组数、次数、时长。
- 生成保存前预览，让用户确认。
- 支持撤销最近保存、修改训练记录、查询最近训练。
- 支持每日简报和训练建议上下文。
- 保存后自动触发飞书 Base 同步。

### 4. 数据看板

项目会聚合训练频率、体重趋势、肌群分布、目标进度、属性成长和成就解锁状态。飞书 Base 同步后可以进一步做多维表格看板。

## 项目结构

```text
trainquest-agent/
  src/                    # React 前端
    components/           # 记录、角色、数据、设置等 UI 组件
    routes/               # 页面路由
    api/                  # 前端 API client
    domain/               # 前端领域类型
  server/
    src/
      adapters/           # 飞书/Chat 输入适配器
      routes/             # Express API routes
      services/           # 训练解析、属性计算、飞书工作流、同步服务
      repositories/       # JSON 文件读写
      domain/             # 领域模型与公式
  data/                   # 示例数据与本地 JSON store
  docs/                   # 需求文档与技术方案
  design-concepts/        # 视觉方向与封面草图
```

## 本地运行

安装前端依赖：

```bash
npm install
```

安装后端依赖：

```bash
cd server
npm install
```

启动前后端：

```bash
npm run dev
```

默认服务：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001/api`

## 环境变量

复制示例配置：

```bash
cp server/.env.example server/.env
```

AI 解析器可选。不配置时，系统会使用规则解析器兜底。

飞书机器人和飞书 Base 同步需要在飞书开放平台创建应用，并配置机器人权限、长连接事件和用户白名单。具体变量见 `server/.env.example`。

## 常用命令

```bash
# 前后端一起启动
npm run dev

# 构建前端
npm run build

# 启动后端开发服务
cd server && npm run dev

# 同步飞书 Base
npm run feishu:sync
```

## API 示例

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/workouts
curl http://localhost:3001/api/dashboard
```

创建训练记录：

```bash
curl -X POST http://localhost:3001/api/workouts \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-08",
    "feeling": "good",
    "exercises": [
      {
        "name": "深蹲",
        "type": "strength",
        "sets": 4,
        "reps": 8,
        "weight": 80,
        "unit": "kg",
        "note": ""
      }
    ]
  }'
```

## 设计原则

- **反焦虑**：不做排行榜、不做惩罚式连续打卡、不用负面文案制造压力。
- **本地优先**：核心数据可本地运行、可导出、可替换存储层。
- **输入适配器解耦**：手动录入、飞书、Chat 或未来的其他入口，都转换为同一套训练记录 JSON。
- **面向长期迭代**：先完成 MVP，再逐步扩展 PWA、更多 Agent 工具、数据库和部署能力。

## 当前状态

项目已经完成 MVP 主体和飞书集成原型，包括训练录入、角色属性、数据聚合、AI/规则解析、飞书机器人工作流和飞书 Base 同步。后续可以继续补充自动化测试、在线部署、数据库持久化和更完整的截图说明。
