import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decode } from "../src/core/codec";
import type { Document } from "../src/core/model";
import type { Studio } from "../src/state/studio";
import { pose, bonesAt } from "../src/core/motion";
async function create(page: Page, workspace = "Draw", name = "Studio test") {
  await page.goto("/");
  await page
    .getByRole("button", { name: `New ${workspace} project`, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Project name", { exact: true }).fill(name);
  await dialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByTestId("canvas")).toBeVisible();
}
async function snapshot(page: Page): Promise<{
  document: Document;
  scene: string;
  frame: number;
  history: number;
  interacting: boolean;
  preferences: Studio["preferences"];
}> {
  return page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((u) => /\/src\/state\/studio\.ts(?:\?|$)/.test(u))!;
    const { useStudio } = await import(/* @vite-ignore */ url);
    const s = useStudio.getState();
    return {
      document: s.document!,
      scene: s.sceneId,
      frame: s.frame,
      history: s.history.length,
      interacting: s.interacting,
      preferences: s.preferences,
    };
  });
}
async function ink(page: Page, offset = 0) {
  const r = await page.getByTestId("canvas").boundingBox();
  expect(r).toBeTruthy();
  await page.mouse.move(
    r!.x + r!.width * 0.25 + offset,
    r!.y + r!.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    r!.x + r!.width * 0.58 + offset,
    r!.y + r!.height * 0.6,
    { steps: 18 },
  );
  await page.mouse.up();
}
async function portable(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Export .lam copy…", exact: true })
    .click();
  return decode(
    new Uint8Array(await readFile((await (await download).path())!)),
  );
}

test("new identity, project home and optional setup have no fake projects or paid unlocks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("LUNO", { exact: false }).first()).toBeVisible();
  await expect(page.locator(".project-row")).toHaveCount(0);
  await expect(page.locator(".project-table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New Draw project", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Workspace setup", exact: false })
    .click();
  const setup = page.getByRole("dialog", { name: "Workspace setup" });
  await expect(setup).toContainText("Choose a workspace");
  await setup.getByRole("button", { name: "Skip setup", exact: true }).click();
  await expect(setup).toHaveCount(0);
  await expect(page.getByText("Unlock with Pro", { exact: true })).toHaveCount(
    0,
  );
});

test("manual painting, blank/duplicate cels, Undo/Redo and binary export are real", async ({
  page,
}) => {
  await create(page);
  await ink(page);
  let s = await snapshot(page);
  expect(s.history).toBe(1);
  expect(s.document.scenes[0].layers[0].cels![0].marks).toHaveLength(1);
  await page.getByTestId("canvas").focus();
  await page.keyboard.press("F6");
  s = await snapshot(page);
  expect(s.frame).toBe(1);
  expect(s.document.scenes[0].layers[0].cels![1].marks).toHaveLength(1);
  await page.keyboard.press("F7");
  s = await snapshot(page);
  expect(s.frame).toBe(2);
  expect(s.document.scenes[0].layers[0].cels![2].marks).toHaveLength(0);
  await page.keyboard.press("Control+z");
  expect((await snapshot(page)).document.scenes[0].layers[0].cels).toHaveLength(
    2,
  );
  await page.keyboard.press("Control+Shift+z");
  expect((await snapshot(page)).document.scenes[0].layers[0].cels).toHaveLength(
    3,
  );
  expect(await portable(page)).toEqual((await snapshot(page)).document);
});

test("brush families and captured pressure/settings survive portable files", async ({
  page,
}) => {
  await create(page);
  for (const name of [
    "Studio Round",
    "Fluid Ink",
    "Soft Air",
    "Graphite",
    "Chisel Marker",
    "Pixel Square",
    "Charcoal",
    "Particle Spray",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await ink(page);
  }
  const d = (await snapshot(page)).document;
  expect(d.scenes[0].layers[0].cels![0].marks.map((m) => m.brush.tip)).toEqual([
    "round",
    "ink",
    "soft",
    "pencil",
    "marker",
    "pixel",
    "charcoal",
    "spray",
  ]);
  expect((await portable(page)).scenes[0].layers).toEqual(d.scenes[0].layers);
});

test("eraser is non-destructive within the active cel and Undo restores marks", async ({
  page,
}) => {
  await create(page);
  await ink(page);
  await page.getByRole("button", { name: "Eraser tool", exact: true }).click();
  await ink(page, 8);
  let s = await snapshot(page);
  expect(
    s.document.scenes[0].layers[0].cels![0].marks.map((m) => m.tool),
  ).toEqual(["brush", "erase"]);
  await page.getByTestId("canvas").focus();
  await page.keyboard.press("Control+z");
  s = await snapshot(page);
  expect(s.document.scenes[0].layers[0].cels![0].marks).toHaveLength(1);
});

test("fill and eyedropper use actual rendered color, not UI palette labels", async ({
  page,
}) => {
  await create(page);
  await page.getByRole("tab", { name: "Color", exact: true }).click();
  await page.getByLabel("HEX color").fill("#CF584C");
  await page.getByLabel("HEX color").blur();
  await page.getByRole("button", { name: "Fill tool", exact: true }).click();
  const r = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).document.scenes[0].layers[0].cels![0].marks[0]
          ?.tool,
    )
    .toBe("fill");
  await page
    .getByRole("button", { name: "Eyedropper tool", exact: true })
    .click();
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  expect((await snapshot(page)).preferences.foreground).toBe("#cf584c");
});

