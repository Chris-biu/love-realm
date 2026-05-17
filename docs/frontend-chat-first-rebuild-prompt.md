# Frontend Rebuild Prompt

Use this prompt when continuing the Love Realm frontend:

```text
你现在是在迭代 Love Realm 的正式前端，而不是临时 demo。必须遵守以下方向：

1. 信息架构
- 默认以聊天体验为核心
- 一个页面只负责一类主要任务
- 不要把聊天、关系、记忆、设定、存档再次塞回同一屏

2. 路由结构
- `/`：世界入口 / 书架
- `/session/[sessionId]`：主聊天页，只负责阅读与输入
- `/session/[sessionId]/memory`：回忆、场景、长期记忆
- `/session/[sessionId]/relationships`：关系与状态栏
- `/session/[sessionId]/backstage`：主角、角色、导演节奏、RAG、模型、导出、分支与存档

3. 聊天页原则
- 聊天窗口必须最大化
- 顶部信息只保留必要场景上下文
- 不要在聊天页常驻大块关系面板、存档列表、后台表单
- 聊天页只保留轻量操作，例如发送、保存章节、长度偏好

4. 页面职责
- 入口页负责进入故事，不负责聊天
- 聊天页负责剧情阅读和输入
- 回忆页负责查看已知上下文
- 关系页负责查看人物状态
- 幕后页负责所有重配置和管理能力

5. 视觉方向
- 克制、成熟、叙事感强
- 避免通用紫色 SaaS 风
- 用排版、留白、材质感建立高级感
- 桌面与移动端都必须可读、可点、可滚动

6. 工程约束
- 不要继续扩张巨型页面组件
- 优先拆成页面级组件和明确职责的 client islands
- 只让真正有交互的部分进入 client component
- 新增功能时先判断属于哪个页面，不允许默认塞回聊天页

7. 验证要求
- `npm run build`
- `npm run test:unit`
- 如有条件，检查 `/`、`/session/[id]`、`/memory`、`/relationships`、`/backstage`
```
