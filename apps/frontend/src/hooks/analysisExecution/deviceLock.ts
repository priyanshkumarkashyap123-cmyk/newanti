import { API_CONFIG } from "../../config/env";
import { getDeviceId } from "../useDeviceId";

export interface AcquireAnalysisLockResult {
  acquired: boolean;
  conflictDeviceName?: string;
}

export async function acquireAnalysisDeviceLock(
  getToken: () => Promise<string | null>,
): Promise<AcquireAnalysisLockResult> {
  const deviceId = getDeviceId();
  const token = await getToken();
  if (!token) {
    return { acquired: true };
  }

  const lockResponse = await fetch(`${API_CONFIG.baseUrl}/api/session/analysis-lock/acquire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Device-Id": deviceId,
    },
    body: JSON.stringify({ deviceId }),
  });

  if (lockResponse.status === 409) {
    const lockData = await lockResponse.json();
    return {
      acquired: false,
      conflictDeviceName: lockData?.data?.currentLockDevice?.deviceName,
    };
  }

  return { acquired: true };
}

export async function releaseAnalysisDeviceLock(
  getToken: () => Promise<string | null>,
): Promise<void> {
  const deviceId = getDeviceId();
  const token = await getToken();
  if (!token) {
    return;
  }

  await fetch(`${API_CONFIG.baseUrl}/api/session/analysis-lock/release`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Device-Id": deviceId,
    },
    body: JSON.stringify({ deviceId }),
  });
}