test("transform Auto-key creates a real initial pose and a later pose, not a static change", async ({
  page,
}) => {
  await create(page, "Motion");
  const original = (await snapshot(page)).document.scenes[0].layers[0];
  const ruler = page.getByRole("slider", { name: "Timeline playhead" });
  await ruler.focus();
  await ruler.press("End");
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  await x.fill("920");
  await x.press("Enter");
  let s = await snapshot(page),
    l = s.document.scenes[0].layers[0];
  expect(l.keys.map((k) => k.frame)).toEqual([0, 71]);
  expect(pose(l, 0).x).toBe(original.transform.x);
  expect(pose(l, 71).x).toBe(920);
  await ruler.focus();
  await ruler.press("Home");
  await expect(x).toHaveValue(String(original.transform.x));
  await page.keyboard.press("Control+z");
  expect((await snapshot(page)).document.scenes[0].layers[0].keys).toHaveLength(
    0,
  );
});

test("rig endpoints respond to real pointer IK and keep parent/constraint data", async ({
  page,
}) => {
  await create(page, "Motion");
  await page
    .getByRole("button", { name: "Rig pose tool", exact: true })
    .click();
  const s = await snapshot(page),
    l = s.document.scenes[0].layers[0],
    tip = l.bones!.find((b) => b.name === "Left forearm")!,
    b = bonesAt(l, 0).find((b) => b.id === tip.id)!,
    r = (await page.getByTestId("canvas").boundingBox())!,
    sx = r.width / s.document.canvas.width,
    sy = r.height / s.document.canvas.height,
    x = r.x + (l.transform.x + b.end.x) * sx,
    y = r.y + (l.transform.y + b.end.y) * sy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 20, { steps: 10 });
  await page.mouse.up();
  const after = await snapshot(page);
  expect(after.document.scenes[0].layers[0].bones).not.toEqual(l.bones);
  expect(after.history).toBe(1);
  expect(after.interacting).toBe(false);
});

