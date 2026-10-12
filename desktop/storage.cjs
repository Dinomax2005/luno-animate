const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { decode, fingerprint } = require("./core.cjs");
const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
function identifier(value) {
  if (
    typeof value !== "string" ||
    !SAFE.test(value) ||
    ["__proto__", "constructor", "prototype"].includes(value)
  )
    throw new Error("Invalid identifier.");
  return value;
}
async function read(file, limit = 64_000_052) {
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > limit)
    throw new Error("Unsafe or oversized file.");
  return fs.readFile(file);
}
async function atomic(file, data, beforeRename) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = null;
    if (beforeRename) await beforeRename();
    await fs.rename(temporary, file);
    try {
      const dir = await fs.open(path.dirname(file), "r");
      await dir.sync();
      await dir.close();
    } catch {
      /* Directory fsync unavailable on some platforms. */
    }
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
class Library {
  constructor(root) {
    this.root = path.resolve(root);
    this.queue = Promise.resolve();
    this.initial = this.init();
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(path.join(this.root, "collections"), { recursive: true });
    await fs.mkdir(path.join(this.root, "backups"), { recursive: true });
    let active;
    try {
      active = JSON.parse(
        await read(path.join(this.root, "active.json"), 4096),
      );
      if (!/^c-[a-f0-9-]{36}$/.test(active.collection))
        throw new Error("Invalid library pointer.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      active = { collection: `c-${randomUUID()}` };
      await fs.mkdir(path.join(this.root, "collections", active.collection));
      await atomic(path.join(this.root, "active.json"), JSON.stringify(active));
    }
    this.collection = active.collection;
  }
  serial(action) {
    const result = this.queue.then(() => this.initial).then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  directory(id) {
    return path.join(this.root, "collections", this.collection, identifier(id));
  }
  async entry(id) {
    const meta = JSON.parse(
      await read(path.join(this.directory(id), "entry.json"), 1_500_000),
    );
    if (
      meta.id !== id ||
      !/^g-[a-f0-9-]{36}\.lam$/.test(meta.file) ||
      typeof meta.title !== "string" ||
      meta.title.length > 100 ||
      !["Draw", "Motion", "Edit"].includes(meta.workspace) ||
      !/^[a-f0-9]{64}$/.test(meta.hash)
    )
      throw new Error("Invalid project index.");
    return meta;
  }
  async loadUnsafe(id) {
    const meta = await this.entry(id),
      bytes = await read(path.join(this.directory(id), meta.file));
    if (fingerprint(bytes) !== meta.hash)
      throw new Error("Library integrity check failed.");
    const doc = decode(bytes);
    if (doc.id !== id) throw new Error("Library identity mismatch.");
    return bytes;
  }
  load(id) {
    return this.serial(() => this.loadUnsafe(identifier(id)));
  }
  async listUnsafe() {
    const folder = path.join(this.root, "collections", this.collection),
      entries = await fs.readdir(folder, { withFileTypes: true }),
      result = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SAFE.test(entry.name)) continue;
      try {
        const value = await this.entry(entry.name);
        result.push({
          id: value.id,
          title: value.title,
          created: value.created,
          modified: value.modified,
          thumbnail: value.thumbnail,
          starred: !!value.starred,
          workspace: value.workspace,
          scenes: value.scenes,
          seconds: value.seconds,
        });
      } catch {
        /* A malformed entry stays on disk for recovery, never silently deleted. */
      }
    }
    return result;
  }
  list() {
    return this.serial(() => this.listUnsafe());
  }
  async saveUnsafe(data, thumbnail, workspace) {
    const bytes = Buffer.from(data);
    const d = decode(bytes);
    identifier(d.id);
    if (
      typeof thumbnail !== "string" ||
      thumbnail.length > 1_000_000 ||
      (thumbnail &&
        !/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(thumbnail))
    )
      throw new Error("Invalid preview.");
    if (!["Draw", "Motion", "Edit"].includes(workspace))
      throw new Error("Invalid workspace.");
    const directory = this.directory(d.id);
    await fs.mkdir(directory, { recursive: true });
    let previous = null;
    try {
      previous = await this.entry(d.id);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const generation = `g-${randomUUID()}.lam`,
      meta = {
        id: d.id,
        title: d.title,
        created: previous?.created ?? d.created,
        modified: Date.now(),
        thumbnail: thumbnail || previous?.thumbnail || "",
        starred: previous?.starred ?? false,
        workspace,
        scenes: d.scenes.length,
        seconds: d.scenes.reduce((n, s) => n + s.length, 0) / d.canvas.fps,
        file: generation,
        hash: fingerprint(bytes),
        revisions: previous
          ? [previous.file, ...(previous.revisions ?? [])].slice(0, 3)
          : [],
      };
    await atomic(path.join(directory, generation), bytes);
    await atomic(path.join(directory, "entry.json"), JSON.stringify(meta));
    const keep = new Set([generation, ...meta.revisions]);
    for (const file of await fs.readdir(directory))
      if (/^g-[a-f0-9-]{36}\.lam$/.test(file) && !keep.has(file))
        await fs.rm(path.join(directory, file)).catch(() => {});
    return {
      id: meta.id,
      title: meta.title,
      created: meta.created,
      modified: meta.modified,
      thumbnail: meta.thumbnail,
      starred: meta.starred,
      workspace: meta.workspace,
      scenes: meta.scenes,
      seconds: meta.seconds,
    };
  }
  save(data, thumbnail, workspace) {
    return this.serial(() => this.saveUnsafe(data, thumbnail, workspace));
  }
  delete(id) {
    return this.serial(async () => {
      identifier(id);
      const source = this.directory(id);
      await fs.mkdir(path.join(this.root, "removed"), { recursive: true });
      await fs.rename(
        source,
        path.join(this.root, "removed", `${id}-${randomUUID()}`),
      );
    });
  }
  async backupUnsafe(reason = "manual") {
    const entries = await this.listUnsafe(),
      id = `b-${randomUUID()}`,
      folder = path.join(this.root, "backups", id);
    await fs.mkdir(folder);
    const manifest = {
      format: "luno-studio-backup",
      schema: 1,
      id,
      date: Date.now(),
      reason,
      projects: [],
    };
    let total = 0;
    try {
      for (const entry of entries) {
        const bytes = await this.loadUnsafe(entry.id);
        total += bytes.length;
        if (total > 256_000_000)
          throw new Error(
            "Backup limit: 256 MB. Export individual .lam copies for larger libraries.",
          );
        await atomic(path.join(folder, `${entry.id}.lam`), bytes);
        manifest.projects.push({ entry, hash: fingerprint(bytes) });
      }
      await atomic(
        path.join(folder, "manifest.json"),
        JSON.stringify(manifest),
      );
      return { id, date: manifest.date };
    } catch (error) {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }
  backup() {
    return this.serial(() => this.backupUnsafe());
  }
  backups() {
    return this.serial(async () => {
      const result = [];
      for (const entry of await fs.readdir(path.join(this.root, "backups"), {
        withFileTypes: true,
      })) {
        if (!entry.isDirectory() || !/^b-[a-f0-9-]{36}$/.test(entry.name))
          continue;
        try {
          const m = JSON.parse(
            await read(
              path.join(this.root, "backups", entry.name, "manifest.json"),
              8_000_000,
            ),
          );
          if (m.id === entry.name && m.format === "luno-studio-backup")
            result.push({ id: m.id, date: m.date });
        } catch {
          /* Incomplete backups cannot be selected. */
        }
      }
      return result.sort((a, b) => b.date - a.date);
    });
  }
  restore(id) {
    return this.serial(async () => {
      if (!/^b-[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid backup.");
      const folder = path.join(this.root, "backups", id),
        manifest = JSON.parse(
          await read(path.join(folder, "manifest.json"), 8_000_000),
        );
      if (
        manifest.format !== "luno-studio-backup" ||
        manifest.schema !== 1 ||
        !Array.isArray(manifest.projects) ||
        manifest.projects.length > 1000
      )
        throw new Error("Unsupported backup.");
      const captured = [];
      let total = 0;
      const seen = new Set();
      for (const record of manifest.projects) {
        identifier(record.entry.id);
        if (seen.has(record.entry.id))
          throw new Error("Duplicate backup identity.");
        seen.add(record.entry.id);
        const bytes = await read(path.join(folder, `${record.entry.id}.lam`));
        total += bytes.length;
        if (
          total > 256_000_000 ||
          fingerprint(bytes) !== record.hash ||
          decode(bytes).id !== record.entry.id
        )
          throw new Error("Backup verification failed.");
        captured.push({ record, bytes });
      }
      await this.backupUnsafe("before-restore");
      const old = this.collection,
        next = `c-${randomUUID()}`;
      await fs.mkdir(path.join(this.root, "collections", next));
      this.collection = next;
      try {
        for (const { record, bytes } of captured)
          await this.saveUnsafe(
            bytes,
            record.entry.thumbnail,
            record.entry.workspace,
          );
        await atomic(
          path.join(this.root, "active.json"),
          JSON.stringify({ collection: next }),
        );
      } catch (error) {
        this.collection = old;
        throw error;
      }
    });
  }
}
class Files {
  constructor(root) {
    this.root = root;
    this.tokens = new Map();
  }
  async approve(file) {
    const bytes = await read(file);
    decode(bytes);
    const token = randomUUID(),
      hash = fingerprint(bytes);
    this.tokens.set(token, { path: path.resolve(file), hash });
    return { bytes, token, name: path.basename(file), hash };
  }
  async save(bytes, token, expected) {
    decode(Buffer.from(bytes));
    const target = this.tokens.get(token);
    if (!target) throw new Error("The file is not approved. Use Save As.");
    const check = async () => {
      let current;
      try {
        current = await read(target.path);
      } catch (error) {
        if (error.code === "ENOENT" && expected === "new") return;
        throw error;
      }
      if (expected === "new" || fingerprint(current) !== expected)
        throw new Error(
          "The file changed outside Luno. Save As to preserve both versions.",
        );
    };
    await check();
    await fs.mkdir(path.join(this.root, "file-history"), { recursive: true });
    if (expected !== "new")
      await atomic(
        path.join(this.root, "file-history", `${randomUUID()}.lam`),
        await read(target.path),
      );
    await atomic(target.path, Buffer.from(bytes), check);
    target.hash = fingerprint(Buffer.from(bytes));
    return { token, name: path.basename(target.path), hash: target.hash };
  }
  async target(file) {
    const token = randomUUID();
    let hash = "new";
    try {
      hash = fingerprint(await read(file));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    this.tokens.set(token, { path: path.resolve(file), hash });
    return { token, hash };
  }
}
module.exports = { Library, Files, atomic, read, identifier };
