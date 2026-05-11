# Love Realm

<p align="center">
  <img src="./desktop/icon.png" alt="Love Realm app icon" width="180" />
</p>

Love Realm 是一个基于 `Next.js + TypeScript + SQLite + Prisma + Electron` 的多角色恋爱养成互动叙事 MVP。玩家通过自然语言推进剧情，系统会持续保存会话、场景、角色关系、长期记忆和 AI 生成的结构化状态更新，并把多轮互动整理成可阅读的小说章节。

当前版本接入 DeepSeek，并保留后续扩展其他模型 provider 的接口边界。

## 已实现能力

- 沉浸式剧情流聊天页面，主舞台改为连续阅读式对话流。
- 长篇剧情生成，默认每轮可见剧情不少于 3000 个中文字符。
- 玩家可设置本轮最低回复字数，范围为 `300-20000`。
- 世界书架、世界详情、角色预览、章节存档与读档。
- DeepSeek 模型选择，默认 `deepseek-v4-flash`。
- 浏览器页面或桌面版内填写玩家自己的 DeepSeek API Key。
- 会话创建、切换、删除、保存和刷新后继续。
- 世界设定、角色设定、状态栏、模型与 API Key 收纳在幕后工作台。
- 导出为小说，支持快速 Markdown 草稿和 AI 润色 Markdown。
- 关系状态以数值条和阶段文案展示。
- 当前场景、当前时间、氛围、摘要、长期记忆随剧情推进更新。
- AI 每轮回复拆分为 `visibleReply` 和 `hiddenStateUpdate`。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置本机环境

推荐先运行：

```bash
npm run setup:local
```

脚本会生成本机 `.env`，并把 SQLite 数据库放到系统用户数据目录，避免游玩记录落在项目仓库里。

如果手动配置 `.env`，至少需要：

```env
DATABASE_URL="file:C:/Users/your-name/AppData/Local/love-realm/love-realm.db"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL="deepseek-v4-flash"
```

可以不在 `.env` 写 `DEEPSEEK_API_KEY`。启动后在页面的“幕后”入口填写 API Key 即可，该 Key 只保存在当前设备。

3. 初始化数据库

```bash
npm run db:push
npm run db:seed
```

注意：`npm run db:seed` 会重置初始世界、角色和会话数据。已有游玩记录时，模型或数据库结构变更后通常只需要运行 `npm run db:push`，不要重复 seed。

4. 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Windows 桌面版

生成 Windows 桌面版：

```bash
npm run desktop:dist
```

产物目录：

```text
dist-desktop/Love Realm-win32-x64/
```

玩家双击 `Love Realm.exe` 即可启动。桌面版会自动启动内置 Next.js 服务，并在玩家自己的系统数据目录创建 SQLite 数据库，例如：

```text
C:\Users\<you>\AppData\Roaming\Love Realm\love-realm.db
```

桌面版不会内置开发者的 DeepSeek API Key。玩家需要在游戏内输入自己的 DeepSeek API Key，该 Key 会保存在玩家本机的 Electron Local Storage 中。

## 小说导出

当前会话可以在“幕后”中导出为 Markdown 小说文件：

- 快速草稿导出：不调用 AI，将玩家行动与 AI 剧情回复整理成小说式 Markdown。
- AI 润色导出：调用玩家自己的 DeepSeek API Key，把多轮互动润色为更接近正常小说阅读体验的章节文本。
- 导出范围支持全部会话或最近 N 轮。
- 导出内容只使用玩家可见剧情、玩家行动、场景和必要记忆摘要，不导出隐藏状态数据。

应用图标资源：

```text
desktop/icon.ico
desktop/icon.png
```

## 主要目录

```text
desktop/                  Electron 桌面壳与应用图标
prisma/
  schema.prisma           数据模型
  seed.ts                 初始世界和角色数据
src/
  app/api/                后端 API Routes
  components/             前端互动叙事界面
  lib/ai/                 DeepSeek 适配层
  lib/prompt.ts           Prompt 编排
  lib/session-service.ts  世界状态和持久化服务
  lib/status-metrics.ts   自定义角色状态栏逻辑
  lib/story-schema.ts     模型输出 JSON 校验
```

## 核心数据模型

- `World`：世界设定，包含统一的 `statusMetrics` 状态栏模板。
- `Character`：主要角色设定。
- `Session`：剧情分支会话。
- `Message`：玩家输入和 AI 可见剧情回复。
- `RelationshipState`：每个会话中每个角色的动态状态值。
- `MemorySummary`：长期记忆摘要。
- `SceneState`：当前场景、时间、氛围和变化。

## API 概览

- `GET /api/sessions`：获取会话列表。
- `POST /api/sessions`：创建新会话。
- `GET /api/sessions/[sessionId]`：获取会话详情。
- `PATCH /api/sessions/[sessionId]`：保存当前会话。
- `DELETE /api/sessions/[sessionId]`：删除剧情分支。
- `POST /api/sessions/[sessionId]/messages`：发送玩家输入并生成剧情。
- `POST /api/sessions/[sessionId]/export-novel`：导出当前会话为小说 Markdown。
- `GET /api/worlds`：获取世界书架数据。
- `PATCH /api/worlds/[worldId]`：保存世界设定和状态栏模板。
- `POST /api/characters`：新增主要角色。
- `PATCH /api/characters/[characterId]`：保存角色设定。
- `DELETE /api/characters/[characterId]`：删除主要角色。

## DeepSeek 输出约束

服务端要求模型只返回严格 JSON：

```json
{
  "visibleReply": "给玩家看的剧情回复，至少 300 个中文字符。",
  "hiddenStateUpdate": {
    "relationshipChanges": {
      "lin_yue_trust": 2
    },
    "sceneChanges": ["氛围变得微妙"],
    "newFacts": ["林月察觉玩家昨晚没有按时回来"],
    "memorySummary": "这一轮值得长期记住的摘要。",
    "currentScene": "新的当前场景",
    "currentTime": "新的当前时间",
    "atmosphere": "新的当前氛围",
      "suggestedActions": ["建议一", "建议二", "建议三"]
  }
}
```

`relationshipChanges` 只能使用当前世界状态栏模板中存在的字段，最终状态值会限制在 `0-10`。默认 `visibleReply` 至少需要 3000 个中文字符；玩家可以在界面中把本轮最低字数调整到 `300-20000`。

## 验证命令

```bash
npm run test:unit
npm run build
```
