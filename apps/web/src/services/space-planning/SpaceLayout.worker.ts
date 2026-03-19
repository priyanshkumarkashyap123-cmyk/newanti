/// <reference lib="webworker" />
import { resolveOverlaps } from './OverlapSolver';

// Web Worker for handling intensive O(N^2) space overlap resolution
self.onmessage = (e: MessageEvent) => {
  const { type, rooms, setbacks, plot } = e.data;

  if (type === 'RESOLVE_OVERLAPS') {
    try {
      // Execute the heavy computation
      const overlapCount = resolveOverlaps(rooms, setbacks, plot);
      
      // Return the mutated rooms array and the count
      self.postMessage({ type: 'SUCCESS', rooms, overlapCount });
    } catch (error: any) {
      self.postMessage({ type: 'ERROR', message: error.message || 'Worker execution failed' });
    }
  }
};
