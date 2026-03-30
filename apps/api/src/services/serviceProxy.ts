/**
 * Service Proxy — Canonical HTTP bridge to Python & Rust backends
 * 
 * ARCHITECTURE RULE: Node.js is the API gateway. It does NOT run solvers
 * or design code checks locally. Instead, it proxies to:
 * 
 *   - Rust API  → Structural analysis, advanced analysis, templates, sections
 *   - Python    → Design codes, AI, reports, interop, educational beam analysis
 * 
 * This replaces ALL subprocess spawning (child_process.spawn) with proper
 * HTTP calls that have:
 *   - Timeouts & retries
 *   - Circuit breaking
 *   - Structured error handling
 *   - Unified logging
 */

import { env } from '../config/env.js';
import {
    assertServiceTrustConfigured,
    getInternalServiceHeaders,
} from '../config/serviceTrust.js';
import { logger } from '../utils/logger.js';

// ============================================
// SERVICE URLs (from environment or defaults)
// ============================================

const RUST_API_URL = process.env['RUST_API_URL'] || process.env['RUST_SERVICE_URL'] || 'http://localhost:8080';
const PYTHON_API_URL = process.env['PYTHON_API_URL'] || process.env['PYTHON_SERVICE_URL'] || 'http://localhost:8000';

function normalizeServiceBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
}

// ============================================
// CIRCUIT BREAKER STATE
// ============================================

interface CircuitState {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
}

const circuits: Record<string, CircuitState> = {
    rust: { failures: 0, lastFailure: 0, isOpen: false },
    python: { failures: 0, lastFailure: 0, isOpen: false },
};

const CIRCUIT_THRESHOLD = 5;     // failures before opening
const CIRCUIT_RESET_MS = 30_000; // 30s half-open window

function checkCircuit(service: 'rust' | 'python'): boolean {
    const circuit = circuits[service];
    if (!circuit.isOpen) return true;

    // Half-open: allow retry after reset window
    if (Date.now() - circuit.lastFailure > CIRCUIT_RESET_MS) {
        circuit.isOpen = false;
        circuit.failures = 0;
        return true;
    }
    return false;
}

function recordSuccess(service: 'rust' | 'python'): void {
    circuits[service].failures = 0;
    circuits[service].isOpen = false;
}

function recordFailure(service: 'rust' | 'python'): void {
    const circuit = circuits[service];
    circuit.failures++;
    circuit.lastFailure = Date.now();
    if (circuit.failures >= CIRCUIT_THRESHOLD) {
        circuit.isOpen = true;
        logger.error(`[ServiceProxy] Circuit OPEN for ${service} after ${circuit.failures} failures`);
    }
}

// ============================================
// CORE PROXY FUNCTION
// ============================================

export interface ProxyOptions {
    /** Target backend service */
    service: 'rust' | 'python';
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    /** Path on the target service (e.g., '/api/analyze') */
    path: string;
    /** Request body (for POST/PUT) */
    body?: unknown;
    /** Query parameters */
    query?: Record<string, string | number | undefined>;
    /** Timeout in ms (default: 60s for analysis, 30s for other) */
    timeoutMs?: number;
    /** Number of retries on failure (default: 1) */
    retries?: number;
    /** Upstream request correlation ID */
    requestId?: string;
}

export interface ProxyResult<T = unknown> {
    success: boolean;
    status: number;
    data?: T;
    error?: string;
    service: string;
    latencyMs: number;
}

/**
 * Execute an HTTP request to a backend service with circuit breaking,
 * timeouts, retries, and structured error handling.
 */
