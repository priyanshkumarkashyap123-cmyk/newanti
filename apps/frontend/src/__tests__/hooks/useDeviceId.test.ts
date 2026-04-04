import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We need to reset modules between tests so that the cached values inside the
// module don't leak across tests.  We'll dynamically import the module in each
// test (or group) after setting up the environment.

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    writable: true,
    configurable: true,
  });
}

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
const EDGE_WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useDeviceId module', () => {
  beforeEach(() => {
    // Clear and reset completely
    try {
      localStorage.clear();
    } catch (e) {
      // localStorage may not be available in test environment
    }
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    // Default user-agent
    setUserAgent(CHROME_MAC_UA);

    // Reset module registry so each test gets a fresh import
    vi.resetModules();
  });

  afterEach(() => {
    try {
      localStorage.clear();
    } catch (e) {
      // localStorage may not be available in test environment
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getDeviceId
  // -------------------------------------------------------------------------

  describe('getDeviceId', () => {
    it('returns a string matching UUID format', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      expect(id).toMatch(UUID_REGEX);
      getItemSpy.mockRestore();
    });

    it('persists the id to localStorage under "beamlab_device_id"', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      expect(setItemSpy).toHaveBeenCalledWith('beamlab_device_id', id);
      setItemSpy.mockRestore();
    });

    it('returns the same ID on subsequent calls', async () => {
      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const first = getDeviceId();
      const second = getDeviceId();
      expect(first).toBe(second);
    });

    it('generates a new ID when localStorage is empty', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      expect(id).toMatch(UUID_REGEX);
      expect(setItemSpy).toHaveBeenCalledWith('beamlab_device_id', id);
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });

    it('works when localStorage throws (incognito mode)', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      // Should still return a valid UUID even though storage is broken
      expect(id).toMatch(UUID_REGEX);
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });

    it('uses crypto.randomUUID when available', async () => {
      const fakeUUID = '11111111-1111-4111-8111-111111111111';
      const randomUUIDSpy = vi.fn().mockReturnValue(fakeUUID);
      vi.stubGlobal('crypto', { randomUUID: randomUUIDSpy });

      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      expect(randomUUIDSpy).toHaveBeenCalled();
      expect(id).toBe(fakeUUID);
    });

    it('falls back to manual UUID generation when crypto.randomUUID is unavailable', async () => {
      vi.stubGlobal('crypto', {});

      const { getDeviceId } = await import('@/hooks/useDeviceId');
      const id = getDeviceId();
      expect(id).toMatch(UUID_REGEX);
    });
  });

  // -------------------------------------------------------------------------
  // getDeviceName
  // -------------------------------------------------------------------------

  describe('getDeviceName', () => {
    it('returns a string like "Chrome on macOS"', async () => {
      setUserAgent(CHROME_MAC_UA);
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      expect(getDeviceName()).toBe('Chrome on macOS');
    });

    it('persists to localStorage under "beamlab_device_name"', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      const name = getDeviceName();
      expect(setItemSpy).toHaveBeenCalledWith('beamlab_device_name', name);
      setItemSpy.mockRestore();
    });

    it('returns cached name on second call', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      const first = getDeviceName();
      const second = getDeviceName();
      expect(first).toBe(second);
      expect(getItemSpy).toHaveBeenCalledWith('beamlab_device_name');
      getItemSpy.mockRestore();
    });

    it('works when localStorage throws', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      const name = getDeviceName();
      expect(typeof name).toBe('string');
      expect(name).toContain(' on ');
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // detectDeviceName (tested indirectly through getDeviceName)
  // -------------------------------------------------------------------------

  describe('detectDeviceName browser detection', () => {
    it('detects Firefox', async () => {
      setUserAgent(FIREFOX_WIN_UA);
      // Force localStorage miss so detection runs
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      expect(getDeviceName()).toBe('Firefox on Windows');
      getItemSpy.mockRestore();
    });

    it('detects Edge', async () => {
      setUserAgent(EDGE_WIN_UA);
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      const { getDeviceName } = await import('@/hooks/useDeviceId');
      expect(getDeviceName()).toBe('Edge on Windows');
      getItemSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // useDeviceId hook
  // -------------------------------------------------------------------------

  describe('useDeviceId hook', () => {
    it('returns deviceId and deviceName', async () => {
      const { useDeviceId } = await import('@/hooks/useDeviceId');
      const { result } = renderHook(() => useDeviceId());
      expect(result.current.deviceId).toMatch(UUID_REGEX);
      expect(typeof result.current.deviceName).toBe('string');
    });

    it('returns stable references across re-renders', async () => {
      const { useDeviceId } = await import('@/hooks/useDeviceId');
      const { result, rerender } = renderHook(() => useDeviceId());
      const firstId = result.current.deviceId;
      const firstName = result.current.deviceName;

      rerender();

      expect(result.current.deviceId).toBe(firstId);
      expect(result.current.deviceName).toBe(firstName);
    });
  });
});
