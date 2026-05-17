import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESKTOP_BUILD_DIR = path.join(PROJECT_ROOT, ".desktop");
const ELECTRON_APP_DIR = path.join(DESKTOP_BUILD_DIR, "electron-app");
const DESKTOP_STANDALONE_DIR = path.join(DESKTOP_BUILD_DIR, "standalone");
const TEMPLATE_DB_DIR = path.join(DESKTOP_BUILD_DIR, "db-template");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "dist-desktop");
const ELECTRON_CACHE_DIR = path.join(process.env.LOCALAPPDATA ?? "", "electron", "Cache");

function run(command, args) {
  const useShell = process.platform === "win32";
  const result = spawnSync(useShell ? [command, ...args].join(" ") : command, useShell ? [] : args, {
    cwd: PROJECT_ROOT,
    shell: useShell,
    stdio: "inherit",
    env: process.env,
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

function copyResource(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

function assertExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} was not found at ${filePath}`);
  }
}

async function main() {
  run(npmCommand(), ["run", "desktop:prepare"]);

  const rootPackage = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const electronVersion = rootPackage.devDependencies?.electron?.replace(/^[^\d]*/, "") || "42.0.1";

  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const appPaths = await packager({
    dir: ELECTRON_APP_DIR,
    name: "Love Realm",
    platform: "win32",
    arch: "x64",
    out: OUTPUT_DIR,
    overwrite: true,
    icon: path.join(PROJECT_ROOT, "desktop", "icon.ico"),
    electronVersion,
    electronZipDir: ELECTRON_CACHE_DIR,
    prune: true,
    tmpdir: false,
    quiet: false,
  });

  for (const appPath of appPaths) {
    const resourcesDir = path.join(appPath, "resources");
    copyResource(DESKTOP_STANDALONE_DIR, path.join(resourcesDir, "standalone"));
    copyResource(TEMPLATE_DB_DIR, path.join(resourcesDir, "db-template"));
    assertExists(path.join(resourcesDir, "standalone", "server.js"), "Bundled standalone server");
    assertExists(path.join(appPath, "Love Realm.exe"), "Desktop executable");
  }

  console.log(`Desktop app packaged successfully at ${appPaths.join(", ")}`);
}

await main();
