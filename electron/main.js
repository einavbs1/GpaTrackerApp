import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createFreshState() {
  return {
    lastModified: Date.now(),
    profiles: [],
    activeProfileId: null
  };
}

function getDataFilePath() {
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
  return path.join(baseDir, "app_data.json");
}

function ensureDataFile() {
  const dataFile = getDataFilePath();
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(createFreshState(), null, 2), "utf-8");
  }
  return dataFile;
}

function readState() {
  const dataFile = ensureDataFile();
  try {
    const content = fs.readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Invalid state file content");
    }
    return parsed;
  } catch (_error) {
    const fallback = createFreshState();
    fs.writeFileSync(dataFile, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
}

function writeState(nextState) {
  const dataFile = ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(nextState, null, 2), "utf-8");
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("state:load", () => {
  return readState();
});

ipcMain.handle("state:save", (_event, nextState) => {
  return writeState(nextState);
});

app.whenReady().then(() => {
  ensureDataFile();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
