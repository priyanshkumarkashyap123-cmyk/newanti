/**
 * ============================================================================
 * TESTING UTILITIES & HELPERS
 * ============================================================================
 * 
 * Comprehensive testing utilities for integration tests:
 * - API mocking helpers
 * - Test data factories
 * - Contract testing utilities
 * - Load testing helpers
 * - Snapshot testing utilities
 * 
 * @version 1.0.0
 */

// ============================================================================
// API MOCKING
// ============================================================================

export interface MockApiConfig {
  baseUrl: string;
  delay?: number;
  failureRate?: number;
}

/**
 * Create mock API responses
 */
export class MockApiClient {
  private responses: Map<string, any> = new Map();
  private delay: number;
  private failureRate: number;

  constructor(config: MockApiConfig) {
    this.delay = config.delay || 100;
    this.failureRate = config.failureRate || 0;
  }

  /**
   * Register mock response for endpoint
   */
  mock(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }

  /**
   * Mock an API call
   */
  async fetch(endpoint: string, options?: RequestInit): Promise<Response> {
    await this.simulateDelay();

    if (this.shouldFail()) {
      throw new Error('Mock API failure');
    }

    const mockResponse = this.responses.get(endpoint);
    if (!mockResponse) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async simulateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delay));
  }

  private shouldFail(): boolean {
    return Math.random() < this.failureRate;
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.responses.clear();
  }
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Generate test structural model
 */
export function createTestModel(options: {
  nodeCount?: number;
  memberCount?: number;
  loadCount?: number;
} = {}) {
  const { nodeCount = 4, memberCount = 3, loadCount = 2 } = options;

  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node-${i + 1}`,
    x: i * 1000,
    y: 0,
    z: 0,
    restraints: i === 0 || i === nodeCount - 1 ? [true, true, true, false, false, false] : [false, false, false, false, false, false],
  }));

  const members = Array.from({ length: memberCount }, (_, i) => ({
    id: `member-${i + 1}`,
    nodeI: nodes[i].id,
    nodeJ: nodes[i + 1].id,
    section: 'ISMB 300',
    material: 'STEEL',
    E: 200000,
    A: 5626,
    Iz: 8603e4,
    Iy: 606e4,
  }));

  const loads = Array.from({ length: loadCount }, (_, i) => ({
    id: `load-${i + 1}`,
    nodeId: nodes[i + 1].id,
    Fx: 0,
    Fy: -50,
    Fz: 0,
    Mx: 0,
    My: 0,
    Mz: 0,
  }));

  return { nodes, members, loads };
}

/**
 * Generate test user
 */
export function createTestUser(overrides?: Partial<any>) {
  return {
    id: 'test-user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    subscriptionTier: 'pro',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate test analysis result
 */
export function createTestAnalysisResult(options: {
  nodeCount?: number;
  success?: boolean;
} = {}) {
  const { nodeCount = 4, success = true } = options;

  return {
    success,
    displacements: success
      ? Array.from({ length: nodeCount }, (_, i) => ({
          nodeId: `node-${i + 1}`,
          dx: Math.random() * 10 - 5,
          dy: Math.random() * 10 - 5,
          dz: Math.random() * 10 - 5,
          rx: 0,
          ry: 0,
          rz: 0,
        }))
      : [],
    forces: success
      ? Array.from({ length: nodeCount }, (_, i) => ({
          nodeId: `node-${i + 1}`,
          Fx: Math.random() * 100 - 50,
          Fy: Math.random() * 100 - 50,
          Fz: 0,
          Mx: 0,
          My: 0,
          Mz: 0,
        }))
      : [],
    error: success ? null : 'Analysis failed due to numerical instability',
  };
}

// ============================================================================
// CONTRACT TESTING
// ============================================================================

export interface ApiContract {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requestSchema?: any;
  responseSchema?: any;
  expectedStatus: number;
}

/**
 * Validate API response against contract
 */
export function validateContract(contract: ApiContract, response: Response, body?: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check status code
  if (response.status !== contract.expectedStatus) {
    errors.push(`Expected status ${contract.expectedStatus}, got ${response.status}`);
  }

  // Check Content-Type header
  const contentType = response.headers.get('Content-Type');
  if (!contentType?.includes('application/json')) {
    errors.push(`Expected Content-Type: application/json, got ${contentType}`);
  }

  // Validate response schema (basic type checking)
  if (contract.responseSchema && body) {
    const schemaErrors = validateSchema(body, contract.responseSchema);
    errors.push(...schemaErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Basic schema validation
 */
function validateSchema(data: any, schema: any): string[] {
  const errors: string[] = [];

  for (const [key, type] of Object.entries(schema)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    const actualType = typeof data[key];
    if (actualType !== type) {
      errors.push(`Field ${key}: expected ${type}, got ${actualType}`);
    }
  }

  return errors;
}

// ============================================================================
// LOAD TESTING
// ============================================================================

export interface LoadTestConfig {
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  duration: number; // in seconds
  rps: number; // requests per second
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
}

/**
 * Run load test against endpoint
 */
export async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const { endpoint, method, body, duration, rps } = config;
  const startTime = Date.now();
  const interval = 1000 / rps;
  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  const makeRequest = async () => {
    const reqStart = performance.now();
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const reqEnd = performance.now();
      latencies.push(reqEnd - reqStart);
      
      if (response.ok) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch {
      failureCount++;
    }
  };

  // Run requests
  const promises: Promise<void>[] = [];
  while (Date.now() - startTime < duration * 1000) {
    promises.push(makeRequest());
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  await Promise.all(promises);

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const totalRequests = latencies.length;
  const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / totalRequests;
  const p50Latency = latencies[Math.floor(totalRequests * 0.5)];
  const p95Latency = latencies[Math.floor(totalRequests * 0.95)];
  const p99Latency = latencies[Math.floor(totalRequests * 0.99)];

  return {
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failureCount,
    averageLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    requestsPerSecond: totalRequests / duration,
  };
}

// ============================================================================
// SNAPSHOT TESTING
// ============================================================================

/**
 * Create snapshot of API response
 */
export function createSnapshot(response: any): string {
  return JSON.stringify(response, null, 2);
}

/**
 * Compare current response with snapshot
 */
export function compareSnapshot(current: any, snapshot: string): {
  matches: boolean;
  differences?: string[];
} {
  const currentStr = JSON.stringify(current, null, 2);
  
  if (currentStr === snapshot) {
    return { matches: true };
  }

  // Find differences
  const differences: string[] = [];
  const currentLines = currentStr.split('\n');
  const snapshotLines = snapshot.split('\n');
  
  const maxLines = Math.max(currentLines.length, snapshotLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (currentLines[i] !== snapshotLines[i]) {
      differences.push(`Line ${i + 1}: ${snapshotLines[i] || '(deleted)'} → ${currentLines[i] || '(added)'}`);
    }
  }

  return { matches: false, differences };
}

// ============================================================================
// E2E TEST HELPERS
// ============================================================================

/**
 * Wait for element to be visible
 */
export async function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

/**
 * Wait for condition to be true
 */
export async function waitFor(condition: () => boolean, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * Simulate user input
 */
export function simulateInput(element: HTMLInputElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate button click
 */
export function simulateClick(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}
