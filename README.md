# LLM 恋爱互动叙事 MVP

这是一个基于 `Next.js + TypeScript + SQLite + Prisma` 的多角色恋爱养成互动叙事 Web MVP。玩家通过自然语言推进剧情，系统会持续保存会话、场景、角色关系、长期记忆和 AI 生成的结构化状态更新。

当前只接入 DeepSeek，并保留后续扩展其他模型 provider 的接口边界。

## 已实现能力

- 沉浸式剧情流聊天页面
- DeepSeek 模型选择，默认 `deepseek-v4-flash`
- 浏览器页面内填写 DeepSeek API Key
- 会话创建、切换、删除和刷新后继续
- 世界设定可编辑保存
- 角色设定可编辑保存
- 主要角色可新增和删除
- 同一世界下统一的角色状态栏模板
- 状态栏字段可新增、删除、改名
- AI 每轮按当前状态栏模板更新角色状态
- 当前场景、当前时间、氛围和摘要由 AI 随剧情更新
- 每轮回复强制拆分为 `visibleReply` 和 `hiddenStateUpdate`

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

复制 `.env.example` 为 `.env`，至少填写：

```env
DATABASE_URL="file:C:/Users/your-name/AppData/Local/love-realm/love-realm.db"
DEEPSEEK_API_KEY="你的 DeepSeek Key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL="deepseek-v4-flash"
```

也可以不在 `.env` 写 API Key，启动后在网页右侧“幕后控制台”里填写网页密钥。

3. 初始化数据库

```bash
npm run setup:local
npm run db:push
npm run db:seed
```

建议先运行 `npm run setup:local` 生成本机 `.env`。脚本会把 SQLite 数据库放到系统用户数据目录，例如 Windows 下的 `C:\Users\<you>\AppData\Local\love-realm\love-realm.db`，避免游玩记录落在项目仓库里。

注意：`npm run db:seed` 会重置世界观、角色和会话数据。已有游玩记录时，只需要在模型变更后运行 `npm run db:push`，不要重新 seed。

4. 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Windows 桌面版打包

生成 Windows 便携版桌面应用：

```bash
npm run desktop:dist
```

产物目录：

```text
dist-desktop/Love Realm-win32-x64/
```

玩家双击 `Love Realm.exe` 即可启动。应用会自动启动内置 Next.js 服务，并在玩家自己的系统数据目录创建 SQLite 数据库，例如：

```text
C:\Users\<you>\AppData\Roaming\Love Realm\love-realm.db
```

桌面版不会内置开发者的 DeepSeek API Key。玩家需要在游戏内输入自己的 DeepSeek API Key，该 Key 会保存在玩家本机的 Electron Local Storage 中。

## 主要目录

```text
prisma/
  schema.prisma       数据模型
  seed.ts             初始世界和角色数据
src/
  app/api/            后端 API Routes
  components/         前端聊天页面
  lib/ai/             DeepSeek 适配层
  lib/prompt.ts       Prompt 编排
  lib/session-service.ts  世界状态和持久化服务
  lib/status-metrics.ts   自定义角色状态栏逻辑
  lib/story-schema.ts     模型输出 JSON 校验
```

## 核心数据模型

- `World`：世界设定，包含统一的 `statusMetrics` 状态栏模板
- `Character`：主要角色设定
- `Session`：剧情分支会话
- `Message`：玩家输入和 AI 可见剧情回复
- `RelationshipState`：每个会话中每个角色的动态状态值
- `MemorySummary`：长期记忆摘要
- `SceneState`：当前场景、时间、氛围和变化

## API 概览

- `GET /api/sessions`：获取会话列表
- `POST /api/sessions`：创建新会话
- `GET /api/sessions/[sessionId]`：获取会话详情
- `DELETE /api/sessions/[sessionId]`：删除剧情分支
- `POST /api/sessions/[sessionId]/messages`：发送玩家输入并生成剧情
- `PATCH /api/worlds/[worldId]`：保存世界设定和状态栏模板
- `POST /api/characters`：新增主要角色
- `PATCH /api/characters/[characterId]`：保存角色设定
- `DELETE /api/characters/[characterId]`：删除主要角色

## DeepSeek 输出约束

服务端要求模型只返回严格 JSON：

```json
{
  "visibleReply": "给玩家看的剧情回复，至少 300 个中文字符。",
  "hiddenStateUpdate": {
    "relationshipChanges": {
      "lin_yue_trust": 2
    },
    "sceneChanges": ["气氛变得微妙"],
    "newFacts": ["林月察觉玩家昨晚没有按时回来"],
    "memorySummary": "这一轮值得长期记住的摘要。",
    "currentScene": "新的当前场景",
    "currentTime": "新的当前时间",
    "atmosphere": "新的当前氛围",
    "suggestedActions": ["建议一", "建议二", "建议三"]
  }
}
```

`relationshipChanges` 只能使用当前世界状态栏模板中存在的字段，最终状态值会限制在 `0-10`。

## 验证命令

```bash
npm run test:unit
npm run build
```
