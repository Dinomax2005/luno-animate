import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Input, BufferSource, ALL_FORMATS } from "mediabunny";
import { decode, encode } from "../src/core/codec";
const executable = process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE;
async function launch(profile: string) {
  return electron.launch({
    executablePath: executable,
    args: ["--no-sandbox", ...(!executable ? ["."] : [])],
    env: {
      ...process.env,
      LUNO_TEST_PROFILE: profile,
      LUNO_DISABLE_UPDATES: "1",
    },
  });
}
async function studioWindow(app: ElectronApplication): Promise<Page> {
  await expect
    .poll(
      () => app.windows().some((p) => /\/dist\/index\.html$/.test(p.url())),
      { timeout: 45000 },
    )
    .toBe(true);
  const page = app.windows().find((p) => /\/dist\/index\.html$/.test(p.url()))!;
  const native = await app.browserWindow(page);
  await expect
    .poll(() => native.evaluate((w) => w.isVisible()), { timeout: 45000 })
    .toBe(true);
  await native.dispose();
  const setup = page.getByRole("dialog", { name: "Workspace setup" });
  if (await setup.isVisible())
    await setup
      .getByRole("button", { name: "Skip setup", exact: true })
      .click();
  return page;
}
async function create(page: Page, workspace = "Draw") {
  await page
    .getByRole("button", { name: `New ${workspace} project`, exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "New project" })
    .getByLabel("Project name", { exact: true })
    .fill("Native first release");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByTestId("canvas")).toBeVisible();
}
async function ink(page: Page) {
  const r = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.6, {
    steps: 14,
  });
  await page.mouse.up();
}
test("packaged first release: isolated identity, closed startup popup, safe bridge, painting and linked native overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-desktop-")),
    profile = path.join(root, "profile"),
    destination = path.join(root, "original.lam");
  let app: ElectronApplication | undefined;
  try {
    app = await launch(profile);
    const page = await studioWindow(app);
    expect(
      app.windows().filter((p) => p.url().endsWith("/startup.html")),
    ).toHaveLength(0);
    expect(await app.evaluate(({ app }) => app.getName())).toBe("Luno Studio");
    expect(
      await page.evaluate(() => ({
        require: typeof (window as unknown as { require?: unknown }).require,
        keys: Object.keys(window.studio ?? {}),
      })),
    ).toEqual({
      require: "undefined",
      keys: [
        "version",
        "platform",
        "ready",
        "library",
        "files",
        "onOpen",
        "onCommand",
        "onPrepare",
        "external",
        "updates",
      ],
    });
    await create(page);
    await ink(page);
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, destination);
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect
      .poll(async () => {
        try {
          return decode(new Uint8Array(await readFile(destination))).scenes[0]
            .layers[0].cels![0].marks.length;
        } catch {
          return 0;
        }
      })
      .toBe(1);
    const original = decode(new Uint8Array(await readFile(destination)));
    await page
      .getByLabel("Document title", { exact: true })
      .fill("Native retouched");
    await page.getByLabel("Document title", { exact: true }).blur();
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect
      .poll(
        async () => decode(new Uint8Array(await readFile(destination))).title,
      )
      .toBe("Native retouched");
    const external = { ...original, title: "Changed externally" };
    await writeFile(destination, encode(external));
    await page
      .getByLabel("Document title", { exact: true })
      .fill("Keep local changes");
    await page.getByLabel("Document title", { exact: true }).blur();
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("changed outside");
    expect(decode(new Uint8Array(await readFile(destination))).title).toBe(
      "Changed externally",
    );
    await page
      .getByRole("button", { name: "Back to projects", exact: true })
      .click();
    await app.close();
    app = await launch(profile);
    const reopened = await studioWindow(app);
    await expect(
      reopened.getByRole("button", {
        name: "Open Keep local changes",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await app?.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});

test("packaged media: real decoded proxies, audio and playable MP4 output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-media-")),
    profile = path.join(root, "profile"),
    destination = path.join(root, "render.mp4");
  let app: ElectronApplication | undefined;
  try {
    app = await launch(profile);
    const page = await studioWindow(app);
    await create(page, "Edit");
    await page
      .getByLabel("Import media file")
      .setInputFiles("tests/fixtures/two-colors-tone.webm");
    await expect(page.getByText(/Bounded video proxy imported/)).toBeVisible({
      timeout: 45000,
    });
    await page
      .getByRole("spinbutton", { name: "Work area out", exact: true })
      .fill("48");
    await page
      .getByRole("spinbutton", { name: "Work area out", exact: true })
      .blur();
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, destination);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Export animation" });
    await modal.getByLabel("Only the work area", { exact: true }).check();
    await modal.getByLabel("Export resolution").selectOption("960");
    await expect(
      modal.getByRole("button", { name: "Export MP4", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await modal
      .getByRole("button", { name: "Export MP4", exact: true })
      .click();
    await expect(modal).toHaveCount(0, { timeout: 60000 });
    const bytes = await readFile(destination);
    expect(bytes.length).toBeGreaterThan(10000);
    expect(bytes.toString("ascii", 4, 8)).toBe("ftyp");
    const movie = new Input({
      source: new BufferSource(new Uint8Array(bytes)),
      formats: ALL_FORMATS,
    });
    try {
      expect(await movie.getPrimaryVideoTrack()).not.toBeNull();
      expect(await movie.getPrimaryAudioTrack()).not.toBeNull();
      expect(await movie.computeDuration()).toBeGreaterThan(1.9);
    } finally {
      movie.dispose();
    }
  } finally {
    await app?.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});

test("packaged verified library backup and restore avoid resaving the previous in-memory document", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-backup-")),
    profile = path.join(root, "profile");
  let app: ElectronApplication | undefined;
  try {
    app = await launch(profile);
    const page = await studioWindow(app);
    await create(page);
    await ink(page);
    await page
      .getByRole("button", { name: "Back to projects", exact: true })
      .click();
    const first = await page.evaluate(() => window.studio!.library.list());
    expect(first).toHaveLength(1);
    await page.evaluate(() => window.studio!.library.backup());
    await page
      .getByRole("button", { name: "Open Native first release", exact: true })
      .click();
    await page
      .getByLabel("Document title", { exact: true })
      .fill("Changed after backup");
    await page.getByLabel("Document title", { exact: true }).blur();
    await page
      .getByRole("button", { name: "Back to projects", exact: true })
      .click();
    page.on("dialog", (dialog) => void dialog.accept());
    await page
      .getByRole("button", { name: "Updates & backups", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Restore", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Open Native first release",
        exact: true,
      }),
    ).toBeVisible();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.studio!.library.list());
    expect(after[0].title).toBe("Native first release");
  } finally {
    await app?.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
