/**
 * GHX - GitHub Account Manager
 * Copyright (c) 2026 Purshottam Jain
 * All rights reserved.
 *
 * Electron main process: owns all filesystem/SSH/git work and exposes it to
 * the renderer through a small IPC surface (see preload.js).
 */

const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  nativeTheme,
} = require("electron");

// Apps launched from Finder/Dock get a minimal PATH, which hides Homebrew git
if (process.platform === "darwin") {
  const extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  const current = (process.env.PATH || "").split(":");
  process.env.PATH = [...new Set([...current, ...extra])].join(":");
}

const accounts = require("../src/core/accounts");
const { fetchRepos, syncRepos } = require("../src/core/repos");
const {
  detectAccounts,
  importAccount,
  removeDetected,
} = require("../src/core/detect");
const { CONFIG_PATH, SSH_DIR } = require("../src/utils/paths");
const { WINDOWS_AGENT_HINT } = require("../src/ssh/agent");
const packageJson = require("../package.json");

const ALLOWED_EXTERNAL = /^https:\/\/(github\.com|docs\.github\.com)(\/|$)/;

let mainWindow;
// Fetched repos are kept here so the renderer only sends back names to sync
let repoCache = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 560,
    minHeight: 520,
    show: false,
    title: "GHX",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0d1117" : "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Never let the app window navigate away or open arbitrary windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_EXTERNAL.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
}

// Wraps handlers so the renderer always gets { ok, data } or { ok, error }
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
}

function simplifyRepo(r) {
  return {
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    fork: r.fork,
    archived: r.archived,
    description: r.description,
    language: r.language,
    updated_at: r.updated_at,
  };
}

function registerIpc() {
  handle("app:info", () => ({
    version: packageJson.version,
    platform: process.platform,
    configPath: CONFIG_PATH,
    sshDir: SSH_DIR,
    homeDir: os.homedir(),
    agentHint: process.platform === "win32" ? WINDOWS_AGENT_HINT : null,
  }));

  handle("accounts:list", () => accounts.listAccounts());
  handle("accounts:create", (data) => accounts.createAccount(data));
  handle("accounts:remove", (id, opts) => accounts.removeAccount(id, opts));
  handle("accounts:verify", (id) =>
    accounts.verifyAccount(id, { batch: true })
  );
  handle("accounts:detect", () => detectAccounts());
  handle("accounts:import", (data) => importAccount(data));
  handle("accounts:removeDetected", (data) => removeDetected(data));
  handle("accounts:publicKey", (id) => accounts.getPublicKey(id));
  handle("accounts:keyExists", async ({ suffix }) => {
    const list = await accounts.listAccounts();
    const { keyPath } = accounts.accountPaths(
      list.length === 0,
      (suffix || "").trim().toLowerCase()
    );
    return (await fs.pathExists(keyPath)) ? keyPath : null;
  });

  handle("repos:fetch", async (token) => {
    const repos = await fetchRepos(token);
    repoCache = new Map(repos.map((r) => [r.full_name, r]));
    return repos.map(simplifyRepo);
  });

  handle("repos:sync", async ({ accountId, repoNames, baseDir }) => {
    const account = await accounts.getAccount(accountId);
    const repos = repoNames.map((n) => repoCache.get(n)).filter(Boolean);
    if (!repos.length) throw new Error("No repositories selected.");

    await accounts.updateAccount(accountId, { baseDir });
    const sender = mainWindow.webContents;
    return syncRepos({
      account,
      repos,
      baseDir,
      onProgress: (event) => {
        if (!sender.isDestroyed()) sender.send("repos:progress", event);
      },
    });
  });

  handle("dialog:pickFolder", async (defaultPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose where to clone repositories",
      defaultPath: defaultPath || os.homedir(),
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  handle("shell:openExternal", (url) => {
    if (!ALLOWED_EXTERNAL.test(url)) throw new Error("URL not allowed.");
    return shell.openExternal(url);
  });
  handle("shell:openPath", (p) => shell.openPath(p));
  handle("clipboard:write", (text) => clipboard.writeText(String(text)));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
