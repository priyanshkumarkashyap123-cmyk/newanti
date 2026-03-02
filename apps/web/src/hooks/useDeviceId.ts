/**
 * useDeviceId - Generates and persists a unique device identifier
 *
 * Uses localStorage to maintain a stable device ID across sessions.
 * This ID is sent with every API request to identify the device for
 * session management and analysis lock enforcement.
 */

import { useEffect, useState } from 'react';

const DEVICE_ID_KEY = 'beamlab_device_id';
const DEVICE_NAME_KEY = 'beamlab_device_name';

/**
 * Generate a UUID v4-like identifier
 */
function generateDeviceId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Detect a human-readable device name from the user agent
 */
function detectDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('CrOS')) os = 'ChromeOS';

    return `${browser} on ${os}`;
}

/**
 * Get or create the device ID (synchronous — can be called outside React)
 */
export function getDeviceId(): string {
    try {
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = generateDeviceId();
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch {
        // localStorage unavailable (incognito, etc.)
        return generateDeviceId();
    }
}

/**
 * Get or detect the device name
 */
export function getDeviceName(): string {
    try {
        let name = localStorage.getItem(DEVICE_NAME_KEY);
        if (!name) {
            name = detectDeviceName();
            localStorage.setItem(DEVICE_NAME_KEY, name);
        }
        return name;
    } catch {
        return detectDeviceName();
    }
}

/**
 * React hook for device identification
 */
export function useDeviceId() {
    const [deviceId] = useState(() => getDeviceId());
    const [deviceName] = useState(() => getDeviceName());

    return { deviceId, deviceName };
}

export default useDeviceId;
