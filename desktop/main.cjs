const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { Library, Files, atomic } = require("./storage.cjs");
const { decode } = require("./core.cjs");
const { Updates } = require("./updater.bundle.cjs");
app.setName("Pegbar Studio");
const customProfile = !!(
  process.env.PEGBAR_TEST_PROFILE && process.env.PEGBAR_DISABLE_UPDATES === "1"
);
const profile = () =>
  customProfile
    ? path.resolve(process.env.PEGBAR_TEST_PROFILE)
    : path.join(app.getPath("appData"), "Pegbar Studio");
// 1.0.x kept its library in a profile named after the old brand. Adopt that
// folder once, by rename, so existing projects, revisions and verified backups
// stay visible in the library. Nothing is deleted and nothing is left behind:
// a failed rename simply leaves the old folder untouched.
const LEGACY_PROFILE = "Luno Studio";
async function adoptLegacyProfile(current) {
  try {
    const legacy = path.join(app.getPath("appData"), LEGACY_PROFILE);
    if (path.resolve(legacy) === path.resolve(current)) return null;
    const [here, there] = await Promise.all([
      fs.stat(current).then(() => true, () => false),
      fs.stat(legacy).then(() => true, () => false),
    ]);
    if (here || !there) return null;
    await fs.rename(legacy, current);
    return legacy;
  } catch {
    return null;
  }
}
app.setPath("userData", profile());
let main,
  startup,
  library,
  files,
  updates,
  allowQuit = false,
  closing = false,
  rendererReady = false,
  pending = process.argv.find((s) => s.toLowerCase().endsWith(".lam"));
const trusted = pathToFileURL(
    path.join(__dirname, "..", "dist", "index.html"),
  ).href,
  dev = process.env.PEGBAR_DEV_URL;
const preparations = new Map();
function assert(event) {
  if (
    event.sender !== main?.webContents ||
    event.senderFrame !== main.webContents.mainFrame
  )
    throw new Error("Untrusted frame.");
  const url = event.senderFrame.url;
  if (
    app.isPackaged
      ? url !== trusted
      : dev
        ? !url.startsWith(new URL(dev).origin + "/")
        : url !== trusted
  )
    throw new Error("Untrusted origin.");
}
const handle = (name, callback) =>
  ipcMain.handle(`studio:${name}`, async (event, ...args) => {
    assert(event);
    return callback(...args);
  });
