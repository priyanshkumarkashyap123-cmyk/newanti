/**
 * Compute Preference + Capability Detection
 *
 * Lets users explicitly choose where structural analysis should run:
 * - local : Prefer browser-side WASM/WebGPU for low-latency runs
 * - cloud : Force backend execution (Rust/Python services)
 * - auto  : Choose local only when the device looks capable
 */

export type ComputePreference = 'auto' | 'local' | 'cloud';

export interface LocalComputeCapability {
  webGpuAvailable: boolean;
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  canUseLocal: boolean;
  score: number;
  maxRecommendedLocalNodes: number;
  reason: string;
}

const STORAGE_KEY = 'beamlab.compute.preference';

let cachedCapability: LocalComputeCapability | null = null;

export function getComputePreference(): ComputePreference {
  if (typeof window === 'undefined') return 'auto';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'local' || raw === 'cloud' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function setComputePreference(preference: ComputePreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, preference);
  window.dispatchEvent(new Event('beamlab.compute.preference.changed'));
}

export async function detectLocalComputeCapability(): Promise<LocalComputeCapability> {
  if (cachedCapability) return cachedCapability;

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const cpuCores = nav?.hardwareConcurrency ?? null;
  const deviceMemoryGb = (nav as Navigator & { deviceMemory?: number } | null)?.deviceMemory ?? null;

  let webGpuAvailable = false;
  try {
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      webGpuAvailable = adapter !== null;
    }
  } catch {
    webGpuAvailable = false;
  }

  let score = 0;
  if (webGpuAvailable) score += 2;
  if (cpuCores !== null && cpuCores >= 8) score += 1;
  if (deviceMemoryGb !== null && deviceMemoryGb >= 8) score += 1;

  const canUseLocal = score >= 2;

  let maxRecommendedLocalNodes = 350;
  if (score >= 4) {
    maxRecommendedLocalNodes = 2500;
  } else if (score === 3) {
    maxRecommendedLocalNodes = 1200;
  } else if (score === 2) {
    maxRecommendedLocalNodes = 700;
  }

  const reason = canUseLocal
    ? 'Device appears capable for local WASM/WebGPU analysis.'
    : 'Device likely better suited for cloud solver for stability.';

  cachedCapability = {
    webGpuAvailable,
    cpuCores,
    deviceMemoryGb,
    canUseLocal,
    score,
    maxRecommendedLocalNodes,
    reason,
  };

  return cachedCapability;
}
