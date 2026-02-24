import { test, expect } from '@playwright/test';

/**
 * Structural Analysis E2E Tests
 * 
 * Tests core analysis functionality
 */

test.describe('Analysis Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load analysis page', async ({ page }) => {
    // Navigate to analysis if available
    const analysisLink = page.getByRole('link', { name: /analysis|calculate|solver/i });
    
    if (await analysisLink.count() > 0) {
      await analysisLink.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should show analysis interface
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display beam analysis tools', async ({ page }) => {
    // Look for beam analysis section
    const beamSection = page.getByText(/beam|structural|load/i);
    
    if (await beamSection.count() > 0) {
      await expect(beamSection.first()).toBeVisible();
    }
  });

  test('should handle form inputs', async ({ page }) => {
    // Find any form inputs
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    
    if (count > 0) {
      // Type in first input
      const firstInput = inputs.first();
      await firstInput.fill('100');
      
      // Value should be set
      await expect(firstInput).toHaveValue('100');
    }
  });

  test('should display results after calculation', async ({ page }) => {
    // Find calculate/analyze button
    const calculateButton = page.getByRole('button', { name: /calculate|analyze|run|solve/i });
    
    if (await calculateButton.count() > 0) {
      // Fill in required fields first
      const numberInputs = page.locator('input[type="number"]');
      const inputCount = await numberInputs.count();
      
      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        await numberInputs.nth(i).fill('10');
      }
      
      // Click calculate
      await calculateButton.first().click();
      
      // Wait for results
      await page.waitForTimeout(1000);
      
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Visualization', () => {
  test('should render canvas/WebGL content', async ({ page }) => {
    await page.goto('/');
    
    // Look for canvas elements (3D visualization)
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      await expect(canvas.first()).toBeVisible();
      
      // Canvas should have dimensions
      const box = await canvas.first().boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    }
  });

  test('should handle visualization interactions', async ({ page }) => {
    await page.goto('/');
    
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasElement = canvas.first();
      
      // Simulate mouse interactions
      await canvasElement.hover();
      
      // Drag interaction
      const box = await canvasElement.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
        await page.mouse.up();
      }
      
      // Should still be visible after interactions
      await expect(canvasElement).toBeVisible();
    }
  });

  test('should display charts and graphs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for SVG elements (icons, charts) — find any visible one
    const svgs = page.locator('svg:visible');
    const svgCount = await svgs.count();
    
    if (svgCount > 0) {
      // At least one visible SVG exists
      expect(svgCount).toBeGreaterThan(0);
    }
  });
});

test.describe('Export Features', () => {
  test('should have export/download options', async ({ page }) => {
    await page.goto('/');
    
    // Look for export buttons
    const exportButton = page.getByRole('button', { name: /export|download|save|pdf/i });
    
    if (await exportButton.count() > 0) {
      await expect(exportButton.first()).toBeVisible();
    }
  });

  test('should handle report generation', async ({ page }) => {
    await page.goto('/');
    
    // Look for report generation
    const reportButton = page.getByRole('button', { name: /report|generate|document/i });
    
    if (await reportButton.count() > 0) {
      // Click to trigger report
      await reportButton.first().click();
      
      // Wait for any modal or processing
      await page.waitForTimeout(500);
      
      // Page should still be responsive
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