export async function proxyRequest<T = unknown>(options: ProxyOptions): Promise<ProxyResult<T>> {
    const {
        service,
        method,
        path,
        body,
        query,
        timeoutMs = 60_000,
        retries = 1,
        requestId,
    } = options;

    const baseUrl = normalizeServiceBaseUrl(service === 'rust' ? RUST_API_URL : PYTHON_API_URL);
    const start = Date.now();

    // Check circuit breaker
    if (!checkCircuit(service)) {
        return {
            success: false,
            status: 503,
            error: `Service ${service} circuit is OPEN — too many recent failures. Retry in ${Math.ceil(CIRCUIT_RESET_MS / 1000)}s.`,
            service,
            latencyMs: 0,
        };
    }

    // Build URL with query params
    let url = `${baseUrl}${path}`;
    if (query) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }

    // Retry loop
    let lastError: string = '';
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            const serviceTrust = assertServiceTrustConfigured();
            if (!serviceTrust.ok) {
                return {
                    success: false,
                    status: 503,
                    error: `Internal service trust misconfigured: ${serviceTrust.reason}`,
                    service,
                    latencyMs: Date.now() - start,
                };
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...getInternalServiceHeaders(requestId),
            };

            const fetchOptions: RequestInit = {
                method,
                headers,
                signal: controller.signal,
            };

            if (body && (method === 'POST' || method === 'PUT')) {
                fetchOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);
            clearTimeout(timer);

            const latencyMs = Date.now() - start;

            if (response.ok) {
                recordSuccess(service);
                const data = await response.json() as T;
                return { success: true, status: response.status, data, service, latencyMs };
            }

            // Special case: if an upstream service has not booted yet, treat 503
            // as a dependency failure instead of a generic fetch success path.
            let errorBody = '';
            try {
                errorBody = await response.text();
            } catch { /* ignore */ }

            const normalizedBody = errorBody.toLowerCase();
            if (response.status === 503 && normalizedBody.includes('service unavailable')) {
                recordFailure(service);
            }

            // 4xx errors are client errors — don't retry, don't trip circuit
            if (response.status >= 400 && response.status < 500) {
                return {
                    success: false,
                    status: response.status,
                    error: errorBody || `${service} returned ${response.status}`,
                    service,
                    latencyMs,
                };
            }

            // 5xx → record failure and maybe retry
            recordFailure(service);
            lastError = errorBody || `${service} returned ${response.status}`;
            logger.warn(`[ServiceProxy] ${service} ${method} ${path} -> ${response.status} (attempt ${attempt + 1})`);

        } catch (err: unknown) {
            const latencyMs = Date.now() - start;
            const message = err instanceof Error ? err.message : String(err);

            if (message.includes('abort')) {
                lastError = `Request to ${service} timed out after ${timeoutMs}ms`;
            } else {
                lastError = `Connection to ${service} failed: ${message}`;
            }

            recordFailure(service);
            logger.warn(`[ServiceProxy] ${service} ${method} ${path} -> error (attempt ${attempt + 1}): ${lastError}`);
        }
    }

    return {
        success: false,
        status: 502,
        error: lastError,
        service,
        latencyMs: Date.now() - start,
    };
}

// ============================================
// CONVENIENCE HELPERS
// ============================================

/** Proxy to Rust API (analysis, advanced, templates, sections) */
export async function rustProxy<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
    timeoutMs?: number,
    requestId?: string,
): Promise<ProxyResult<T>> {
    return proxyRequest<T>({ service: 'rust', method, path, body, query, timeoutMs, requestId });
}

/** Proxy to Python backend (design, AI, reports, interop) */
export async function pythonProxy<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
    timeoutMs?: number,
    requestId?: string,
): Promise<ProxyResult<T>> {
    return proxyRequest<T>({ service: 'python', method, path, body, query, timeoutMs, requestId });
}

/** Health check for both backends */
export async function checkBackendHealth(): Promise<{
    rust: { healthy: boolean; latencyMs: number };
    python: { healthy: boolean; latencyMs: number };
}> {
    const [rustHealth, pythonHealth] = await Promise.all([
        rustProxy('GET', '/health', undefined, undefined, 5000),
        pythonProxy('GET', '/health', undefined, undefined, 5000),
    ]);

    return {
        rust: { healthy: rustHealth.success, latencyMs: rustHealth.latencyMs },
        python: { healthy: pythonHealth.success, latencyMs: pythonHealth.latencyMs },
    };
}

/** Get circuit breaker stats for monitoring */
export function getServiceCircuitStats(): Record<string, CircuitState> {
    return { ...circuits };
}
