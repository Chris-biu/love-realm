import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEnvContent,
  resolveLocalDataDir,
  toPrismaFileUrl,
} from "./setup-local-env.mjs";

test("uses LOCALAPPDATA for the default Windows data directory", () => {
  assert.equal(
    resolveLocalDataDir({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\demo\\AppData\\Local" },
      homeDir: "C:\\Users\\demo",
    }),
    "C:\\Users\\demo\\AppData\\Local\\love-realm",
  );
});

test("lets LOVE_REALM_DATA_DIR override the operating system data directory", () => {
  assert.equal(
    resolveLocalDataDir({
      platform: "win32",
      env: { LOVE_REALM_DATA_DIR: "D:\\private\\love-realm" },
      homeDir: "C:\\Users\\demo",
    }),
    "D:\\private\\love-realm",
  );
});

test("formats Windows database paths as Prisma SQLite file URLs", () => {
  assert.equal(
    toPrismaFileUrl("C:\\Users\\demo\\AppData\\Local\\love-realm\\love-realm.db"),
    "file:C:/Users/demo/AppData/Local/love-realm/love-realm.db",
  );
});

test("updates DATABASE_URL while preserving existing DeepSeek settings", () => {
  const content = buildEnvContent(
    [
      'DATABASE_URL="file:./dev.db"',
      'DEEPSEEK_API_KEY="abc"',
      'DEEPSEEK_BASE_URL="https://api.deepseek.com"',
      'DEFAULT_DEEPSEEK_MODEL="deepseek-v4-flash"',
    ].join("\n"),
    "file:C:/Users/demo/AppData/Local/love-realm/love-realm.db",
  );

  assert.match(content, /DATABASE_URL="file:C:\/Users\/demo\/AppData\/Local\/love-realm\/love-realm\.db"/);
  assert.match(content, /DEEPSEEK_API_KEY="abc"/);
  assert.doesNotMatch(content, /file:\.\/dev\.db/);
});
