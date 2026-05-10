const net = require("node:net");
const path = require("node:path");

const DESKTOP_PORT = 17321;
const DATABASE_FILE_NAME = "love-realm.db";

function toPrismaFileUrl(filePath) {
  return `file:${path.resolve(filePath).replaceAll("\\", "/")}`;
}

function resolveDatabasePath(userDataPath) {
  return path.join(userDataPath, DATABASE_FILE_NAME);
}

function resolveDatabaseUrl(userDataPath) {
  return toPrismaFileUrl(resolveDatabasePath(userDataPath));
}

function resolveServerEntry({ isPackaged, resourcesPath, appPath }) {
  if (isPackaged) {
    return path.join(resourcesPath, "standalone", "server.js");
  }

  return path.join(appPath, ".next", "standalone", "server.js");
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort = DESKTOP_PORT) {
  for (let port = preferredPort; port < preferredPort + 50; port += 1) {
    if (await canListen(port)) return port;
  }

  throw new Error(`No available local port found from ${preferredPort} to ${preferredPort + 49}.`);
}

module.exports = {
  DATABASE_FILE_NAME,
  DESKTOP_PORT,
  findAvailablePort,
  resolveDatabasePath,
  resolveDatabaseUrl,
  resolveServerEntry,
  toPrismaFileUrl,
};