test("layers, groups, visibility and locked parent guards are actual scene edits", async ({
  page,
}) => {
  await create(page, "Edit");
  await page
    .getByRole("button", { name: "Insert rectangle", exact: true })
    .click();
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  const a = (await snapshot(page)).document.scenes[0].layers;
  await page
    .getByRole("button", { name: "Select Rectangle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select Type", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.getByTestId("canvas").focus();
  await page.keyboard.press("Control+g");
  let s = await snapshot(page);
  expect(s.document.scenes[0].layers.filter((l) => l.parent)).toHaveLength(2);
  await page.getByRole("button", { name: "Lock Group", exact: true }).click();
  await page
    .getByRole("button", { name: "Select Rectangle", exact: true })
    .click();
  const before = (await snapshot(page)).document;
  await page.getByRole("spinbutton", { name: "X", exact: true }).fill("777");
  await page.getByRole("spinbutton", { name: "X", exact: true }).press("Enter");
  expect((await snapshot(page)).document).toEqual(before);
  expect(a).toHaveLength(2);
});

test("text editing, color and opacity remain editable after library reopening", async ({
  page,
}) => {
  await create(page, "Edit", "Type study");
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  await page.getByLabel("Text content").fill("A new beginning.");
  await page.getByLabel("Text content").blur();
  await page.getByLabel("Layer name", { exact: true }).fill("Opening title");
  await page.getByLabel("Layer name", { exact: true }).blur();
  await page
    .getByRole("spinbutton", { name: "Opacity", exact: true })
    .fill("65");
  await page
    .getByRole("spinbutton", { name: "Opacity", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Back to projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Type study", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select Opening title", exact: true })
    .click();
  await expect(page.getByLabel("Text content")).toHaveValue("A new beginning.");
  await expect(
    page.getByRole("spinbutton", { name: "Opacity", exact: true }),
  ).toHaveValue("65");
});

test("scene creation and reordering survive portable save with exact scene content", async ({
  page,
}) => {
  await create(page);
  await ink(page);
  await page.getByRole("tab", { name: "Scenes", exact: true }).click();
  await page.getByRole("button", { name: "New scene", exact: true }).click();
  let s = await snapshot(page);
  expect(s.document.scenes).toHaveLength(2);
  await page
    .getByRole("button", { name: "Move Scene 02 earlier", exact: true })
    .click();
  s = await snapshot(page);
  expect(s.document.scenes[0].name).toBe("Scene 02");
  expect(s.document.scenes[1].layers[0].cels![0].marks).toHaveLength(1);
  expect(await portable(page)).toEqual(s.document);
});

test("imported video is a bounded proxy with decoded sound and real split clips", async ({
  page,
}) => {
  await create(page, "Edit");
  await page
    .getByLabel("Import media file")
    .setInputFiles("tests/fixtures/two-colors-tone.webm");
  await expect(
    page.getByRole("dialog", { name: "Preparing media" }),
  ).toHaveCount(0, { timeout: 45000 });
  await expect
    .poll(
      async () =>
        (await snapshot(page)).document.assets.filter((a) => a.kind === "video")
          .length,
      { timeout: 45000 },
    )
    .toBe(1);
  let s = await snapshot(page),
    sc = s.document.scenes[0],
    clip = sc.layers[0];
  expect(sc.sounds).toHaveLength(1);
  expect(
    s.document.assets.find((a) => a.kind === "video")!.frames.length,
  ).toBeGreaterThan(35);
  await page.getByRole("slider", { name: "Timeline playhead" }).focus();
  for (let i = 0; i < 24; i++) await page.keyboard.press("ArrowRight");
  await page.getByTestId("canvas").focus();
  await page.keyboard.press("s");
  s = await snapshot(page);
  expect(s.document.scenes[0].layers).toHaveLength(2);
  expect(s.document.scenes[0].sounds).toHaveLength(2);
  expect(s.document.scenes[0].layers[0].end).toBe(24);
  expect(s.document.scenes[0].layers[1].sourceIn).toBe(1);
  expect(clip.sound).toBeTruthy();
});

test("MP4 encodes actual video/audio where available and honestly reports an unavailable H264 encoder", async ({
  page,
}) => {
  test.setTimeout(120000);
  await create(page, "Edit");
  await page
    .getByLabel("Import media file")
    .setInputFiles("tests/fixtures/two-colors-tone.webm");
  await expect
    .poll(async () => (await snapshot(page)).document.scenes[0].sounds.length, {
      timeout: 45000,
    })
    .toBe(1);
  await page
    .getByRole("spinbutton", { name: "Work area out", exact: true })
    .fill("48");
  await page
    .getByRole("spinbutton", { name: "Work area out", exact: true })
    .blur();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Export animation" });
  await modal.getByLabel("Only the work area", { exact: true }).check();
  await modal.getByLabel("Export resolution").selectOption("960");
  // Pure Chromium distributions can lack H.264. Native Linux and the local
  // Chromium acceptance run exercise actual video/audio encoding and decoding.
  await expect(modal.locator(".codec-note")).not.toContainText("Checking", {
    timeout: 30000,
  });
  if (
    (await modal.locator(".codec-note").innerText()).includes("unavailable")
  ) {
    await expect(
      modal.getByRole("button", { name: "Export MP4", exact: true }),
    ).toBeDisabled();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await snapshot(page)).document.scenes[0].sounds).toHaveLength(1);
    return;
  }
  await expect(
    modal.getByRole("button", { name: "Export MP4", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  const download = page.waitForEvent("download");
  await modal.getByRole("button", { name: "Export MP4", exact: true }).click();
  const data = await readFile((await (await download).path())!);
  expect(data.toString("ascii", 4, 8)).toBe("ftyp");
  const decoded = await page.evaluate(
    async (bytes) => {
      const seen = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((u) => u.includes("mediabunny"));
      // mediabunny is served as a real module in dev, so it may already be loaded
      // from a versionless path; fall back to importing it by package name.
      const fallback = "/node_modules/mediabunny/dist/modules/src/index.js";
      const m = await import(/* @vite-ignore */ (seen ?? fallback));
      const input = new m.Input({
        source: new m.BufferSource(new Uint8Array(bytes)),
        formats: m.ALL_FORMATS,
      });
      try {
        const video = await input.getPrimaryVideoTrack(),
          audio = await input.getPrimaryAudioTrack();
        const frame = await new m.CanvasSink(video).getCanvas(0.3),
          sound = await new m.AudioBufferSink(audio).getBuffer(0.1);
        const c = document.createElement("canvas");
        c.width = frame.canvas.width;
        c.height = frame.canvas.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(frame.canvas, 0, 0);
        const pixel = [
          ...ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data,
        ];
        return {
          video: !!video,
          audio: !!audio,
          pixel,
          peak: Math.max(
            ...sound.buffer.getChannelData(0).slice(0, 2000).map(Math.abs),
          ),
        };
      } finally {
        input.dispose();
      }
    },
    [...data],
  );
  expect(decoded.video).toBe(true);
  expect(decoded.audio).toBe(true);
  expect(decoded.peak).toBeGreaterThan(0.01);
  expect(decoded.pixel[0]).toBeGreaterThan(decoded.pixel[2]);
});

test("command search and native-like menu navigation preserve focus and do not scrub frames", async ({
  page,
}) => {
  await create(page);
  await page.keyboard.press("Control+Shift+p");
  const modal = page.getByRole("dialog", { name: "Command search" });
  await modal
    .getByRole("textbox", { name: "Search commands", exact: true })
    .fill("rectangle");
  await modal
    .getByRole("textbox", { name: "Search commands", exact: true })
    .press("Enter");
  expect(
    (await snapshot(page)).document.scenes[0].layers.some(
      (l) => l.shape === "rect",
    ),
  ).toBe(true);
  await page.getByRole("menuitem", { name: "File", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "New project…", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menuitem", { name: "File", exact: true }),
  ).toBeFocused();
  expect((await snapshot(page)).frame).toBe(0);
});

test("compact workbench and new light theme keep real docks and exports usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page, "Motion");
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page
    .getByRole("button", { name: "Toggle inspector", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "X", exact: true }),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: "X", exact: true }).fill("500");
  await page.getByRole("spinbutton", { name: "X", exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Close dock overlay", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Light interface", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Export animation" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});

test("unsupported legacy files cannot replace the active new-format document", async ({
  page,
}) => {
  await create(page, "Draw", "Protected work");
  await ink(page);
  const before = (await snapshot(page)).document;
  await page.getByLabel("Import media file").setInputFiles({
    name: "legacy.lam",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("LUNOLAM\0" + "x".repeat(60)),
  });
  await expect(page.getByRole("alert")).toContainText("legacy");
  expect((await snapshot(page)).document).toEqual(before);
});

test("canvas shows a brush-sized paint cursor that follows size, zoom and tool", async ({
  page,
}) => {
  await create(page);
  const canvas = page.getByTestId("canvas");
  const ring = page.locator(".brush-cursor");
  const hover = async (fx = 0.4, fy = 0.4) => {
    const b = (await canvas.boundingBox())!;
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
    await page.waitForTimeout(120);
    return b;
  };
  await hover();
  await expect(ring).toHaveCount(1);
  await page.getByLabel("Tip size").fill("60");
  await hover();
  const wide = (await ring.boundingBox())!;
  await page.getByLabel("Tip size").fill("40");
  await hover();
  const mid = (await ring.boundingBox())!;
  expect(wide.width).toBeGreaterThan(mid.width * 1.2);
  await page.getByRole("button", { name: "Zoom in canvas" }).click();
  await page.getByRole("button", { name: "Zoom in canvas" }).click();
  await hover();
  const zoomed = (await ring.boundingBox())!;
  expect(zoomed.width).toBeGreaterThan(mid.width * 1.1);
  await page.getByLabel("Tip size").fill("4");
  await hover();
  const tiny = (await ring.boundingBox())!;
  expect(tiny.width).toBeGreaterThanOrEqual(13);
  await page.getByRole("button", { name: "Eraser tool" }).click();
  await hover();
  await expect(ring).toHaveClass(/eraser/);
  await page.getByRole("button", { name: "Selection tool" }).click();
  await hover();
  await expect(ring).toHaveCount(0);
  await page.getByRole("button", { name: "Brush tool" }).click();
  const b = await hover();
  await expect(ring).toHaveCount(1);
  await page.mouse.move(b.x - 90, b.y - 50);
  await expect(ring).toHaveCount(0);
});

test("an app-drawn pointer is visible and exact for every canvas tool", async ({
  page,
}) => {
  await create(page);
  const well = page.locator(".canvas-well");
  const pointer = page.locator(".canvas-pointer");
  const at = async (fx: number, fy: number) => {
    const b = (await well.boundingBox())!;
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
    await page.waitForTimeout(120);
    return { x: b.x + b.width * fx, y: b.y + b.height * fy };
  };
  const offset = async (anchor: "centre" | "tip") => {
    const box = (await pointer.boundingBox())!;
    const x = anchor === "tip" ? box.x : box.x + box.width / 2;
    const y = anchor === "tip" ? box.y : box.y + box.height / 2;
    return { box, x, y };
  };
  for (const [tool, anchor] of [
    ["Brush tool", "centre"],
    ["Eraser tool", "centre"],
    ["Fill tool", "centre"],
    ["Eyedropper tool", "centre"],
    ["Selection tool", "tip"],
    ["Hand tool", "tip"],
    ["Type tool", "centre"],
    ["Rectangle tool", "centre"],
    ["Ellipse tool", "centre"],
    ["Rig pose tool", "centre"],
  ] as const) {
    await page.getByRole("button", { name: tool }).click();
    const point = await at(0.45, 0.45);
    await expect(pointer).toHaveCount(1);
    const { x, y } = await offset(anchor);
    expect(Math.abs(x - point.x)).toBeLessThan(10);
    expect(Math.abs(y - point.y)).toBeLessThan(10);
    // a fresh mount must not reset the pointer to the corner
    await page.mouse.move(24, 24);
    await expect(pointer).toHaveCount(0);
    const again = await at(0.6, 0.55);
    const remounted = await offset(anchor);
    expect(Math.abs(remounted.x - again.x)).toBeLessThan(10);
    expect(Math.abs(remounted.y - again.y)).toBeLessThan(10);
  }
  // the system cursor is suppressed only while the drawn pointer is active
  expect(
    await well.evaluate((el) => getComputedStyle(el).cursor),
  ).toBe("none");
  await page.mouse.move(24, 24);
  expect(
    await page
      .locator(".canvas-well")
      .evaluate((el) => getComputedStyle(el).cursor),
  ).not.toBe("none");
});