function emit(type, data) {
  main?.webContents.send(`studio:${type}`, data);
}
async function prepare() {
  if (!rendererReady) throw new Error("Studio is still opening.");
  const id = randomUUID();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      preparations.delete(id);
      reject(new Error("Renderer did not finish a durable save."));
    }, 45000);
    preparations.set(id, { resolve, reject, timer });
    emit("prepare", id);
  });
  await library.queue;
}
async function closeSafely() {
  if (closing || allowQuit) return;
  closing = true;
  try {
    await prepare();
    allowQuit = true;
    app.quit();
  } catch (error) {
    const result = await dialog.showMessageBox(main, {
      type: "warning",
      buttons: ["Keep editing", "Quit without latest library save"],
      defaultId: 0,
      cancelId: 0,
      title: "Save not complete",
      message: "The local save could not finish.",
      detail: `${error.message} Export an independent .lam copy before quitting.`,
    });
    if (result.response === 1) {
      allowQuit = true;
      app.quit();
    }
  } finally {
    closing = false;
  }
}
async function deliver(file) {
  try {
    const opened = await files.approve(file);
    if (rendererReady) {
      emit("open", opened);
      pending = null;
    } else pending = file;
  } catch (error) {
    pending = null;
    await dialog.showMessageBox(main ?? startup, {
      type: "error",
      title: "Project not opened",
      message: error.message,
      detail:
        "Your original file has not been changed. Pegbar Studio 2.0 reads 1.0 projects and its own, not the abandoned pre-1.0 format.",
    });
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_e, args) => {
    const file = args.find((s) => s.toLowerCase().endsWith(".lam"));
    if (file) void deliver(file);
    if (main?.isVisible()) {
      main.show();
      main.focus();
    }
  });
  app.on("open-file", (e, file) => {
    e.preventDefault();
    if (files) void deliver(file);
    else pending = file;
  });
  app
    .whenReady()
    .then(async () => {
      if (!customProfile) await adoptLegacyProfile(app.getPath("userData"));
      library = new Library(app.getPath("userData"));
      await library.initial;
      files = new Files(app.getPath("userData"));
      const started = Date.now();
      startup = new BrowserWindow({
        width: 340,
        height: 196,
        frame: false,
        resizable: false,
        show: false,
        backgroundColor: "#191b22",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      await startup.loadFile(path.join(__dirname, "startup.html"));
      startup.show();
      main = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 800,
        minHeight: 640,
        title: "Pegbar Studio",
        show: false,
        backgroundColor: "#14151b",
        icon: path.join(__dirname, "..", "assets", "icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          partition: "persist:pegbar-studio-v1",
          webSecurity: true,
        },
      });
      main.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      main.webContents.on("will-navigate", (e, url) => {
        if (url !== (dev && !app.isPackaged ? dev : trusted))
          e.preventDefault();
      });
      main.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
        cb(false),
      );
      main.on("close", (event) => {
        if (!allowQuit && rendererReady) {
          event.preventDefault();
          void closeSafely();
        }
      });
      main.on("closed", () => {
        main = null;
        updates?.dispose();
      });
      updates = new Updates({
        app,
        send: (value) => emit("update", value),
        prepare,
        backup: () => library.backup(),
        quit: () => {
          allowQuit = true;
        },
      });
      handle("ready", async () => {
        if (rendererReady) return;
        rendererReady = true;
        const wait = Math.max(0, 600 - (Date.now() - started));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        startup?.close();
        startup = null;
        main.show();
        main.focus();
        if (pending) await deliver(pending);
        void updates.initialize();
      });
      ipcMain.on("studio:prepared", (event, id, error) => {
        assert(event);
        const task = preparations.get(id);
        if (!task) return;
        clearTimeout(task.timer);
        preparations.delete(id);
        error
          ? task.reject(new Error(String(error).slice(0, 500)))
          : task.resolve();
      });
      handle("library-list", () => library.list());
      handle("library-load", (id) => library.load(id));
      handle("library-save", (bytes, thumb, workspace) =>
        library.save(bytes, thumb, workspace),
      );
      handle("library-delete", (id) => library.delete(id));
      handle("library-backups", () => library.backups());
      handle("library-backup", () => library.backup());
      handle("library-restore", (id) => library.restore(id));
      handle("file-open", async () => {
        const result = await dialog.showOpenDialog(main, {
          title: "Open Pegbar Studio project",
          properties: ["openFile"],
          filters: [{ name: "Pegbar Studio 1.0", extensions: ["lam"] }],
        });
        return result.canceled ? null : files.approve(result.filePaths[0]);
      });
      handle("file-save", async (bytes, title, token, hash) => {
        decode(Buffer.from(bytes));
        if (!token) {
          const result = await dialog.showSaveDialog(main, {
            title: "Save Pegbar Studio project",
            defaultPath: `${String(title)
              .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
              .slice(0, 100)}.lam`,
            filters: [{ name: "Pegbar Studio project", extensions: ["lam"] }],
          });
          if (result.canceled || !result.filePath) return null;
          const target = await files.target(result.filePath);
          token = target.token;
          hash = target.hash;
        }
        return files.save(bytes, token, hash);
      });
      handle("file-export", async (bytes, name, extension) => {
        if (
          !["png", "svg", "mp4", "zip", "lam"].includes(extension) ||
          !(bytes instanceof Uint8Array) ||
          bytes.length > 128_000_000
        )
          throw new Error("Invalid export.");
        const result = await dialog.showSaveDialog(main, {
          title: "Export creative work",
          defaultPath: `${String(name)
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
            .slice(0, 100)}.${extension}`,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        });
        if (result.canceled || !result.filePath) return false;
        await atomic(result.filePath, Buffer.from(bytes));
        return true;
      });
      handle("external", (url) => {
        if (
          typeof url !== "string" ||
          !url.startsWith("https://github.com/Dinomax2005/luno-animate")
        )
          throw new Error("External destination is not allowed.");
        return shell.openExternal(url);
      });
      handle("update-state", () => updates.state);
      handle("update-check", () => updates.check());
      handle("update-download", () => updates.download());
      handle("update-install", () => updates.install());
      handle("update-defer", () => updates.defer());
      ipcMain.on("studio:activity", (event, safe, last) => {
        assert(event);
        updates.activity(safe, last);
      });
      const send = (id) => emit("command", id);
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "File",
            submenu: [
              {
                label: "New project",
                accelerator: "CmdOrCtrl+N",
                click: () => send("new"),
              },
              {
                label: "Open…",
                accelerator: "CmdOrCtrl+O",
                click: () => send("open"),
              },
              {
                label: "Save",
                accelerator: "CmdOrCtrl+S",
                click: () => send("save"),
              },
              {
                label: "Save As…",
                accelerator: "CmdOrCtrl+Shift+S",
                click: () => send("save-as"),
              },
              {
                label: "Export…",
                accelerator: "CmdOrCtrl+E",
                click: () => send("export"),
              },
              { type: "separator" },
              { label: "Project library", click: () => send("home") },
              { role: "quit" },
            ],
          },
          {
            label: "Edit",
            submenu: [
              {
                label: "Undo",
                accelerator: "CmdOrCtrl+Z",
                click: () => send("undo"),
              },
              {
                label: "Redo",
                accelerator: "CmdOrCtrl+Shift+Z",
                click: () => send("redo"),
              },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
            ],
          },
          {
            label: "Animation",
            submenu: [
              { label: "Insert keyframe", click: () => send("key") },
              {
                label: "Duplicate next cel",
                click: () => send("duplicate-cel"),
              },
              { label: "Blank next cel", click: () => send("blank") },
              { label: "Armature", click: () => send("armature") },
            ],
          },
          {
            label: "Help",
            submenu: [
              { label: "Tools & shortcuts", click: () => send("reference") },
              { label: "Workspace setup", click: () => send("setup") },
              { label: "Updates & backups", click: () => send("updates") },
              { label: "About & licence", click: () => send("about") },
            ],
          },
        ]),
      );
      if (dev && !app.isPackaged) await main.loadURL(dev);
      else
        await main.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    })
    .catch(async (error) => {
      console.error(error);
      await dialog.showMessageBox({
        type: "error",
        title: "Studio could not start",
        message: String(error.message),
        detail: "No existing project library was migrated or removed.",
      });
      app.quit();
    });
  app.on("before-quit", (e) => {
    if (!allowQuit && rendererReady && main) {
      e.preventDefault();
      void closeSafely();
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" || allowQuit) app.quit();
  });
}
