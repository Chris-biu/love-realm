const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const {
  DESKTOP_PORT,
  findAvailablePort,
  resolveDatabasePath,
  resolveDatabaseUrl,
  resolveServerEntry,
} = require("./paths.cjs");

let mainWindow = null;

function resolveTemplateDatabasePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "db-template", "love-realm.db");
  }

  return path.join(app.getAppPath(), ".desktop", "db-template", "love-realm.db");
}

function ensureUserDatabase() {
  const userDataPath = app.getPath("userData");
  const databasePath = resolveDatabasePath(userDataPath);
  const templatePath = resolveTemplateDatabasePath();

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  if (!fs.existsSync(databasePath) && fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, databasePath);
  }

  return databasePath;
}

function waitForHttpServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", (error) => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(error);
          return;
        }

        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

async function startStandaloneServer() {
  const port = await findAvailablePort(DESKTOP_PORT);
  const serverEntry = resolveServerEntry({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Next standalone server was not found at ${serverEntry}. Run npm run desktop:prepare first.`);
  }

  ensureUserDatabase();

  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.DATABASE_URL = resolveDatabaseUrl(app.getPath("userData"));
  process.env.DEEPSEEK_BASE_URL ||= "https://api.deepseek.com";
  process.env.DEFAULT_DEEPSEEK_MODEL ||= "deepseek-v4-flash";

  process.chdir(path.dirname(serverEntry));
  require(serverEntry);

  const url = `http://127.0.0.1:${port}`;
  await waitForHttpServer(url);
  return url;
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: "#17120f",
    title: "Love Realm",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(startUrl);
}

async function boot() {
  try {
    const startUrl = await startStandaloneServer();
    createWindow(startUrl);
  } catch (error) {
    dialog.showErrorBox("Love Realm failed to start", error instanceof Error ? error.message : String(error));
    app.quit();
  }
}

app.setName("Love Realm");
app.setAppUserModelId("com.love-realm.desktop");

app.whenReady().then(boot);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow) {
    mainWindow.show();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
