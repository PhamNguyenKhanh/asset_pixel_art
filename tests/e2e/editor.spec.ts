import { expect, test } from "@playwright/test";

test.describe("Pixel Art Studio — Core & Piskel-like Editor (Phase 1 & 2)", () => {
  test("draws, uses shape/select tools, manages layers & frames, and opens export dialog", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify default 32x32 canvas
    await expect(page.getByTestId("canvas-size-badge")).toHaveText("32×32");
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
    await page.getByTestId("undo-btn").click();
    await expect(page.getByTestId("redo-btn")).toBeEnabled();
    await page.getByTestId("redo-btn").click();

    // Switch through Phase 2 tools via keyboard shortcuts
    await page.keyboard.press("l");
    await expect(page.getByTestId("tool-line")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("u");
    await expect(page.getByTestId("tool-rectangle")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("o");
    await expect(page.getByTestId("tool-ellipse")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("m");
    await expect(page.getByTestId("tool-select")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("v");
    await expect(page.getByTestId("tool-move")).toHaveAttribute("data-active", "true");

    // Manage Layers in Layers Tab
    await page.getByTestId("tab-layers").click();
    await expect(page.getByTestId("layer-panel")).toBeVisible();
    await page.getByTestId("add-layer-btn").click();
    await expect(page.getByTestId("tab-layers")).toContainText("Layers (2)");

    // Add Frame in Timeline & Toggle Onion Skin
    await page.getByTestId("add-frame-btn").click();
    await expect(page.getByTestId("frame-card-1")).toBeVisible();
    await page.getByTestId("onion-skin-btn").click();
    await expect(page.getByTestId("onion-skin-btn")).toHaveAttribute("data-active", "true");

    // Open Resize/Crop Dialog & resize to 64x64
    await page.getByTestId("resize-crop-btn").click();
    await expect(page.getByTestId("resize-crop-dialog")).toBeVisible();
    await page.getByTestId("resize-width-input").fill("64");
    await page.getByTestId("resize-height-input").fill("64");
    await page.getByTestId("confirm-resize-btn").click();
    await expect(page.getByTestId("canvas-size-badge")).toHaveText("64×64");

    // Open Export Dialog and verify format tabs
    await page.getByTestId("export-btn").click();
    await expect(page.getByTestId("export-dialog")).toBeVisible();
    await page.getByTestId("export-tab-spritesheet").click();
    await page.getByTestId("export-tab-gif").click();
    await page.getByTestId("export-tab-project").click();
  });
});
