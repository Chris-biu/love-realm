import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_FILE_NAME = "love-realm.db";

function quoteEnvValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function parseEnvLines(content) {
  const values = new Map();

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;

    const rawValue = match[2].trim();
    values.set(match[1], rawValue.replace(/^"(.*)"$/, "$1"));
  }

  return values;
}

export function resolveLocalDataDir(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();

  if (env.LOVE_REALM_DATA_DIR) {
    return path.resolve(env.LOVE_REALM_DATA_DIR);
  }

  if (platform === "win32") {
    return path.join(env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"), "love-realm");
  }

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "love-realm");
  }

  return path.join(env.XDG_DATA_HOME || path.join(homeDir, ".local", "share"), "love-realm");
}

export function toPrismaFileUrl(filePath) {
  return `file:${path.resolve(filePath).replaceAll("\\", "/")}`;
}

export function buildEnvContent(existingContent, databaseUrl) {
  const existing = parseEnvLines(existingContent || "");

  const orderedValues = [
    ["DATABASE_URL", databaseUrl],
    ["DEEPSEEK_API_KEY", existing.get("DEEPSEEK_API_KEY") ?? ""],
    ["DEEPSEEK_BASE_URL", existing.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com"],
    ["DEFAULT_DEEPSEEK_MODEL", existing.get("DEFAULT_DEEPSEEK_MODEL") ?? "deepseek-v4-flash"],
  ];

  return `${orderedValues.map(([key, value]) => `${key}=${quoteEnvValue(value)}`).join("\n")}\n`;
}

export function setupLocalEnv(options = {}) {
  const projectRoot = options.projectRoot ?? PROJECT_ROOT;
  const envPath = path.join(projectRoot, ".env");
  const localDataDir = resolveLocalDataDir(options);
  const databasePath = path.join(localDataDir, DATABASE_FILE_NAME);
  const databaseUrl = toPrismaFileUrl(databasePath);
  const existingContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  mkdirSync(localDataDir, { recursive: true });
  writeFileSync(envPath, buildEnvContent(existingContent, databaseUrl), "utf8");

  return { envPath, localDataDir, databasePath, databaseUrl };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = setupLocalEnv();
  console.log(`DATABASE_URL=${result.databaseUrl}`);
  console.log(`Local data directory: ${result.localDataDir}`);
}
