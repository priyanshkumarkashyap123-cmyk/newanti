import { StructuralBufferPool } from "../core/StructuralBufferPool";

/**
 * Estimate the in-memory bytes required for a model represented by Maps of nodes and members.
 * Uses the same packing rules as StructuralBufferPool to produce a conservative byte estimate.
 */
export function estimateModelBytesFromMaps(
  nodes: Map<string, unknown>,
  members: Map<string, unknown>,
): number {
  // Create a temporary pool, ingest maps, read stats, then dispose.
  const pool = new StructuralBufferPool(Math.max(nodes.size, 256), Math.max(members.size, 256), 16);
  try {
    // The pool expects BufferNode / BufferMember shapes but only uses counts and will
    // allocate buffers consistent with the counts; we can safely call syncFromMaps
    // with the provided Maps if they match expected minimal shapes elsewhere in the app.
    // To avoid strict typing here, cast to any — we only need counts and allocation sizes.
    // Note: syncFromMaps will call addNode/addMember which populate buffers and grow as needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).syncFromMaps(nodes as any, members as any);
    return pool.getStats().totalBytes;
  } finally {
    pool.dispose();
  }
}

/**
 * Estimate bytes from an existing pool instance (cheap).
 */
export function estimateModelBytesFromPool(pool: StructuralBufferPool): number {
  return pool.getStats().totalBytes;
}
