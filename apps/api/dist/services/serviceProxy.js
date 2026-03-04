const RUST_API_URL = process.env["RUST_API_URL"] || "http://localhost:8080";
const PYTHON_API_URL = process.env["PYTHON_API_URL"] || "http://localhost:8000";
const circuits = {
  rust: { failures: 0, lastFailure: 0, isOpen: false },
  python: { failures: 0, lastFailure: 0, isOpen: false }
};
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 3e4;
function checkCircuit(service) {
  const circuit = circuits[service];
  if (!circuit.isOpen) return true;
  if (Date.now() - circuit.lastFailure > CIRCUIT_RESET_MS) {
    circuit.isOpen = false;
    circuit.failures = 0;
    return true;
  }
  return false;
}
function recordSuccess(service) {
  circuits[service].failures = 0;
  circuits[service].isOpen = false;
}
function recordFailure(service) {
  const circuit = circuits[service];
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= CIRCUIT_THRESHOLD) {
    circuit.isOpen = true;
    console.error(`[ServiceProxy] Circuit OPEN for ${service} after ${circuit.failures} failures`);
  }
}
async function proxyRequest(options) {
  const {
    service,
    method,
    path,
    body,
    query,
    timeoutMs = 6e4,
    retries = 1
  } = options;
  const baseUrl = service === "rust" ? RUST_API_URL : PYTHON_API_URL;
  const start = Date.now();
  if (!checkCircuit(service)) {
    return {
      success: false,
      status: 503,
      error: `Service ${service} circuit is OPEN \u2014 too many recent failures. Retry in ${Math.ceil(CIRCUIT_RESET_MS / 1e3)}s.`,
      service,
      latencyMs: 0
    };
  }
  let url = `${baseUrl}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== void 0 && value !== null) {
        params.append(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const fetchOptions = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Forwarded-By": "beamlab-node-gateway"
        },
        signal: controller.signal
      };
      if (body && (method === "POST" || method === "PUT")) {
        fetchOptions.body = JSON.stringify(body);
      }
      const response = await fetch(url, fetchOptions);
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (response.ok) {
        recordSuccess(service);
        const data = await response.json();
        return { success: true, status: response.status, data, service, latencyMs };
      }
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
      }
      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          status: response.status,
          error: errorBody || `${service} returned ${response.status}`,
          service,
          latencyMs
        };
      }
      recordFailure(service);
      lastError = errorBody || `${service} returned ${response.status}`;
      console.warn(`[ServiceProxy] ${service} ${method} ${path} \u2192 ${response.status} (attempt ${attempt + 1})`);
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("abort")) {
        lastError = `Request to ${service} timed out after ${timeoutMs}ms`;
      } else {
        lastError = `Connection to ${service} failed: ${message}`;
      }
      recordFailure(service);
      console.warn(`[ServiceProxy] ${service} ${method} ${path} \u2192 error (attempt ${attempt + 1}): ${lastError}`);
    }
  }
  return {
    success: false,
    status: 502,
    error: lastError,
    service,
    latencyMs: Date.now() - start
  };
}
async function rustProxy(method, path, body, query, timeoutMs) {
  return proxyRequest({ service: "rust", method, path, body, query, timeoutMs });
}
async function pythonProxy(method, path, body, query, timeoutMs) {
  return proxyRequest({ service: "python", method, path, body, query, timeoutMs });
}
async function checkBackendHealth() {
  const [rustHealth, pythonHealth] = await Promise.all([
    rustProxy("GET", "/health", void 0, void 0, 5e3),
    pythonProxy("GET", "/health", void 0, void 0, 5e3)
  ]);
  return {
    rust: { healthy: rustHealth.success, latencyMs: rustHealth.latencyMs },
    python: { healthy: pythonHealth.success, latencyMs: pythonHealth.latencyMs }
  };
}
function getServiceCircuitStats() {
  return { ...circuits };
}
export {
  checkBackendHealth,
  getServiceCircuitStats,
  proxyRequest,
  pythonProxy,
  rustProxy
};
//# sourceMappingURL=serviceProxy.js.map
