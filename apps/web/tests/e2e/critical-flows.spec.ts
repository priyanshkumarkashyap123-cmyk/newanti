import { test, expect, Page } from '@playwright/test';

/**
 * ============================================================================
 * CRITICAL USER FLOWS E2E TESTS
 * ============================================================================
 * 
 * Tests for the most important user journeys:
 * 1. Model Creation & Analysis
 * 2. Project Save & Load
 * 3. Export Functionality
 * 4. Design Code Checks
 * 
 * Run: pnpm test:e2e tests/e2e/critical-flows.spec.ts
 * ============================================================================
 */

test.describe('Model Creation Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for app to load
        await page.waitForSelector('[data-testid="modeler-canvas"]', { timeout: 30000 });
    });

    test('should create nodes and members', async ({ page }) => {
        // Select node tool
        await page.click('[data-testid="tool-node"]');
        
        // Click on canvas to create nodes (simplified - actual implementation may differ)
        const canvas = page.locator('[data-testid="modeler-canvas"]');
        await canvas.click({ position: { x: 100, y: 300 } });
        await canvas.click({ position: { x: 300, y: 300 } });
        await canvas.click({ position: { x: 500, y: 300 } });

        // Select member tool
        await page.click('[data-testid="tool-member"]');
        
        // Connect nodes
        await canvas.click({ position: { x: 100, y: 300 } });
        await canvas.click({ position: { x: 300, y: 300 } });
        
        await canvas.click({ position: { x: 300, y: 300 } });
        await canvas.click({ position: { x: 500, y: 300 } });

        // Verify nodes created
        const nodeCount = await page.locator('[data-testid="node-marker"]').count();
        expect(nodeCount).toBeGreaterThanOrEqual(3);
    });

    test('should add supports', async ({ page }) => {
        // First create a simple beam
        await createSimpleBeam(page);

        // Select support tool
        await page.click('[data-testid="tool-support"]');

        // Click on first node
        await page.click('[data-testid="node-N1"]');

        // Select fixed support from dialog
        await page.click('[data-testid="support-fixed"]');
        await page.click('[data-testid="apply-support"]');

        // Verify support icon appears
        await expect(page.locator('[data-testid="support-icon-N1"]')).toBeVisible();
    });

    test('should add loads', async ({ page }) => {
        await createSimpleBeam(page);
        await addSupports(page);

        // Select load tool
        await page.click('[data-testid="tool-load"]');

        // Click on middle node
        await page.click('[data-testid="node-N2"]');

        // Enter load values
        await page.fill('[data-testid="load-fy"]', '-100');
        await page.click('[data-testid="apply-load"]');

        // Verify load arrow appears
        await expect(page.locator('[data-testid="load-arrow-N2"]')).toBeVisible();
    });

    test('should run analysis successfully', async ({ page }) => {
        await createSimpleBeam(page);
        await addSupports(page);
        await addLoads(page);

        // Click analyze button
        await page.click('[data-testid="analyze-button"]');

        // Wait for analysis to complete
        await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 60000 });

        // Verify results are displayed
        await expect(page.locator('[data-testid="results-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="max-displacement"]')).toBeVisible();
    });
});

test.describe('Project Save/Load Flow', () => {
    test('should save project to cloud', async ({ page }) => {
        // Login first (if required)
        await loginIfNeeded(page);

        await page.goto('/');
        await createSimpleBeam(page);

        // Open save dialog
        await page.click('[data-testid="save-project"]');
        await page.waitForSelector('[data-testid="save-dialog"]');

        // Enter project name
        await page.fill('[data-testid="project-name"]', 'E2E Test Project');

        // Click save
        await page.click('[data-testid="save-button"]');

        // Wait for success message
        await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 10000 });
    });

    test('should load project from cloud', async ({ page }) => {
        await loginIfNeeded(page);
        
        await page.goto('/');

        // Open projects panel
        await page.click('[data-testid="open-project"]');
        await page.waitForSelector('[data-testid="projects-list"]');

        // Click on first project
        await page.click('[data-testid="project-item"]:first-child');

        // Wait for project to load
        await page.waitForSelector('[data-testid="project-loaded"]', { timeout: 10000 });

        // Verify model is loaded
        const nodeCount = await page.locator('[data-testid="node-marker"]').count();
        expect(nodeCount).toBeGreaterThan(0);
    });

    test('should export to IFC', async ({ page }) => {
        await page.goto('/');
        await createSimpleBeam(page);

        // Open export menu
        await page.click('[data-testid="export-menu"]');
        await page.click('[data-testid="export-ifc"]');

        // Wait for download
        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="confirm-export"]');
        const download = await downloadPromise;

        // Verify file extension
        expect(download.suggestedFilename()).toMatch(/\.ifc$/);
    });
});

