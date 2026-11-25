import { expect, test } from "@playwright/test";

test.describe("Pixel Art Studio — Phase 1 Basic Editor", () => {
  test("opens editor, draws pixels, undoes/redoes, toggles grid, and creates a new canvas", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify core layout renders with default 32x32 canvas
    await expect(page.getByTestId("canvas-size-badge")).toHaveText("32×32");
    await expect(page.getByTestId("display-canvas")).toBeVisible();
    await expect(page.getByTestId("undo-btn")).toBeDisabled();
    await expect(page.getByTestId("redo-btn")).toBeDisabled();

    // Draw a stroke across the center of the viewport
    const viewport = page.getByTestId("canvas-viewport");
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx - 20, cy - 20);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy + 20, { steps: 6 });
    await page.mouse.up();

    // Undo should now be enabled
    await expect(page.getByTestId("undo-btn")).toBeEnabled();
    await page.getByTestId("undo-btn").click();
    await expect(page.getByTestId("undo-btn")).toBeDisabled();
    await expect(page.getByTestId("redo-btn")).toBeEnabled();

    await page.getByTestId("redo-btn").click();
    await expect(page.getByTestId("undo-btn")).toBeEnabled();

    // Switch tools via keyboard shortcuts
    await page.keyboard.press("e");
    await expect(page.getByTestId("tool-eraser")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("b");
    await expect(page.getByTestId("tool-bucket")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("i");
    await expect(page.getByTestId("tool-eyedropper")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("p");
    await expect(page.getByTestId("tool-pencil")).toHaveAttribute("data-active", "true");

    // Toggle Grid
    const gridBtn = page.getByTestId("grid-toggle-btn");
    await expect(gridBtn).toHaveAttribute("data-active", "true");
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute("data-active", "false");

    // Create New 64x64 Canvas via dialog
    await page.getByTestId("new-canvas-btn").click();
    await expect(page.getByTestId("new-canvas-dialog")).toBeVisible();
    await page.getByTestId("preset-64").click();
    await page.getByTestId("confirm-new-canvas-btn").click();

    await expect(page.getByTestId("canvas-size-badge")).toHaveText("64×64");
    await expect(page.getByTestId("undo-btn")).toBeDisabled();
  });
});
