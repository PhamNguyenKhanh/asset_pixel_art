import { expect, test } from "@playwright/test";

test.describe("Pixel Art Studio — Phases 1–4 Workflow", () => {
  test("draws, switches context, previews & applies Smart Fill with Undo/Redo, manages layers/frames, and opens export", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify default 32x32 canvas and Custom context
    await expect(page.getByTestId("canvas-size-badge")).toHaveText("32×32");
    await expect(page.getByTestId("context-pill-btn")).toContainText("Custom");
    await expect(page.getByTestId("display-canvas")).toBeVisible();
    await expect(page.getByTestId("undo-btn")).toBeDisabled();

    // Draw a pencil stroke
    const viewport = page.getByTestId("canvas-viewport");
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx - 20, cy - 20);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy + 20, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByTestId("undo-btn")).toBeEnabled();

    // Phase 3: Switch Asset Context to Tree
    await page.getByTestId("context-pill-btn").click();
    await expect(page.getByTestId("context-panel")).toBeVisible();
    await page.getByTestId("asset-type-tree").click();
    await expect(page.getByTestId("context-pill-btn")).toContainText("Tree");

    // Phase 4: Open Fill tab, enable Smart Fill, click canvas -> live preview bar -> Apply
    await page.getByTestId("tab-fill").click();
    await expect(page.getByTestId("smart-fill-panel")).toBeVisible();
    await page.getByTestId("fill-mode-smart").click();
    await page.getByTestId("sync-context-fill-btn").click();

    await page.mouse.click(cx + 40, cy - 40);
    await expect(page.getByTestId("smart-fill-preview-bar")).toBeVisible();
    await page.getByTestId("viewport-reseed-btn").click();
    await page.getByTestId("viewport-apply-fill-btn").click();
    await expect(page.getByTestId("smart-fill-preview-bar")).toBeHidden();

    // Undo and Redo Smart Fill cleanly
    await page.getByTestId("undo-btn").click();
    await expect(page.getByTestId("redo-btn")).toBeEnabled();
    await page.getByTestId("redo-btn").click();

    // Manage Layers & Frames
    await page.getByTestId("tab-layers").click();
    await page.getByTestId("add-layer-btn").click();
    await expect(page.getByTestId("tab-layers")).toContainText("Layers (2)");

    await page.getByTestId("add-frame-btn").click();
    await expect(page.getByTestId("frame-card-1")).toBeVisible();

    // Open Export Dialog
    await page.getByTestId("export-btn").click();
    await expect(page.getByTestId("export-dialog")).toBeVisible();
  });
});
