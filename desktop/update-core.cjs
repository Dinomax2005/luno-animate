const newer = (next, current) => {
  if (!/^1\.\d+\.\d+$/.test(next)) return false;
  const a = next.split(".").map(Number),
    b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};
class Updates {
  constructor({ app, send, prepare, backup, quit, sdk }) {
    this.app = app;
    this.send = send;
    this.prepare = prepare;
    this.backup = backup;
    this.quit = quit;
    this.sdk = sdk || require("electron-updater").autoUpdater;
    this.safe = false;
    this.lastActivity = Date.now();
    this.pausedUntil = 0;
    this.countdown = null;
    this.state = {
      phase: "idle",
      message: "Official Pegbar Studio 1.x updates.",
      version: null,
      percent: 0,
    };
    this.supported = false;
    this.timers = [];
    this.installing = false;
  }
  emit(patch) {
    this.state = { ...this.state, ...patch };
    this.send(this.state);
  }
  async initialize() {
    if (!this.app.isPackaged || process.env.PEGBAR_DISABLE_UPDATES === "1") {
      this.emit({
        phase: "disabled",
        message: "Development builds never install updates.",
      });
      return;
    }
    if (process.platform === "linux" && !process.env.APPIMAGE) {
      this.emit({
        phase: "disabled",
        message:
          "This DEB is managed by your package manager. Install a new official DEB manually, or use AppImage for in-place updates.",
      });
      return;
    }
    if (process.platform === "darwin") {
      try {
        const { execFile } = require("node:child_process"),
          { promisify } = require("node:util"),
          { stderr } = await promisify(execFile)("/usr/bin/codesign", [
            "-dv",
            "--verbose=4",
            this.app.getPath("exe"),
          ]);
        if (!/Authority=Developer ID Application:/.test(stderr))
          throw new Error("Unsigned");
      } catch {
        this.emit({
          phase: "disabled",
          message:
            "Unsigned macOS builds require a manual install. Automatic macOS updates require a Developer ID signed release.",
        });
        return;
      }
    }
    this.supported = true;
    const sdk = this.sdk;
    sdk.autoDownload = false;
    sdk.autoInstallOnAppQuit = false;
    sdk.allowDowngrade = false;
    sdk.allowPrerelease = false;
    sdk.channel = "studio-v1";
    sdk.setFeedURL({
      provider: "github",
      owner: "Dinomax2005",
      repo: "luno-animate",
      channel: "studio-v1",
      private: false,
    });
    sdk.on("checking-for-update", () =>
      this.emit({
        phase: "checking",
        message: "Checking the Studio 1.x release channel…",
      }),
    );
    sdk.on("update-not-available", () =>
      this.emit({
        phase: "current",
        message: "This is the current supported Studio release.",
      }),
    );
    sdk.on("update-available", (info) => {
      if (!newer(info.version, this.app.getVersion())) {
        this.emit({
          phase: "current",
          message: "No newer supported Studio release.",
        });
        return;
      }
      this.emit({
        phase: "available",
        version: info.version,
        percent: 0,
        message: `Pegbar Studio ${info.version} is available. Preparing a verified download.`,
      });
      void this.download();
    });
    sdk.on("download-progress", (progress) =>
      this.emit({
        phase: "downloading",
        percent: Math.max(0, Math.min(100, progress.percent)),
        message: "Downloading and verifying the official update.",
      }),
    );
    sdk.on("update-downloaded", (info) => {
      if (
        !newer(info.version, this.app.getVersion()) ||
        info.version !== this.state.version
      ) {
        this.fail(new Error("Unexpected update version."));
        return;
      }
      this.emit({
        phase: "ready",
        percent: 100,
        message:
          "Update verified. Save external changes before restarting. An idle restart always backs up the library first.",
      });
    });
    sdk.on("error", (e) => this.fail(e));
    this.timers.push(
      setInterval(() => this.tick(), 1000),
      setTimeout(() => void this.check(), 25000),
      setInterval(() => void this.check(), 6 * 60 * 60 * 1000),
    );
    for (const timer of this.timers) timer.unref?.();
  }
  fail(error) {
    this.countdown = null;
    this.emit({
      phase: "error",
      message: `Update not installed: ${String(error.message).slice(0, 500)}`,
    });
  }
  activity(safe, lastActivity) {
    if (typeof safe !== "boolean" || !Number.isFinite(lastActivity)) return;
    this.safe = safe;
    this.lastActivity = Math.min(Date.now(), lastActivity);
    if (!safe && this.countdown !== null) {
      this.countdown = null;
      this.emit({
        phase: "ready",
        message:
          "Restart paused while you work. The verified update remains ready.",
      });
    }
  }
  async check() {
    if (
      !this.supported ||
      this.installing ||
      ["downloading", "ready", "warning"].includes(this.state.phase)
    )
      return;
    try {
      await this.sdk.checkForUpdates();
    } catch (e) {
      this.fail(e);
    }
  }
  async download() {
    if (!this.supported || this.state.phase !== "available") return;
    this.emit({ phase: "downloading", message: "Downloading update…" });
    try {
      await this.sdk.downloadUpdate();
    } catch (e) {
      this.fail(e);
    }
  }
  defer() {
    this.pausedUntil = Date.now() + 4 * 60 * 60 * 1000;
    this.countdown = null;
    this.emit({
      phase: "ready",
      message:
        "Restart deferred for four hours. You can install manually from Updates.",
    });
  }
  tick() {
    if (
      !this.supported ||
      this.installing ||
      Date.now() < this.pausedUntil ||
      !["ready", "warning"].includes(this.state.phase)
    )
      return;
    if (!this.safe || Date.now() - this.lastActivity < 120000) {
      if (this.countdown !== null) {
        this.countdown = null;
        this.emit({
          phase: "ready",
          message: "Idle restart paused. Your verified update stays ready.",
        });
      }
      return;
    }
    this.countdown ??= Date.now() + 30000;
    const seconds = Math.max(
      0,
      Math.ceil((this.countdown - Date.now()) / 1000),
    );
    this.emit({
      phase: "warning",
      message: `Idle restart in ${seconds}s. The library will be saved and verified before installation.`,
    });
    if (!seconds) void this.install();
  }
  async install() {
    if (
      !this.supported ||
      this.installing ||
      !["ready", "warning"].includes(this.state.phase)
    )
      return;
    if (!this.safe) {
      this.emit({
        phase: "ready",
        message:
          "Finish the current operation, stop playback and save any external file changes before restarting.",
      });
      return;
    }
    this.installing = true;
    this.countdown = null;
    this.emit({
      phase: "preparing",
      message: "Saving the library and verifying a pre-update backup…",
    });
    try {
      await this.prepare();
      await this.backup();
      this.quit();
      this.emit({
        phase: "installing",
        message: "Library backed up. Installing official update.",
      });
      this.sdk.quitAndInstall(false, true);
    } catch (e) {
      this.installing = false;
      this.fail(e);
    }
  }
  dispose() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }
}
module.exports = { Updates, newer };
