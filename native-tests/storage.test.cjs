const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Library, Files } = require("../desktop/storage.cjs");
const { encode, decode } = require("../desktop/core.cjs");
function doc(id = "studio-document") {
  return {
    format: "luno-studio",
    schema: 1,
    id,
    title: "Native study",
    canvas: { width: 128, height: 128, fps: 24 },
    scenes: [
      {
        id: "scene-01",
        name: "Scene 01",
        length: 24,
        background: "#f6f5f1",
        layers: [],
        sounds: [],
        camera: { x: 64, y: 64, zoom: 1, keys: [] },
        work: [0, 23],
      },
    ],
    assets: [],
    references: [],
    created: Date.now(),
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "luno-studio-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const library = new Library(path.join(root, "profile"));
  await library.initial;
  return { root, library };
}
test("new library saves canonical 1.0 documents and metadata together", async (t) => {
  const { library } = await fixture(t),
    d = doc();
  const entry = await library.save(encode(d), "", "Draw");
  assert.equal(entry.title, d.title);
  assert.deepEqual(decode(await library.load(d.id)), d);
  assert.equal((await library.list()).length, 1);
});
test("queued saves serialize and bounded generations retain the current document", async (t) => {
  const { library } = await fixture(t),
    d = doc();
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      library.save(encode({ ...d, title: `Version ${i}` }), "", "Motion"),
    ),
  );
  assert.equal(decode(await library.load(d.id)).title, "Version 5");
  const files = await fs.readdir(library.directory(d.id));
  assert.equal(files.filter((f) => f.endsWith(".lam")).length, 4);
});
test("failed validation never replaces the last committed generation", async (t) => {
  const { library } = await fixture(t),
    d = doc();
  await library.save(encode(d), "", "Draw");
  await assert.rejects(library.save(new Uint8Array([1, 2, 3]), "", "Draw"));
  assert.deepEqual(decode(await library.load(d.id)), d);
});
test("approved overwrite updates exactly the selected file and keeps a prior-file copy", async (t) => {
  const { root, library } = await fixture(t),
    files = new Files(library.root),
    d = doc(),
    file = path.join(root, "source.lam");
  await fs.writeFile(file, encode(d));
  const opened = await files.approve(file),
    next = { ...d, title: "Retouched" };
  const result = await files.save(encode(next), opened.token, opened.hash);
  assert.equal(result.name, "source.lam");
  assert.deepEqual(decode(await fs.readFile(file)), next);
  const histories = await fs.readdir(path.join(library.root, "file-history"));
  assert.equal(histories.length, 1);
  assert.deepEqual(
    decode(
      await fs.readFile(path.join(library.root, "file-history", histories[0])),
    ),
    d,
  );
});
test("external changes fail without clobbering either version", async (t) => {
  const { root, library } = await fixture(t),
    files = new Files(library.root),
    file = path.join(root, "conflict.lam"),
    d = doc();
  await fs.writeFile(file, encode(d));
  const opened = await files.approve(file),
    external = { ...d, title: "Other editor" };
  await fs.writeFile(file, encode(external));
  await assert.rejects(
    files.save(
      encode({ ...d, title: "Local changes" }),
      opened.token,
      opened.hash,
    ),
    /changed outside/,
  );
  assert.deepEqual(decode(await fs.readFile(file)), external);
});
test("unknown tokens and traversal identifiers cannot access arbitrary files", async (t) => {
  const { root, library } = await fixture(t),
    files = new Files(library.root);
  await assert.rejects(
    files.save(encode(doc()), "unknown", "new"),
    /not approved/,
  );
  await assert.rejects(library.load("../secret"));
  await assert.rejects(library.delete("../../"));
  assert.deepEqual(await fs.readdir(root), ["profile"]);
});
test("symbolic link project paths are refused", async (t) => {
  const { root, library } = await fixture(t),
    files = new Files(library.root),
    file = path.join(root, "real.lam"),
    link = path.join(root, "link.lam");
  await fs.writeFile(file, encode(doc()));
  try {
    await fs.symlink(file, link);
  } catch {
    return;
  }
  await assert.rejects(files.approve(link), /Unsafe/);
});
test("new approved save destinations cannot silently overwrite a concurrently created file", async (t) => {
  const { root, library } = await fixture(t),
    files = new Files(library.root),
    file = path.join(root, "new.lam"),
    target = await files.target(file),
    external = { ...doc(), title: "Created elsewhere" };
  await fs.writeFile(file, encode(external));
  await assert.rejects(
    files.save(encode(doc()), target.token, target.hash),
    /changed outside/,
  );
  assert.equal(decode(await fs.readFile(file)).title, external.title);
});
test("complete library backup, restore and restart preserve document bytes", async (t) => {
  const { library } = await fixture(t),
    d = doc(),
    other = doc("second-project");
  await library.save(encode(d), "", "Draw");
  await library.save(encode(other), "", "Motion");
  const backup = await library.backup();
  await library.save(encode({ ...d, title: "Changed" }), "", "Edit");
  await library.delete(other.id);
  await library.restore(backup.id);
  assert.deepEqual(decode(await library.load(d.id)), d);
  assert.deepEqual(decode(await library.load(other.id)), other);
  const restarted = new Library(library.root);
  assert.equal((await restarted.list()).length, 2);
  assert.equal((await restarted.backups()).length, 2);
});
test("corrupt backup is rejected before switching the current library", async (t) => {
  const { library } = await fixture(t),
    d = doc();
  await library.save(encode(d), "", "Draw");
  const backup = await library.backup();
  await fs.writeFile(
    path.join(library.root, "backups", backup.id, `${d.id}.lam`),
    Buffer.from("broken"),
  );
  const collection = library.collection;
  await assert.rejects(
    library.restore(backup.id),
    /verification|legacy|Unsupported/,
  );
  assert.equal(library.collection, collection);
  assert.deepEqual(decode(await library.load(d.id)), d);
});
test("removing a library project does not delete any linked external file", async (t) => {
  const { root, library } = await fixture(t),
    d = doc(),
    file = path.join(root, "owned.lam");
  await fs.writeFile(file, encode(d));
  await library.save(encode(d), "", "Draw");
  await library.delete(d.id);
  assert.equal((await library.list()).length, 0);
  assert.deepEqual(decode(await fs.readFile(file)), d);
});
