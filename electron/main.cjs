const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { randomUUID } = require('node:crypto');
const { decodeLam, readProjectData, MAX_LAM_BYTES } = require('./lib/core.cjs');
const { ProjectVault, atomicWrite, boundedRead } = require('./vault.cjs');
const { SafeUpdater } = require('./lib/updater.cjs');
// A separate profile keeps packaged CI smoke tests away from real creator data.
if (process.env.LUNO_TEST_USER_DATA && process.env.LUNO_DISABLE_UPDATES === '1') app.setPath('userData', path.resolve(process.env.LUNO_TEST_USER_DATA));
let vault; let updater; let allowQuit = false; let closing = false;
const preparations = new Map();
async function prepare(reason) {
  if (!window || !rendererReady) throw new Error('The editor has not finished opening. Please try again.');
  const id = randomUUID();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { preparations.delete(id); reject(new Error('The editor did not confirm a durable save.')); }, 45_000);
    preparations.set(id, { resolve, reject, timer }); window.webContents.send('luno:prepare', { id, reason });
  });
  await vault.flush();
}
async function closeSafely() {
  if (closing || allowQuit) return; closing = true;
  try { await prepare('close'); allowQuit = true; app.quit(); }
  catch (error) {
    window?.webContents.send('luno:resume');
    const result = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Keep editing', 'Quit without saving'], defaultId: 0, cancelId: 0, title: 'Keep your creation safe', message: 'The latest save could not be completed.', detail: `${error.message} Export a .lam copy before quitting.` });
    if (result.response === 1) { allowQuit = true; app.quit(); }
  } finally { closing = false; }
}

let window;
let workspace;
function projectArgument(args) {
  const value = args.find(arg => /\.(lam|luno)$/i.test(arg));
  if (!value) return undefined;
  try { return value.startsWith('file:') ? fileURLToPath(value) : value; }
  catch { return undefined; }
}
let pendingFile = projectArgument(process.argv);
let rendererReady = false;
const devUrl = process.env.LUNO_DEV_URL;

const allowedExportTypes = new Set(['png', 'svg', 'gif', 'mp4', 'zip']);
const trustedFile = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;

