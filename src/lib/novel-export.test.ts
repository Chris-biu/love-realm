import assert from "node:assert/strict";
import test from "node:test";
import { MessageRole } from "@prisma/client";
import { buildNovelFileName, buildNovelPolishPrompts, buildQuickNovelMarkdown } from "./novel-export";
import type { SessionBundle } from "./session-service";

function makeBundle(): SessionBundle {
  return {
    id: "session_1",
    title: "雨夜重逢",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    isSaved: true,
    world: {
      id: "world_1",
      slug: "moonlit",
      name: "月栖公馆",
      description: "旧公馆里的恋爱悬疑。",
      premise: "玩家回到公馆，重新面对旧关系。",
      storyGuide: "写成互动小说。",
      directorConfig: {
        pacing: "balanced",
        beatLabel: "稳步升温",
        retrieval: {
          memoryLimit: 4,
          factLimit: 4,
          dialogueLimit: 4,
        },
      },
    },
    playerProfile: {
      displayName: "你",
      role: "代管人",
      publicPersona: "克制",
      background: "离开多年后重返旧地。",
      motivation: "查清真相",
      speakingStyle: "礼貌但锋利",
    },
    characters: [],
    messages: [
      { id: "m1", role: MessageRole.USER, content: "推开餐厅的门", turnNumber: 1, createdAt: new Date().toISOString() },
      { id: "m2", role: MessageRole.ASSISTANT, content: "餐厅里的灯光微微摇晃，林月抬起眼看向你。", turnNumber: 1, createdAt: new Date().toISOString() },
      { id: "m3", role: MessageRole.USER, content: "问她为什么还没离开", turnNumber: 2, createdAt: new Date().toISOString() },
      { id: "m4", role: MessageRole.ASSISTANT, content: "她没有立刻回答，只把手中的茶杯放回桌面。", turnNumber: 2, createdAt: new Date().toISOString() },
    ],
    relationships: [],
    sceneState: {
      currentScene: "公馆餐厅",
      currentTime: "第 1 天，夜晚",
      atmosphere: "试探",
      summary: "餐厅里的重逢。",
      changes: [],
      facts: [],
    },
    memorySummaries: [{ id: "mem_1", content: "玩家回到公馆后与林月重逢。", turnNumber: 1, createdAt: new Date().toISOString() }],
    statusMetrics: [],
    suggestedPrompts: [],
  };
}

test("快速导出生成小说式 Markdown 而不是聊天日志", () => {
  const markdown = buildQuickNovelMarkdown(makeBundle());

  assert.match(markdown, /^# 雨夜重逢/);
  assert.match(markdown, /## 第 1 章/);
  assert.match(markdown, /这一刻，你选择推开餐厅的门。/);
  assert.doesNotMatch(markdown, /玩家：|AI：|系统：/);
});

test("最近轮数会限制快速导出范围", () => {
  const markdown = buildQuickNovelMarkdown(makeBundle(), { recentTurns: 1 });

  assert.doesNotMatch(markdown, /推开餐厅的门/);
  assert.match(markdown, /问她为什么还没离开/);
});

test("AI 润色 prompt 要求输出小说正文 Markdown", () => {
  const prompts = buildNovelPolishPrompts(makeBundle(), "草稿正文");

  assert.match(prompts.systemPrompt, /Markdown 小说正文/);
  assert.match(prompts.systemPrompt, /不要出现“玩家：”“AI：”“系统：”/);
  assert.match(prompts.userPrompt, /草稿正文/);
});

test("导出文件名包含世界、会话和时间", () => {
  const fileName = buildNovelFileName(makeBundle(), new Date("2026-05-11T01:02:03.000Z"));

  assert.equal(fileName, "月栖公馆_雨夜重逢_2026-05-11T01-02-03.md");
});
