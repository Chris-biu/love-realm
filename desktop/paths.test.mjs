import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DESKTOP_PORT,
  findAvailablePort,
  resolveDatabaseUrl,
  resolveServerEntry,
  toPrismaFileUrl,
} = require("./paths.cjs");

test("formats Windows paths as Prisma SQLite file URLs", () => {
  assert.equal(
    toPrismaFileUrl("C:\\Users\\demo\\AppData\\Roaming\\Love Realm\\love-realm.db"),
    "file:C:/Users/demo/AppData/Roaming/Love Realm/love-realm.db",
  );
});

test("stores desktop database inside Electron userData", () => {
  assert.equal(
    resolveDatabaseUrl("C:\\Users\\demo\\AppData\\Roaming\\Love Realm"),
    "file:C:/Users/demo/AppData/Roaming/Love Realm/love-realm.db",
  );
});

test("desktop template schema includes dynamic character profile storage", () => {
  const initSql = readFileSync(new URL("../prisma/init.sql", import.meta.url), "utf8");
  assert.match(initSql, /"dynamicProfile"\s+JSONB/);
});

test("resolves standalone server from resources when packaged", () => {
  assert.equal(
    resolveServerEntry({
      isPackaged: true,
      resourcesPath: "C:\\Program Files\\Love Realm\\resources",
      appPath: "C:\\Program Files\\Love Realm\\resources\\app.asar",
    }),
    "C:\\Program Files\\Love Realm\\resources\\standalone\\server.js",
  );
});

test("resolves standalone server from project build during local desktop runs", () => {
  assert.equal(
    resolveServerEntry({
      isPackaged: false,
      resourcesPath: "C:\\repo\\resources",
      appPath: "C:\\repo",
    }),
    "C:\\repo\\.next\\standalone\\server.js",
  );
});

test("finds the next available port when the preferred desktop port is occupied", async () => {
  const server = createServer();
  const preferredPort = await findAvailablePort(DESKTOP_PORT + 100);
  await new Promise((resolve) => server.listen(preferredPort, "127.0.0.1", resolve));

  try {
    const port = await findAvailablePort(preferredPort);
    assert.equal(port, preferredPort + 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
