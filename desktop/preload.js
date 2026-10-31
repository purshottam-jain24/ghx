const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) =>
  ipcRenderer.invoke(channel, ...args).then((res) => {
    if (!res.ok) throw new Error(res.error);
    return res.data;
  });

contextBridge.exposeInMainWorld("ghx", {
  info: () => invoke("app:info"),
  accounts: {
    list: () => invoke("accounts:list"),
    create: (data) => invoke("accounts:create", data),
    remove: (id, opts) => invoke("accounts:remove", id, opts),
    verify: (id) => invoke("accounts:verify", id),
    publicKey: (id) => invoke("accounts:publicKey", id),
    keyExists: (data) => invoke("accounts:keyExists", data),
    detect: () => invoke("accounts:detect"),
    import: (data) => invoke("accounts:import", data),
    removeDetected: (data) => invoke("accounts:removeDetected", data),
  },
  repos: {
    fetch: (token) => invoke("repos:fetch", token),
    sync: (opts) => invoke("repos:sync", opts),
    onProgress: (cb) => {
      const listener = (_e, event) => cb(event);
      ipcRenderer.on("repos:progress", listener);
      return () => ipcRenderer.removeListener("repos:progress", listener);
    },
  },
  pickFolder: (defaultPath) => invoke("dialog:pickFolder", defaultPath),
  openExternal: (url) => invoke("shell:openExternal", url),
  openPath: (p) => invoke("shell:openPath", p),
  copy: (text) => invoke("clipboard:write", text),
});
