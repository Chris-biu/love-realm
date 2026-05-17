import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESKTOP_BUILD_DIR = path.join(PROJECT_ROOT, ".desktop");
const ELECTRON_APP_DIR = path.join(DESKTOP_BUILD_DIR, "electron-app");
const DESKTOP_STANDALONE_DIR = path.join(DESKTOP_BUILD_DIR, "standalone");
const TEMPLATE_DB_DIR = path.join(DESKTOP_BUILD_DIR, "db-template");
const TEMPLATE_DB_PATH = path.join(TEMPLATE_DB_DIR, "love-realm.db");

function run(command, args, options = {}) {
  const useShell = process.platform === "win32";
  const result = spawnSync(useShell ? [command, ...args].join(" ") : command, useShell ? [] : args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...options.env },
    shell: useShell,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

function prepareStandaloneAssets() {
  const standaloneDir = path.join(PROJECT_ROOT, ".next", "standalone");

  copyIfExists(path.join(PROJECT_ROOT, "public"), path.join(standaloneDir, "public"));
  copyIfExists(path.join(PROJECT_ROOT, ".next", "static"), path.join(standaloneDir, ".next", "static"));
  copyIfExists(standaloneDir, DESKTOP_STANDALONE_DIR);
}

function prepareElectronApp() {
  const rootPackage = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const electronVersion = rootPackage.devDependencies?.electron?.replace(/^[^\d]*/, "") || "42.0.1";
  const packageJson = {
    name: "love-realm-desktop",
    version: rootPackage.version,
    private: true,
    main: "desktop/main.cjs",
    productName: "Love Realm",
    devDependencies: {
      electron: rootPackage.devDependencies?.electron ?? `^${electronVersion}`,
    },
  };

  rmSync(ELECTRON_APP_DIR, { recursive: true, force: true });
  mkdirSync(ELECTRON_APP_DIR, { recursive: true });
  cpSync(path.join(PROJECT_ROOT, "desktop"), path.join(ELECTRON_APP_DIR, "desktop"), { recursive: true });
  writeJson(path.join(ELECTRON_APP_DIR, "package.json"), packageJson);
}

async function applyInitSql(databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const initSql = readFileSync(path.join(PROJECT_ROOT, "prisma", "init.sql"), "utf8");
  const statements = initSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function prepareTemplateDatabase() {
  rmSync(TEMPLATE_DB_DIR, { recursive: true, force: true });
  mkdirSync(TEMPLATE_DB_DIR, { recursive: true });

  const databaseUrl = `file:${TEMPLATE_DB_PATH.replaceAll("\\", "/")}`;
  const env = { DATABASE_URL: databaseUrl };

  await applyInitSql(databaseUrl);
  run(npxCommand(), ["tsx", "prisma/seed.ts"], { env });
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(filePath, content, "utf8");
}

run(npmCommand(), ["run", "build"]);
prepareStandaloneAssets();
await prepareTemplateDatabase();
prepareElectronApp();

console.log(`Desktop standalone prepared at ${path.join(PROJECT_ROOT, ".next", "standalone")}`);
console.log(`Desktop database template prepared at ${TEMPLATE_DB_PATH}`);
console.log(`Electron app prepared at ${ELECTRON_APP_DIR}`);
