const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { newerStable, safeToPrepare, safeToAutoInstall, COUNTDOWN_SECONDS } = require('./update-policy.cjs');
const GITHUB_FEED = Object.freeze({ provider: 'github', owner: 'Dinomax2005', repo: 'luno-animate', private: false, releaseType: 'release' });
class SafeUpdater {
  constructor({ app, send, prepare, backup, allowQuit, sdk }) {
    this.app = app; this.send = send; this.prepare = prepare; this.backup = backup; this.allowQuit = allowQuit; this.sdk = sdk || require('electron-updater').autoUpdater;
    this.sdk.autoInstallOnAppQuit = false; this.sdk.autoDownload = false; this.sdk.allowDowngrade = false;
    this.activity = { busy: true, playing: false, interacting: false, dirty: true, lastActivity: Date.now() };
    this.state = { phase: 'idle', version: null, progress: 0, message: 'Updates come from official Luno GitHub releases.', checkedAt: null, countdown: null, automatic: true, backupId: null };
    this.supported = false; this.installing = false; this.download = null; this.deferredUntil = 0; this.timers = [];
  }
  change(patch) { this.state = { ...this.state, ...patch }; this.send(this.state); }
  async initialize(automatic = true) {
    this.state.automatic = automatic;
    if (!this.app.isPackaged || process.env.LUNO_DISABLE_UPDATES === '1') { this.change({ phase: 'disabled', message: 'Development builds do not install updates. Packaged releases check GitHub.' }); return; }
    if (process.platform === 'linux' && !process.env.APPIMAGE) { this.change({ phase: 'disabled', message: 'This installation is managed by your system package manager. Use the AppImage for automatic updates, or install a newer DEB from GitHub.' }); return; }
    if (process.platform === 'darwin') {
      try { const { stderr } = await promisify(execFile)('/usr/bin/codesign', ['-dv', '--verbose=4', this.app.getPath('exe')]); if (!/Authority=Developer ID Application:/.test(stderr) || /Signature=adhoc/.test(stderr)) throw new Error('Unsigned build'); }
      catch { this.change({ phase: 'disabled', message: 'Automatic macOS updates require a Developer ID signed app. This development build is unsigned; install a newer signed release from GitHub.' }); return; }
    }
    this.supported = true;
    this.sdk.setFeedURL(GITHUB_FEED); this.sdk.autoDownload = false; this.sdk.autoInstallOnAppQuit = false;
    this.sdk.allowPrerelease = false; this.sdk.allowDowngrade = false; this.sdk.fullChangelog = false;
    this.sdk.on('checking-for-update', () => this.change({ phase: 'checking', countdown: null, message: 'Checking GitHub for a newer stable release…' }));
    this.sdk.on('update-not-available', () => this.change({ phase: 'current', checkedAt: Date.now(), message: 'You are using the latest published stable version.', countdown: null }));
    this.sdk.on('update-available', info => {
      if (!newerStable(info.version, this.app.getVersion())) { this.change({ phase: 'current', message: 'No newer stable version is available.', checkedAt: Date.now() }); return; }
      this.change({ phase: 'available', version: info.version, progress: 0, checkedAt: Date.now(), message: `Luno ${info.version} is available. Your projects stay on this device.` });
      if (this.state.automatic) void this.startDownload();
    });
    this.sdk.on('download-progress', progress => this.change({ phase: 'downloading', progress: Math.min(100, Math.max(0, progress.percent)), countdown: null, message: 'Downloading and verifying the update. Keep creating.' }));
    this.sdk.on('update-downloaded', info => {
      if (!newerStable(info.version, this.app.getVersion()) || (this.state.version && info.version !== this.state.version)) { this.fail(new Error('Unexpected update version. Installation was blocked.')); return; }
      this.change({ phase: 'ready', version: info.version, progress: 100, message: 'Update verified. Luno will save and back up your library before restarting.', countdown: null });
    });
    this.sdk.on('error', error => this.fail(error));
    this.timers.push(setInterval(() => this.tick(), 1000));
    this.timers.push(setTimeout(() => { if (this.state.automatic) void this.check(); }, 20_000));
    this.timers.push(setInterval(() => { if (this.state.automatic && !['downloading', 'preparing', 'installing', 'ready', 'waiting'].includes(this.state.phase)) void this.check(); }, 6 * 60 * 60 * 1000));
    for (const timer of this.timers) timer.unref?.();
    this.change({ message: automatic ? 'Automatic updates are on. Restarts only happen after an idle warning, a durable save, and a verified backup.' : 'Automatic updates are off. You can check and install an update here.' });
  }
  async check() {
    if (!this.supported || this.installing || ['checking', 'downloading', 'ready', 'waiting'].includes(this.state.phase)) return;
    try { await this.sdk.checkForUpdates(); } catch (error) { this.fail(error); }
  }
  async startDownload() {
    if (!this.supported || this.download || this.state.phase !== 'available') return;
    this.change({ phase: 'downloading', progress: 0, message: 'Downloading the newer version. Your editor stays open.' });
    try { this.download = this.sdk.downloadUpdate(); await this.download; } catch (error) { this.fail(error); } finally { this.download = null; }
  }
  updateActivity(value) {
    if (!value || ['busy', 'playing', 'interacting', 'dirty'].some(k => typeof value[k] !== 'boolean') || !Number.isFinite(value.lastActivity)) return;
    this.activity = { ...value, lastActivity: Math.min(Date.now(), value.lastActivity) };
    if (this.state.countdown !== null && !safeToAutoInstall(this.activity, Date.now())) this.change({ phase: 'ready', countdown: null, message: 'Restart paused while you work. Your downloaded update is ready whenever you are.' });
  }
  setAutomatic(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Invalid update preference.');
    this.change({ automatic: enabled, countdown: null, ...(this.state.phase === 'waiting' ? { phase: 'ready' } : {}) });
    if (enabled && this.state.phase === 'available') void this.startDownload();
  }
  defer() { this.deferredUntil = Date.now() + 4 * 60 * 60 * 1000; this.change({ countdown: null, ...(this.state.phase === 'waiting' ? { phase: 'ready' } : {}), message: 'Restart postponed for four hours. You can restart sooner from Updates.' }); }
  tick() {
    if (!this.supported || !this.state.automatic || this.installing || this.deferredUntil > Date.now() || !['ready', 'waiting'].includes(this.state.phase)) return;
    if (!safeToAutoInstall(this.activity, Date.now())) { if (this.state.countdown !== null) this.change({ phase: 'ready', countdown: null }); return; }
    const next = this.state.countdown === null ? COUNTDOWN_SECONDS : this.state.countdown - 1;
    if (next <= 0) { void this.install(); return; }
    this.change({ phase: 'waiting', countdown: next, message: `Your studio is idle. Save, back up, and restart in ${next} seconds. Any activity pauses this countdown.` });
  }
  async install() {
    if (this.state.phase === 'available') { await this.startDownload(); return; }
    if (!this.supported || this.installing || !['ready', 'waiting'].includes(this.state.phase)) return;
    if (!safeToPrepare(this.activity)) { this.change({ phase: 'ready', countdown: null, message: 'Finish playback, your current gesture, or the export before restarting. Nothing has been closed.' }); return; }
    this.installing = true;
    try {
      this.change({ phase: 'preparing', countdown: null, message: 'Saving your latest changes and checking your work…' });
      await this.prepare('update');
      if (!this.installing || this.state.phase !== 'preparing') throw new Error('Update verification is no longer valid.');
      const info = await this.backup(`before-update-${this.state.version}`);
      if (!this.installing || this.state.phase !== 'preparing') throw new Error('Update verification was interrupted.');
      this.change({ phase: 'installing', backupId: info.id, message: 'Your library is saved and its backup has been verified. Restarting to install the update…' });
      this.allowQuit(true); this.sdk.quitAndInstall(true, true);
    } catch (error) {
      this.allowQuit(false); this.installing = false; this.change({ phase: 'ready', countdown: null, message: `Update NOT installed: ${error.message || 'save or backup failed'}. Your studio remains open.` });
      this.send(null); this.deferredUntil = Date.now() + 30 * 60 * 1000;
    }
  }
  fail(error) {
    if (this.installing) { this.installing = false; this.allowQuit(false); this.send(null); }
    const message = String(error?.message ?? error);
    if (/404|No published versions|Cannot find latest|Unable to find latest|No releases/i.test(message)) this.change({ phase: 'unpublished', checkedAt: Date.now(), countdown: null, message: 'No compatible published stable release is available yet. GitHub Actions downloads are not an update feed. Your work is unchanged.' });
    else this.change({ phase: 'error', checkedAt: Date.now(), countdown: null, message: `The update could not be verified: ${message.slice(0, 400)}. Your work is unchanged.` });
  }
  dispose() { for (const timer of this.timers) { clearTimeout(timer); clearInterval(timer); } this.timers = []; }
}
module.exports = { SafeUpdater, GITHUB_FEED };
