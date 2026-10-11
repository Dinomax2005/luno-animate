const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFileSync } = require('node:fs');
const { createStartupWindow } = require('../electron/startup-window.cjs');
function fixture(minimumMs = 0) {
  const order = [], windows = [], timers = new Map(), ipcMain = new EventEmitter(); let clock = 0, quit = 0, next = 0;
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.destroyed = false; this.visible = false; this.webContents = new EventEmitter();
      Object.assign(this.webContents, { mainFrame: { url: pathToFileURL(path.resolve('electron/startup.html')).href }, sent: [], session: { setPermissionRequestHandler: handler => { this.permission = handler; }, setPermissionCheckHandler: handler => { this.checkPermission = handler; } },
        send: (channel, data) => this.webContents.sent.push({ channel, data }), reload: () => { this.reloaded = true; }, setWindowOpenHandler: handler => { this.openHandler = handler; } }); windows.push(this);
    }
    setMenu() {} center() {} loadFile() { return Promise.resolve(); } isDestroyed() { return this.destroyed; }
    show() { this.visible = true; order.push(windows.indexOf(this) ? 'splash show' : 'main show'); }
    focus() { order.push(windows.indexOf(this) ? 'splash focus' : 'main focus'); }
    destroy() { this.destroyed = true; this.visible = false; order.push('splash close'); }
  }
  const main = new FakeWindow({ show: false }), controller = createStartupWindow({ BrowserWindow: FakeWindow, ipcMain, mainWindow: main, icon: 'icon', onQuit: () => quit++, now: () => clock,
    schedule: (fn, delay) => { timers.set(++next, { fn, delay }); return next; }, cancel: id => timers.delete(id), minimumMs });
  if (minimumMs !== -1) windows[1].emit('ready-to-show');
  return { controller, main, splash: windows[1], order, timers, ipcMain, setClock: value => { clock = value; }, quit: () => quit,
    action: (value, event = { sender: windows[1].webContents, senderFrame: windows[1].webContents.mainFrame }) => ipcMain.emit('luno:startup-action', event, value) };
}
test('startup is a small separate isolated window; painting the studio alone never reveals it', () => {
  const f = fixture(); assert.equal(f.splash.options.width, 460); assert.equal(f.splash.options.height, 282); assert.equal(f.splash.options.frame, false);
  assert.equal(f.splash.options.webPreferences.sandbox, true); assert.equal(f.splash.options.webPreferences.nodeIntegration, false); assert.equal(f.splash.options.webPreferences.contextIsolation, true);
  assert.equal(f.splash.options.webPreferences.partition, 'luno-startup'); f.main.emit('ready-to-show');
  assert.equal(f.splash.visible, true); assert.equal(f.main.visible, false); assert.equal(f.controller.finished, false); f.controller.dispose();
});
test('the splash closes before the ready studio is shown, and completion is idempotent', () => {
  const f = fixture(); f.main.emit('ready-to-show'); f.controller.complete(); f.controller.complete();
  assert.equal(f.splash.destroyed, true); assert.equal(f.main.visible, true); assert.equal(f.controller.finished, true);
  assert.deepEqual(f.order, ['splash show', 'splash close', 'main show', 'main focus']); assert.equal(f.ipcMain.listenerCount('luno:startup-action'), 0);
});
test('a completed renderer still waits for its first paint and a bounded small-popup dwell', () => {
  const f = fixture(650); f.controller.complete(); assert.equal(f.timers.size, 0); assert.equal(f.main.visible, false);
  f.setClock(100); f.main.emit('ready-to-show'); assert.equal([...f.timers.values()][0].delay, 550);
  f.setClock(650); [...f.timers.values()][0].fn(); assert.equal(f.main.visible, true); assert.equal(f.splash.destroyed, true);
});
test('startup failure cancels reveal, keeps the editor hidden, and exposes retry state safely', () => {
  const f = fixture(650); f.main.emit('ready-to-show'); f.controller.complete(); assert.equal(f.timers.size, 1);
  f.controller.report({ phase: 'Local library failed', error: 'Not enough disk space' }); assert.equal(f.timers.size, 0); assert.equal(f.controller.complete(), false);
  assert.equal(f.main.visible, false); assert.deepEqual(f.splash.webContents.sent.at(-1).data, { phase: 'Local library failed', error: 'Not enough disk space' });
  f.action('retry'); assert.equal(f.main.webContents.sent.at(-1).channel, 'luno:startup-retry'); assert.equal(f.splash.webContents.sent.at(-1).data.error, null);
  f.setClock(700); f.controller.complete(); assert.equal(f.main.visible, true);
});
test('retry reloads a failed renderer; aborted/subframe loads do not trigger a startup error', () => {
  const f = fixture(); f.main.webContents.emit('did-fail-load', {}, -3, 'aborted', '', true); f.main.webContents.emit('did-fail-load', {}, -2, 'subframe', '', false);
  assert.equal(f.splash.webContents.sent.length, 1); assert.equal(f.splash.webContents.sent[0].data.error, null); f.main.webContents.emit('did-fail-load', {}, -2, 'load failed', '', true);
  assert.match(f.splash.webContents.sent.at(-1).data.error, /load failed/); f.action('retry'); assert.equal(f.main.reloaded, true); f.controller.dispose();
});
test('only the exact launcher main frame can retry or quit; permissions and navigation are denied', () => {
  const f = fixture(); f.action('quit', { sender: f.main.webContents, senderFrame: f.splash.webContents.mainFrame });
  f.action('quit', { sender: f.splash.webContents, senderFrame: { ...f.splash.webContents.mainFrame } }); f.action('arbitrary:ipc'); assert.equal(f.quit(), 0);
  f.action('quit'); assert.equal(f.quit(), 1); assert.deepEqual(f.splash.openHandler(), { action: 'deny' }); assert.equal(f.splash.checkPermission(), false);
  let allowed = true; f.splash.permission(null, 'media', value => { allowed = value; }); assert.equal(allowed, false);
  let prevented = false; f.splash.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, 'https://example.com'); assert.equal(prevented, true); f.controller.dispose();
});
test('a ready editor cannot appear before the little launcher itself has painted', () => {
  const f = fixture(-1); f.main.emit('ready-to-show'); f.controller.complete(); assert.equal(f.main.visible, false);
  f.splash.emit('ready-to-show'); assert.equal(f.main.visible, true); assert.deepEqual(f.order, ['splash show', 'splash close', 'main show', 'main focus']);
});
test('disposing a launch cancels timers and cannot show a dead studio or leak action listeners', () => {
  const f = fixture(650); f.main.emit('ready-to-show'); f.controller.complete(); const fn = [...f.timers.values()][0].fn; f.controller.dispose(); fn();
  assert.equal(f.main.visible, false); assert.equal(f.splash.destroyed, true); assert.equal(f.timers.size, 0); assert.equal(f.ipcMain.listenerCount('luno:startup-action'), 0);
});
test('launcher preload exposes no studio/file/update capabilities and uses local strict CSP', () => {
  const source = readFileSync('electron/startup-preload.cjs', 'utf8'); assert(!/readFile|writeFile|documents:|library:|updater:|shell\.|ipcRenderer\.invoke/.test(source));
  const html = readFileSync('electron/startup.html', 'utf8'); assert(html.includes("default-src 'none'")); assert(!html.includes('unsafe-inline')); assert(html.includes('startup-ui.js'));
  const main = readFileSync('electron/main.cjs', 'utf8'); assert(main.includes('luno:startup-complete')); assert(main.includes('event.senderFrame !== window.webContents.mainFrame'));
  assert(!main.includes("window.once('ready-to-show', () => window.show())"));
});
