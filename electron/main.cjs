const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { randomUUID } = require('node:crypto');

let window;
let workspace;
function projectArgument(args) {
  const value = args.find(arg => arg.toLowerCase().endsWith('.luno'));
  if (!value) return undefined;
  try { return value.startsWith('file:') ? fileURLToPath(value) : value; }
  catch { return undefined; }
}
let pendingFile = projectArgument(process.argv);
let rendererReady = false;
const devUrl = process.env.LUNO_DEV_URL;
const MAX_PROJECT_BYTES = 40_000_000;
const allowedExportTypes = new Set(['png', 'svg', 'gif']);
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
async function atomicWrite(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, data, { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}
async function readProject(file) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_PROJECT_BYTES) throw new Error('Please choose a Luno project smaller than 40 MB.');
  return fs.readFile(file, 'utf8');
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
    { label: 'Help', submenu: [{ label: 'Quick setup', click: () => command('setup') }, { label: 'A little help & shortcuts', click: () => command('help') }] },
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
      title: 'Keep your little creation', message: 'Your local save did not finish.', detail: 'Use File → Save a copy to keep your project before quitting.',
    });
    if (response === 1) event.preventDefault();
  });
  const studioSession = session.fromPartition('persist:luno-studio');
  studioSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  studioSession.setPermissionCheckHandler(() => false);
  studioSession.webRequest.onHeadersReceived((details, callback) => {
    const development = Boolean(devUrl && !app.isPackaged);
    const policy = `default-src 'self'; script-src 'self'${development ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${development ? ' ws://127.0.0.1:5173 ws://localhost:5173' : ''}; object-src 'none'; base-uri 'self'; frame-src 'none'`;
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
      if (typeof data !== 'string' || Buffer.byteLength(data) > MAX_PROJECT_BYTES) throw new Error('The project must be smaller than 40 MB.');
      let project; try { project = JSON.parse(data); } catch { throw new Error('Invalid project data.'); }
      if (project.version !== 1 || !Array.isArray(project.items)) throw new Error('Invalid project data.');
      const result = await dialog.showSaveDialog(window, { title: 'Save your little creation', defaultPath: path.join(await getWorkspace() || app.getPath('documents'), `${safeName(name)}.luno`), filters: [{ name: 'Luno Animate project', extensions: ['luno'] }] });
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, data); return true;
    });
    ipcMain.handle('luno:open-project', async event => {
      assertTrusted(event);
      const result = await dialog.showOpenDialog(window, { title: 'Open a little creation', defaultPath: await getWorkspace() || app.getPath('documents'), properties: ['openFile'], filters: [{ name: 'Luno Animate project', extensions: ['luno'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      return readProject(result.filePaths[0]);
    });
    ipcMain.handle('luno:save-export', async (event, bytes, name, extension) => {
      assertTrusted(event);
      if (!allowedExportTypes.has(extension) || !Array.isArray(bytes) || bytes.length > 150_000_000 || !bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error('Invalid export data.');
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
    installMenu(); createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