// The renderer gets narrow capabilities, never Node, arbitrary paths, or raw IPC.
function assertTrusted(event) {
  const url = event.senderFrame?.url;
  const trusted = devUrl && !app.isPackaged ? url?.startsWith(`${new URL(devUrl).origin}/`) : url === trustedFile;
  if (!window || event.sender !== window.webContents || !trusted) throw new Error('Untrusted request.');
}
const safeName = name => typeof name === 'string' ? name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'Luno animation' : 'Luno animation';
async function getWorkspace() {
  if (workspace !== undefined) return workspace;
  try { const config = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'workspace.json'), 'utf8')); workspace = typeof config.folder === 'string' ? config.folder : null; }
  catch { workspace = null; }
  return workspace;
}
async function readProject(file) {
  const bytes = await boundedRead(file, MAX_LAM_BYTES);
  readProjectData(bytes); // Validate before crossing the process boundary; do not modify the source.
  return bytes;
}
async function deliverPendingFile() {
  if (!pendingFile || !rendererReady || !window) return;
  const file = pendingFile; pendingFile = undefined;
  try { window.webContents.send('luno:project-file', await readProject(file)); }
  catch (error) { await dialog.showMessageBox(window, { type: 'error', title: 'Could not open this little project', message: error.message }); }
}
function command(name) { window?.webContents.send('luno:command', name); }
function installMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ label: 'About Luno Animate', click: () => command('help') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [
      { label: 'New project', accelerator: 'CmdOrCtrl+N', click: () => command('new') },
      { label: 'Open project…', accelerator: 'CmdOrCtrl+O', click: () => command('open') },
      { label: 'Save a copy…', accelerator: 'CmdOrCtrl+S', click: () => command('save') },
      { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => command('export') },
      { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => command('undo') },
      { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => command('redo') },
      { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'reload' }, { role: 'toggleDevTools' }] : [])] },
    { label: 'Help', submenu: [{ label: 'Check for updates…', click: () => command('updates') }, { label: 'Quick setup', click: () => command('setup') }, { label: 'A little help & shortcuts', click: () => command('help') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function createWindow() {
  rendererReady = false;
  window = new BrowserWindow({
    width: 1440, height: 950, minWidth: 1024, minHeight: 720,
    title: 'Luno Animate', show: false, backgroundColor: '#f7f8f4',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      webSecurity: true, allowRunningInsecureContent: false,
      partition: 'persist:luno-studio',
    },
  });
  window.on('close', event => { if (!allowQuit) { event.preventDefault(); void closeSafely(); } });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname === 'github.com' && (parsed.pathname === '/Dinomax2005/luno-animate' || parsed.pathname.startsWith('/Dinomax2005/luno-animate/'))) void shell.openExternal(parsed.href);
    } catch { /* Invalid external URLs stay closed. */ }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedFile && !(devUrl && !app.isPackaged && url.startsWith(`${new URL(devUrl).origin}/`))) event.preventDefault();
  });
  window.webContents.on('will-prevent-unload', event => {
    const response = dialog.showMessageBoxSync(window, {
      type: 'warning', buttons: ['Keep editing', 'Quit without saving'], defaultId: 0, cancelId: 0,
      title: 'Keep your little creation', message: 'Your local save did not finish.', detail: 'Use File → Save a .lam copy to keep your project before quitting.',
    });
    if (response === 1) event.preventDefault();
  });
  const studioSession = session.fromPartition('persist:luno-studio');
  studioSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  studioSession.setPermissionCheckHandler(() => false);
  studioSession.webRequest.onHeadersReceived((details, callback) => {
    const development = Boolean(devUrl && !app.isPackaged);
    const policy = `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${development ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' data:${development ? ' ws://127.0.0.1:5173 ws://localhost:5173' : ''}; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'`;
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
  if (devUrl && !app.isPackaged) {
    const parsed = new URL(devUrl);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.protocol !== 'http:') throw new Error('The development URL must be a local HTTP server.');
    void window.loadURL(devUrl);
  } else void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  window.on('closed', () => { window = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    pendingFile = projectArgument(argv);
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); void deliverPendingFile(); }
  });
  app.on('open-file', (event, file) => { event.preventDefault(); pendingFile = file; void deliverPendingFile(); });
  app.whenReady().then(() => {
    ipcMain.handle('luno:save-project', async (event, data, name) => {
      assertTrusted(event);
      if (!(data instanceof Uint8Array) || data.byteLength > MAX_LAM_BYTES) throw new Error('The project must be smaller than 64 MB.');
      decodeLam(data);
      const result = await dialog.showSaveDialog(window, { title: 'Save your little creation', defaultPath: path.join(await getWorkspace() || app.getPath('documents'), `${safeName(name)}.lam`), filters: [{ name: 'Luno Animate project', extensions: ['lam'] }] });
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, data); return true;
    });
    ipcMain.handle('luno:open-project', async event => {
      assertTrusted(event);
      const result = await dialog.showOpenDialog(window, { title: 'Open a little creation', defaultPath: await getWorkspace() || app.getPath('documents'), properties: ['openFile'], filters: [{ name: 'Luno Animate project', extensions: ['lam', 'luno'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      return readProject(result.filePaths[0]);
    });
    ipcMain.handle('luno:save-export', async (event, bytes, name, extension) => {
      assertTrusted(event);
      if (!allowedExportTypes.has(extension) || !(bytes instanceof Uint8Array) || bytes.byteLength > 150_000_000) throw new Error('Invalid export data.');
      const result = await dialog.showSaveDialog(window, { title: 'Share a little magic', defaultPath: path.join(await getWorkspace() || app.getPath('documents'), `${safeName(name)}.${extension}`), filters: [{ name: `${extension.toUpperCase()} file`, extensions: [extension] }] });
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, Buffer.from(bytes)); return true;
    });
    ipcMain.handle('luno:choose-folder', async event => {
      assertTrusted(event);
      const result = await dialog.showOpenDialog(window, { title: 'A home for your little creations', properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled || !result.filePaths[0]) return null;
      workspace = result.filePaths[0]; await atomicWrite(path.join(app.getPath('userData'), 'workspace.json'), JSON.stringify({ folder: workspace })); return workspace;
    });
    ipcMain.handle('luno:get-workspace', async event => { assertTrusted(event); return getWorkspace(); });
    ipcMain.handle('luno:ready', async event => { assertTrusted(event); rendererReady = true; await deliverPendingFile(); });
    vault = new ProjectVault(app.getPath('userData'), app.getVersion());
    const handle = (name, callback) => ipcMain.handle(`luno:${name}`, async (event, ...args) => { assertTrusted(event); return callback(...args); });
    handle('library-list', () => vault.list()); handle('library-save', (bytes, thumb) => vault.save(bytes, thumb)); handle('library-load', id => vault.load(id));
    handle('library-patch', (id, patch) => vault.patch(id, patch)); handle('library-delete', id => vault.deleteForever(id)); handle('library-recover', id => vault.recover(id));
    handle('settings-get', () => vault.getSettings()); handle('settings-save', settings => vault.saveSettings(settings));
    handle('backups-list', () => vault.backups()); handle('backup-create', () => vault.backup('manual'));
    handle('backup-restore', async id => { const result = await dialog.showMessageBox(window, { type: 'warning', title: 'Restore your library', message: 'Restore every project from this backup?', detail: 'A new backup of your current library is kept first. Stay on the project home until restore is complete.', buttons: ['Cancel', 'Restore backup'], defaultId: 0, cancelId: 0 }); if (result.response !== 1) return false; const restored = await vault.restore(id); workspace = undefined; return restored; });
    ipcMain.on('luno:prepared', (event, result) => { try { assertTrusted(event); } catch { return; } const pending = preparations.get(result?.id); if (!pending || typeof result.ok !== 'boolean') return; clearTimeout(pending.timer); preparations.delete(result.id); if (result.ok) pending.resolve(); else pending.reject(new Error(typeof result.error === 'string' ? result.error.slice(0, 400) : 'The editor is still busy.')); });
    updater = new SafeUpdater({ app, send: state => { if (!window) return; window.webContents.send(state ? 'luno:update-state' : 'luno:resume', state); }, prepare, backup: reason => vault.backup(reason), allowQuit: value => { allowQuit = value; } });
    handle('update-state', () => updater.state); handle('update-check', () => updater.check()); handle('update-install', () => updater.install()); handle('update-defer', () => updater.defer());
    handle('update-automatic', enabled => updater.setAutomatic(enabled));
    ipcMain.on('luno:activity', (event, activity) => { try { assertTrusted(event); updater.updateActivity(activity); } catch { /* Untrusted activity cannot influence installation. */ } });
    installMenu(); createWindow();
    void vault.getSettings().then(settings => updater.initialize(settings.preferences?.automaticUpdates ?? true)).catch(() => updater.initialize(false));
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('before-quit', event => { if (!allowQuit && window) { event.preventDefault(); void closeSafely(); } });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
