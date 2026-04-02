/**
 * useModuleRegistry Hook
 *
 * Provides access to the cached module registry in a React component.
 * Handles loading, error handling, and memoization.
 */

import { useEffect, useState, useMemo } from 'react';
import type { ModuleRegistry, ModuleRegistryEntry } from '../config/module-registry.types';
import type { MemberKind, DesignCode } from '../config/module-registry.types';
import { findRegistryEntry, findEntriesByMember, findEntriesByDesignCode } from '../config/module-registry.types';

/**
 * Load and parse the registry JSON file
 */
async function loadRegistry(): Promise<ModuleRegistry> {
  const response = await fetch('/config/module-registry.json');
  if (!response.ok) {
    throw new Error(`Failed to load module registry: ${response.statusText}`);
  }
  return response.json();
}

// Cache to avoid re-loading
let registryCache: ModuleRegistry | null = null;

/**
 * React hook to access the module registry
 *
 * Usage:
 * ```tsx
 * const { registry, loading, error } = useModuleRegistry();
 * const beam = registry?.entries.find(e => e.id === 'concrete_beam');
 * ```
 */
export function useModuleRegistry() {
  const [registry, setRegistry] = useState<ModuleRegistry | null>(registryCache);
  const [loading, setLoading] = useState(!registryCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (registryCache) {
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const loaded = await loadRegistry();
        registryCache = loaded;
        setRegistry(loaded);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useModuleRegistry]', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { registry, loading, error };
}

/**
 * Convenience hook to find a specific module by member kind + design code
 */
export function useModuleByKind(memberKind: MemberKind, designCode: DesignCode) {
  const { registry, loading, error } = useModuleRegistry();

  return useMemo(
    () => ({
      module: registry ? findRegistryEntry(registry, memberKind, designCode) : undefined,
      loading,
      error,
    }),
    [registry, loading, error, memberKind, designCode],
  );
}

/**
 * Convenience hook to get all modules for a member kind
 */
export function useModulesByMember(memberKind: MemberKind) {
  const { registry, loading, error } = useModuleRegistry();

  return useMemo(
    () => ({
      modules: registry ? findEntriesByMember(registry, memberKind) : [],
      loading,
      error,
    }),
    [registry, loading, error, memberKind],
  );
}

/**
 * Convenience hook to get the API endpoint for a given module
 */
export function useModuleApiEndpoint(moduleId: string): string | null {
  const { registry } = useModuleRegistry();

  return useMemo(() => {
    const module = registry?.entries.find((e) => e.id === moduleId);
    return module?.backend.endpoint ?? null;
  }, [registry, moduleId]);
}
