/**
 * ============================================================================
 * API PAYLOAD COMPRESSION UTILITIES
 * ============================================================================
 * 
 * Utilities for optimizing API payloads:
 * - Compression for large request/response bodies
 * - Pagination helpers
 * - Data chunking for streaming
 * - Payload size optimization
 * 
 * @version 1.0.0
 */

/**
 * Check if compression is supported by the browser
 */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Compress a string using gzip (browser native)
 */
export async function compressString(data: string): Promise<Blob> {
  if (!isCompressionSupported()) {
    return new Blob([data], { type: 'text/plain' });
  }

  const stream = new Blob([data], { type: 'text/plain' }).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  return new Response(compressedStream).blob();
}

/**
 * Decompress gzip data to string
 */
export async function decompressString(blob: Blob): Promise<string> {
  if (!isCompressionSupported()) {
    return await blob.text();
  }

  const stream = blob.stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).text();
}

/**
 * Compress JSON data if it exceeds threshold
 */
export async function compressJSON(
  data: unknown,
  threshold = 100 * 1024 // 100KB
): Promise<{ compressed: boolean; payload: string | Blob; originalSize: number; compressedSize?: number }> {
  const jsonString = JSON.stringify(data);
  const originalSize = new Blob([jsonString]).size;

  if (originalSize < threshold || !isCompressionSupported()) {
    return {
      compressed: false,
      payload: jsonString,
      originalSize,
    };
  }

  const compressedBlob = await compressString(jsonString);
  const compressedSize = compressedBlob.size;

  // Only use compression if we achieve >20% reduction
  if (compressedSize < originalSize * 0.8) {
    return {
      compressed: true,
      payload: compressedBlob,
      originalSize,
      compressedSize,
    };
  }

  return {
    compressed: false,
    payload: jsonString,
    originalSize,
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Build pagination query parameters
 */
export function buildPaginationParams(params: PaginationParams): Record<string, string> {
  return {
    page: params.page.toString(),
    page_size: params.pageSize.toString(),
    ...(params.sortBy && { sort_by: params.sortBy }),
    ...(params.sortOrder && { sort_order: params.sortOrder }),
  };
}

/**
 * Chunk large arrays for batch processing
 */
export function* chunkArray<T>(array: T[], chunkSize: number): Generator<T[]> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize);
  }
}

/**
 * Estimate payload size in bytes
 */
export function estimatePayloadSize(data: unknown): number {
  try {
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  } catch {
    return 0;
  }
}

/**
 * Check if payload exceeds size threshold
 */
export function isLargePayload(data: unknown, threshold = 100 * 1024): boolean {
  return estimatePayloadSize(data) > threshold;
}

/**
 * Optimize structural model payload by removing unnecessary data
 */
export interface OptimizationOptions {
  stripIds?: boolean;           // Remove internal IDs
  stripVisualization?: boolean; // Remove 3D rendering data
  stripMetadata?: boolean;      // Remove timestamps, user info
  precision?: number;           // Round floating point numbers
}

/**
 * Optimize a structural model payload
 */
export function optimizeModelPayload<T extends Record<string, any>>(
  model: T,
  options: OptimizationOptions = {}
): T {
  const {
    stripIds = false,
    stripVisualization = true,
    stripMetadata = true,
    precision = 6,
  } = options;

  const optimized = { ...model };

  // Remove visualization data (3D meshes, colors, etc.)
  if (stripVisualization) {
    delete optimized.renderData;
    delete optimized.visualization;
    delete optimized.meshes;
    delete optimized.colors;
  }

  // Remove metadata
  if (stripMetadata) {
    delete optimized.createdAt;
    delete optimized.updatedAt;
    delete optimized.createdBy;
    delete optimized.modifiedBy;
    delete optimized.version;
  }

  // Strip internal IDs (keep only user-defined IDs)
  if (stripIds) {
    delete optimized._id;
    delete optimized.id;
  }

  // Round numeric values to reduce payload size
  if (precision !== undefined) {
    const roundValue = (value: any): any => {
      if (typeof value === 'number') {
        return Number(value.toFixed(precision));
      }
      if (Array.isArray(value)) {
        return value.map(roundValue);
      }
      if (value !== null && typeof value === 'object') {
        const rounded: Record<string, any> = {};
        for (const key in value) {
          rounded[key] = roundValue(value[key]);
        }
        return rounded;
      }
      return value;
    };

    for (const key in optimized) {
      optimized[key] = roundValue(optimized[key]);
    }
  }

  return optimized;
}

/**
 * Create a streaming response handler for large datasets
 */
export async function* streamJSONArray<T>(
  response: Response
): AsyncGenerator<T, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse complete JSON objects from buffer
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);

        if (line) {
          try {
            yield JSON.parse(line) as T;
          } catch (e) {
            console.warn('Failed to parse JSON line:', e);
          }
        }

        boundary = buffer.indexOf('\n');
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer) as T;
      } catch (e) {
        console.warn('Failed to parse remaining buffer:', e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
