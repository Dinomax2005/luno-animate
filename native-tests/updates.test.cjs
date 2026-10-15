const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Updates, newer } = require("../desktop/update-core.cjs");
function fixture(t) {
  const sdk = new EventEmitter();
  let calls = { prepare: 0, backup: 0, quit: 0, install: 0, download: 0 };
  sdk.setFeedURL = (value) => {
    sdk.feed = value;
  };
  sdk.checkForUpdates = async () => {};
  sdk.downloadUpdate = async () => {
    calls.download++;
  };
  sdk.quitAndInstall = () => {
    calls.install++;
  };
  const updater = new Updates({
    app: {
      isPackaged: true,
      getVersion: () => "1.0.0",
      getPath: () => "/not-a-signed-studio-build",
    },
    send: () => {},
    prepare: async () => {
      calls.prepare++;
    },
    backup: async () => {
      calls.backup++;
    },
    quit: () => {
      calls.quit++;
    },
    sdk,
  });
  t.after(() => updater.dispose());
  return { updater, sdk, calls };
}
test("version policy accepts only newer stable versions, including 2.x", () => {
  assert(newer("1.0.1", "1.0.0"));
  assert(newer("1.1.0", "1.0.9"));
  assert(newer("2.0.0", "1.0.3"));
  assert(newer("2.1.0", "2.0.0"));
  for (const v of ["0.4.0", "1.0.0", "2.0.0", "1.0.1-beta.1", "invalid"])
    assert(!newer(v, v === "2.0.0" ? "2.0.0" : "1.0.0"));
  assert(newer("2.0.1", "2.0.0"));
  assert(!newer("3.0.0-beta.1", "2.0.0"));
  for (const v of ["1.0.3", "2.0.0", "invalid"])
    assert(!newer(v, "2.0.0"), `${v} must not upgrade 2.0.0`);
});
test("development/test builds never initialize the update feed", async (t) => {
  const { updater, sdk } = fixture(t);
  updater.app.isPackaged = false;
  await updater.initialize();
  assert.equal(updater.state.phase, "disabled");
  assert.equal(sdk.feed, undefined);
});
test("supported feed uses a new channel rather than inheriting the legacy latest manifests", async (t) => {
  const { updater, sdk } = fixture(t),
    old = process.env.APPIMAGE,
    disabled = process.env.PEGBAR_DISABLE_UPDATES;
  process.env.APPIMAGE = "/fake.AppImage";
  delete process.env.PEGBAR_DISABLE_UPDATES;
  try {
    await updater.initialize();
    if (process.platform === "darwin") {
      assert.equal(updater.state.phase, "disabled");
      assert.match(updater.state.message, /manual install/);
      assert.equal(sdk.feed, undefined);
      return;
    }
    assert.equal(sdk.channel, "studio-v1");
    assert.equal(sdk.feed.channel, "studio-v1");
    assert.equal(sdk.allowPrerelease, false);
    assert.equal(sdk.autoInstallOnAppQuit, false);
    assert.equal(sdk.allowDowngrade, false);
  } finally {
    if (old === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = old;
    if (disabled !== undefined) process.env.PEGBAR_DISABLE_UPDATES = disabled;
  }
});
test("busy activity blocks even an explicit restart", async (t) => {
  const { updater, calls } = fixture(t);
  updater.supported = true;
  updater.state.phase = "ready";
  updater.activity(false, Date.now());
  await updater.install();
  assert.equal(calls.prepare, 0);
  assert.equal(calls.install, 0);
});
test("restart waits for durable renderer save and verified backup, in order", async (t) => {
  const { updater, calls } = fixture(t),
    sequence = [];
  updater.supported = true;
  updater.state.phase = "ready";
  updater.safe = true;
  updater.prepare = async () => {
    sequence.push("save");
  };
  updater.backup = async () => {
    sequence.push("backup");
  };
  updater.quit = () => sequence.push("quit");
  updater.sdk.quitAndInstall = () => {
    sequence.push("install");
    calls.install++;
  };
  await updater.install();
  assert.deepEqual(sequence, ["save", "backup", "quit", "install"]);
});
test("failed save never invokes backup, quit or install", async (t) => {
  const { updater, calls } = fixture(t);
  updater.supported = true;
  updater.state.phase = "ready";
  updater.safe = true;
  updater.prepare = async () => {
    throw new Error("Quota");
  };
  await updater.install();
  assert.equal(calls.backup, 0);
  assert.equal(calls.install, 0);
  assert.equal(updater.state.phase, "error");
});
test("failed backup never permits install", async (t) => {
  const { updater, calls } = fixture(t);
  updater.supported = true;
  updater.state.phase = "ready";
  updater.safe = true;
  updater.backup = async () => {
    throw new Error("Backup integrity");
  };
  await updater.install();
  assert.equal(calls.quit, 0);
  assert.equal(calls.install, 0);
});
test("returning activity pauses an idle restart warning", (t) => {
  const { updater } = fixture(t);
  updater.supported = true;
  updater.state.phase = "ready";
  updater.safe = true;
  updater.lastActivity = Date.now() - 130000;
  updater.tick();
  assert.equal(updater.state.phase, "warning");
  updater.activity(false, Date.now());
  assert.equal(updater.state.phase, "ready");
  assert.equal(updater.countdown, null);
});
