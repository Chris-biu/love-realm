import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionUrl } from "./session-url";

test("为空路径时生成默认会话地址", () => {
  assert.equal(buildSessionUrl("", "session-1"), "/?session=session-1");
});

test("保留原有查询参数并覆盖 session", () => {
  assert.equal(
    buildSessionUrl("/?foo=bar&session=old-session", "new-session"),
    "/?foo=bar&session=new-session",
  );
});

test("保留 hash 片段", () => {
  assert.equal(
    buildSessionUrl("/play?chapter=2#scene-top", "session-9"),
    "/play?chapter=2&session=session-9#scene-top",
  );
});