test.describe('Design Code Checks', () => {
    test('should run steel design check', async ({ page }) => {
        await page.goto('/');
        await createSimpleBeam(page);
        await addSupports(page);
        await addLoads(page);
        
        // Run analysis first
        await page.click('[data-testid="analyze-button"]');
        await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 60000 });

        // Open design panel
        await page.click('[data-testid="design-panel-tab"]');

        // Select design code
        await page.selectOption('[data-testid="design-code"]', 'AISC-360');

        // Run design check
        await page.click('[data-testid="run-design-check"]');
        await page.waitForSelector('[data-testid="design-results"]', { timeout: 30000 });

        // Verify utilization ratio is shown
        await expect(page.locator('[data-testid="utilization-ratio"]')).toBeVisible();
    });

    test('should show pass/fail status', async ({ page }) => {
        await page.goto('/');
        await createSimpleBeam(page);
        await addSupports(page);
        await addLoads(page);
        
        await page.click('[data-testid="analyze-button"]');
        await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 60000 });

        await page.click('[data-testid="design-panel-tab"]');
        await page.selectOption('[data-testid="design-code"]', 'AISC-360');
        await page.click('[data-testid="run-design-check"]');
        await page.waitForSelector('[data-testid="design-results"]', { timeout: 30000 });

        // Check for pass/fail indicator
        const passCount = await page.locator('[data-testid="check-pass"]').count();
        const failCount = await page.locator('[data-testid="check-fail"]').count();
        
        expect(passCount + failCount).toBeGreaterThan(0);
    });
});

test.describe('AI Assistant', () => {
    test('should respond to natural language input', async ({ page }) => {
        await page.goto('/');

        // Open AI assistant
        await page.click('[data-testid="ai-assistant-toggle"]');
        await page.waitForSelector('[data-testid="ai-chat-input"]');

        // Type a prompt
        await page.fill('[data-testid="ai-chat-input"]', 'Create a 3-bay steel portal frame');
        await page.click('[data-testid="ai-send-button"]');

        // Wait for response
        await page.waitForSelector('[data-testid="ai-response"]', { timeout: 30000 });

        // Verify AI responded
        await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
    });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createSimpleBeam(page: Page): Promise<void> {
    // This is a simplified helper - actual implementation depends on your UI
    // Try clicking keyboard shortcut or programmatically creating nodes
    await page.evaluate(() => {
        // Access the model store directly for test setup
        const store = (window as any).__BEAMLAB_STORE__;
        if (store?.getState) {
            const state = store.getState();
            if (state.addNode && state.addMember) {
                state.addNode({ x: 0, y: 0, z: 0 });
                state.addNode({ x: 5000, y: 0, z: 0 });
                state.addNode({ x: 10000, y: 0, z: 0 });
                state.addMember({ startNodeId: 'N1', endNodeId: 'N2' });
                state.addMember({ startNodeId: 'N2', endNodeId: 'N3' });
            }
        }
    });
    
    // Wait for rendering
    await page.waitForTimeout(500);
}

async function addSupports(page: Page): Promise<void> {
    await page.evaluate(() => {
        const store = (window as any).__BEAMLAB_STORE__;
        if (store?.getState) {
            const state = store.getState();
            if (state.setNodeRestraints) {
                state.setNodeRestraints('N1', { fx: true, fy: true, fz: true, mx: false, my: false, mz: false });
                state.setNodeRestraints('N3', { fx: false, fy: true, fz: true, mx: false, my: false, mz: false });
            }
        }
    });
    await page.waitForTimeout(100);
}

async function addLoads(page: Page): Promise<void> {
    await page.evaluate(() => {
        const store = (window as any).__BEAMLAB_STORE__;
        if (store?.getState) {
            const state = store.getState();
            if (state.addLoad) {
                state.addLoad({ nodeId: 'N2', fy: -100 }); // 100 kN downward
            }
        }
    });
    await page.waitForTimeout(100);
}

async function loginIfNeeded(page: Page): Promise<void> {
    // Check if already logged in
    const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
    if (isLoggedIn) return;

    // Navigate to login
    await page.goto('/sign-in');
    
    // Use test credentials
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@beamlab.dev');
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('[data-testid="sign-in-button"]');

    // Wait for redirect
    await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
}
