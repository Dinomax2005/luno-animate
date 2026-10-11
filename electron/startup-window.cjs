const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Separate, unprivileged launcher. The real studio stays hidden until its boot handshake. */
function createStartupWindow({ BrowserWindow, ipcMain, mainWindow, icon, onQuit, now = Date.now, schedule = setTimeout, cancel = clearTimeout, minimumMs = 650 }) {
  const url = pathToFileURL(path.join(__dirname, 'startup.html')).href;
  const splash = new BrowserWindow({
    width: 460, height: 282, title: 'Starting Luno Animate', show: false,
    frame: false, resizable: false, maximizable: false, minimizable: false,
    skipTaskbar: true, backgroundColor: '#101722', icon,
    webPreferences: { preload: path.join(__dirname, 'startup-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, partition: 'luno-startup' },
  });
  splash.setMenu(null); splash.center();
  let shownAt; let painted = false, completed = false, finished = false, disposed = false, loadFailed = false, revealTimer;
  let state = { phase: 'Opening your local studio…', error: null };
  const publish = () => { if (!splash.isDestroyed()) splash.webContents.send('luno:startup-state', state); };
  const report = value => {
    if (disposed || finished) return;
    state = { phase: typeof value?.phase === 'string' ? value.phase.slice(0, 160) : state.phase, error: typeof value?.error === 'string' ? value.error.slice(0, 400) : null };
    if (state.error) { completed = false; if (revealTimer) cancel(revealTimer); revealTimer = undefined; }
    publish();
  };
  const reveal = () => {
    if (shownAt === undefined || !painted || !completed || disposed || finished || revealTimer) return;
    const finish = () => {
      revealTimer = undefined; if (disposed || finished || !completed || state.error || mainWindow.isDestroyed()) return;
      finished = true;
      // Close the small window first. There is no full-window loader in the studio.
      if (!splash.isDestroyed()) splash.destroy();
      mainWindow.show(); mainWindow.focus(); mainWindow.webContents.setBackgroundThrottling?.(true);
      ipcMain.removeListener('luno:startup-action', action);
    };
    const wait = Math.max(0, minimumMs - (now() - shownAt));
    if (wait) revealTimer = schedule(finish, wait); else finish();
  };
  const action = (event, value) => {
    if (disposed || finished || event.sender !== splash.webContents || event.senderFrame !== splash.webContents.mainFrame || event.senderFrame?.url !== url) return;
    if (value === 'quit') onQuit();
    else if (value === 'retry') {
      report({ phase: 'Trying to open your workspace again…' });
      if (loadFailed) { loadFailed = false; void mainWindow.webContents.reload(); }
      else mainWindow.webContents.send('luno:startup-retry');
    }
  };
  ipcMain.on('luno:startup-action', action);
  splash.once('ready-to-show', () => { if (!disposed && !finished && !splash.isDestroyed()) { shownAt = now(); splash.show(); publish(); reveal(); } });
  splash.on('close', () => { if (!finished && !disposed) onQuit(); });
  splash.webContents.on('did-finish-load', publish);
  splash.webContents.on('will-navigate', (event, target) => { if (target !== url) event.preventDefault(); });
  splash.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  splash.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  splash.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.once('ready-to-show', () => { painted = true; reveal(); });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, _url, mainFrame) => {
    if (!mainFrame || code === -3 || finished) return; loadFailed = true;
    report({ phase: 'Your studio could not open', error: `${description || 'The app could not load.'} Retry to reopen the studio. Your project files are unchanged.` });
  });
  mainWindow.webContents.on('render-process-gone', () => {
    if (finished) return; loadFailed = true;
    report({ phase: 'Your studio could not open', error: 'The editor stopped during startup. Retry to reopen it. Your project files are unchanged.' });
  });
  void splash.loadFile(path.join(__dirname, 'startup.html')).catch(() => {
    // Missing packaged launcher files are a fatal installation error, never a reason
    // to bypass the editor readiness gate or expose a partially initialized studio.
    console.error('Luno Animate launcher could not load.'); onQuit();
  });
  return {
    report,
    complete: () => { if (state.error || disposed) return false; completed = true; reveal(); return true; },
    get finished() { return finished; },
    get window() { return splash; },
    dispose: () => { disposed = true; if (revealTimer) cancel(revealTimer); ipcMain.removeListener('luno:startup-action', action); if (!splash.isDestroyed()) splash.destroy(); },
  };
}
module.exports = { createStartupWindow };
