import { expect, test } from "@playwright/test";

test.describe("Pixel Art Studio — Complete Feature Flow (Phases 1–5)", () => {
  test("draws, switches context, uses Smart Fill, enables & tunes Dynamic Lighting Studio, and opens export", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify default 32x32 canvas & top bar pills
    await expect(page.getByTestId("canvas-size-badge")).toHaveText("32×32");
    await expect(page.getByTestId("context-pill-btn")).toContainText("Custom");
    await expect(page.getByTestId("lighting-pill-btn")).toContainText("Light");
    await expect(page.getByTestId("display-canvas")).toBeVisible();

    // Draw a filled rectangle in the center
    const viewport = page.getByTestId("canvas-viewport");
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.keyboard.press("u");
    await page.getByTestId("shape-mode-filled").click();
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 40, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId("undo-btn")).toBeEnabled();

    // Phase 3: Switch Asset Context to Furniture
    await page.getByTestId("context-pill-btn").click();
    await page.getByTestId("asset-type-furniture").click();
    await expect(page.getByTestId("context-pill-btn")).toContainText("Furniture");

    // Phase 4: Smart Fill preview & Apply
    await page.getByTestId("tab-fill").click();
    await page.getByTestId("fill-mode-material").click();
    await page.getByTestId("material-preset-wood").click();
    await page.mouse.click(cx, cy);
    await expect(page.getByTestId("smart-fill-preview-bar")).toBeVisible();
    await page.getByTestId("viewport-apply-fill-btn").click();
    await expect(page.getByTestId("smart-fill-preview-bar")).toBeHidden();

    // Phase 5: Dynamic Lighting Studio -> Enable, move light, inspect Normals, Bake & Undo
    await page.getByTestId("lighting-pill-btn").click();
    await expect(page.getByTestId("lighting-panel")).toBeVisible();
    await page.getByTestId("lighting-enable-toggle").click();
    await expect(page.getByTestId("lighting-pill-btn")).toContainText("Lit");

    await page.getByTestId("light-dir-tr").click();
    await page.getByTestId("lighting-preview-normals").click();
    await page.getByTestId("lighting-preview-lit").click();
    await page.getByTestId("bake-lighting-btn").click();
    await expect(page.getByTestId("lighting-pill-btn")).toContainText("Light");

    // Undo Bake works cleanly
    await page.getByTestId("undo-btn").click();
    await expect(page.getByTestId("redo-btn")).toBeEnabled();

    // Export Dialog opens cleanly
    await page.getByTestId("export-btn").click();
    await expect(page.getByTestId("export-dialog")).toBeVisible();
  });
});
