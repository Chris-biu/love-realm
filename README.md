# Love Realm

<p align="center">
  <img src="./desktop/icon.png" alt="Love Realm app icon" width="180" />
</p>

Love Realm 是一个基于 `Next.js + TypeScript + SQLite + Prisma + Electron` 的多角色恋爱养成互动叙事 MVP。玩家通过自然语言推进剧情，系统会保存会话、场景、角色关系、长期记忆和状态变化，并支持把多轮互动导出为可阅读的小说章节。

当前版本接入 DeepSeek，玩家需要在本机输入自己的 DeepSeek API Key；项目不会内置开发者 API Key。

## 已实现能力

- 沉浸式剧情流页面，主舞台采用连续阅读式对话体验。
- 长篇剧情生成，默认每轮可见剧情不少于 `800` 个中文字符。
- 玩家可设置本轮最低回复字数，范围为 `300-20000`。
- 新版生成链路已拆分为“纯正文生成”和“状态 JSON 更新”，减少长文本破坏 JSON 的概率。
- 轻量反幻觉约束：正文生成和续写阶段都会带入角色白名单，默认禁止 AI 凭空创造重要角色。
- 动态角色档案：每个存档独立记录角色当前身份、当前关系、对玩家态度、称呼和不可遗忘事实。
- 正文未达到最低字数时，后端会自动续写并合并，直到达到目标或超过安全上限。
- 世界书架、世界详情、角色预览、章节存档、读档和删档。
- 世界设定、角色设定、状态栏、模型和 API Key 可在“幕后”工作台调整。
- 支持导出为小说 Markdown，包括快速草稿和 AI 润色版本。
- Windows 桌面版支持双击 `Love Realm.exe` 直接启动。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置本机环境

```bash
npm run setup:local
```

该脚本会生成本机 `.env`，并把 SQLite 数据库放到系统用户数据目录，避免游玩记录落在项目仓库中。

如果手动配置 `.env`，至少需要：

```env
DATABASE_URL="file:C:/Users/your-name/AppData/Local/love-realm/love-realm.db"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL="deepseek-v4-flash"
```

可以不在 `.env` 写 `DEEPSEEK_API_KEY`。启动后在页面“幕后”入口填写 API Key 即可，该 Key 只保存在当前设备。

3. 初始化数据库

```bash
npm run db:push
npm run db:seed
```

注意：`npm run db:seed` 会重置初始世界、角色和会话数据。已有游玩记录时，数据库结构变更后通常只需要运行 `npm run db:push`，不要重复 seed。

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

应用图标资源：

```text
desktop/icon.ico
desktop/icon.png
```

## 长篇生成机制

过去版本要求 DeepSeek 一次性返回包含长篇 `visibleReply` 的 JSON。这个方案在长文本场景下容易因为转义、截断或字段遗漏导致“返回的 JSON 不符合预期”。

当前版本改为两阶段：

- 第一阶段：只生成玩家可见的剧情正文，不要求 JSON。
- 第二阶段：正文长度达标后，再根据最终正文生成很小的 `hiddenStateUpdate` JSON。

状态 JSON 结构为：

```json
{
  "hiddenStateUpdate": {
    "relationshipChanges": {
      "lin_yue_trust": 2
    },
    "characterStateUpdates": {
      "lin_yue": {
        "currentIdentity": "玩家的女朋友",
        "currentRelationship": "恋人",
        "attitudeTowardPlayer": "亲密但仍会嘴硬",
        "playerAddress": "亲爱的",
        "persistentFacts": ["她已经接受玩家告白"]
      }
    },
    "sceneChanges": ["氛围发生了真实变化"],
    "newFacts": ["本轮新增的重要事实"],
    "memorySummary": "值得长期记住的本轮摘要",
    "currentScene": "新的当前场景",
    "currentTime": "新的当前时间",
    "atmosphere": "新的当前氛围",
    "suggestedActions": ["建议一", "建议二", "建议三"]
  }
}
```

`relationshipChanges` 只能使用当前世界状态栏模板中存在的字段，最终状态值会限制在 `0-10`。

## 动态角色档案

角色卡分为两层：

- 初始角色卡：角色名称、性别、初始身份标签、公开设定、隐藏动机和性格标签。
- 当前动态档案：当前身份、当前关系、对玩家态度、对玩家称呼和不可遗忘事实。

动态档案保存在会话内，不同存档互不影响。例如同一个角色在 A 存档里可以是恋人，在 B 存档里仍然是死对头。

AI 每轮会在现有状态 JSON 中尝试更新 `characterStateUpdates`，不会额外增加一次 AI 调用。玩家也可以在“幕后工作台 > 角色设定 > 当前动态档案”中手动编辑。玩家手动编辑的字段会作为 `PLAYER` 来源保存，后续 AI 不能自动覆盖；当动态档案和初始角色卡冲突时，剧情生成会优先使用动态档案。

## 小说导出

当前会话可以在“幕后”中导出为 Markdown 小说文件：

- 快速草稿导出：不调用 AI，将玩家行动和 AI 剧情回复整理成小说式 Markdown。
- AI 润色导出：调用玩家自己的 DeepSeek API Key，把多轮互动润色为更接近正常小说阅读体验的章节文本。
- 导出范围支持全部会话或最近 N 轮。
- 导出内容只使用玩家可见剧情、玩家行动、场景和必要记忆摘要，不导出隐藏状态数据。

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
  lib/story-schema.ts     状态 JSON 校验
```

## 验证命令

```bash
npm run test:unit
npm run build
```
