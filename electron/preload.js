import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("appApi", {
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (state) => ipcRenderer.invoke("state:save", state)
});
