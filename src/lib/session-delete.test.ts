import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionDeletePlan, removeSessionFromList } from "@/lib/session-delete";

test("删除非当前会话时不需要请求下一个完整会话", () => {
  const plan = buildSessionDeletePlan({
    activeSessionId: "active-session",
    deletingSessionId: "side-session",
  });

  assert.deepEqual(plan, {
    deletingActiveSession: false,
    hydrateNextSession: false,
  });
});

test("删除当前会话时需要请求下一个完整会话", () => {
  const plan = buildSessionDeletePlan({
    activeSessionId: "active-session",
    deletingSessionId: "active-session",
  });

  assert.deepEqual(plan, {
    deletingActiveSession: true,
    hydrateNextSession: true,
  });
});

test("删除支线时只移除目标会话，不影响其他项顺序", () => {
  const sessions = [
    { id: "session-1", title: "一", model: "deepseek-chat", provider: "deepseek", updatedAt: "" },
    { id: "session-2", title: "二", model: "deepseek-chat", provider: "deepseek", updatedAt: "" },
    { id: "session-3", title: "三", model: "deepseek-chat", provider: "deepseek", updatedAt: "" },
  ];

  const next = removeSessionFromList(sessions, "session-2");

  assert.deepEqual(next.map((session) => session.id), ["session-1", "session-3"]);
});
