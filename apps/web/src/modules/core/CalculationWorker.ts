/**
 * ============================================================================
 * CALCULATION WORKER - PHASE 2
 * ============================================================================
 * 
 * Web Worker wrapper for heavy calculations:
 * - Offloads CPU-intensive work from main thread
 * - Timeout handling
 * - Progress reporting
 * - Graceful error handling
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface WorkerTask<TInput, TOutput> {
  id: string;
  type: string;
  input: TInput;
  timeout?: number;
  onProgress?: (progress: number, message?: string) => void;
}

export interface WorkerResult<TOutput> {
  success: true;
  taskId: string;
  result: TOutput;
  executionTimeMs: number;
}

export interface WorkerError {
  success: false;
  taskId: string;
  error: string;
  code: 'TIMEOUT' | 'ERROR' | 'CANCELLED';
}

export type WorkerResponse<TOutput> = WorkerResult<TOutput> | WorkerError;

export interface WorkerPoolConfig {
  maxWorkers?: number;
  taskTimeout?: number;
  workerScript?: string;
}

// ============================================================================
// WORKER POOL
// ============================================================================

type TaskResolver<T> = {
  resolve: (value: WorkerResponse<T>) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout> | null;
  onProgress?: (progress: number, message?: string) => void;
};

export class CalculationWorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: Array<{ task: WorkerTask<unknown, unknown>; resolver: TaskResolver<unknown> }> = [];
  private activeTaskMap: Map<string, { worker: Worker; resolver: TaskResolver<unknown> }> = new Map();
  private config: Required<WorkerPoolConfig>;
  private isTerminated = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers ?? Math.min(4, navigator?.hardwareConcurrency ?? 4),
      taskTimeout: config.taskTimeout ?? 60000, // 60 seconds
      workerScript: config.workerScript ?? '/workers/calculation.worker.js',
    };
  }

  /**
   * Initialize worker pool
   */
  async initialize(): Promise<void> {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported in this environment');
      return;
    }

    for (let i = 0; i < this.config.maxWorkers; i++) {
      try {
        const worker = new Worker(this.config.workerScript, { type: 'module' });
        
        worker.onmessage = (event) => this.handleWorkerMessage(worker, event);
        worker.onerror = (event) => this.handleWorkerError(worker, event);
        
        this.workers.push(worker);
        this.idleWorkers.push(worker);
      } catch (error) {
        console.error('Failed to create worker:', error);
      }
    }

    console.log(`CalculationWorkerPool initialized with ${this.workers.length} workers`);
  }

  /**
   * Execute a calculation in a worker
   */
  async execute<TInput, TOutput>(task: WorkerTask<TInput, TOutput>): Promise<TOutput> {
    if (this.isTerminated) {
      throw new Error('Worker pool has been terminated');
    }

    // If no workers available, fall back to main thread
    if (this.workers.length === 0) {
      throw new Error('No workers available - Web Workers not supported');
    }

    return new Promise((resolve, reject) => {
      const timeout = task.timeout ?? this.config.taskTimeout;
      
      const resolver: TaskResolver<TOutput> = {
        resolve: (response) => {
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error));
          }
        },
        reject,
        timeout: null,
        onProgress: task.onProgress,
      };

      // Set timeout
      if (timeout > 0) {
        resolver.timeout = setTimeout(() => {
          this.cancelTask(task.id);
          resolver.resolve({
            success: false,
            taskId: task.id,
            error: `Task timed out after ${timeout}ms`,
            code: 'TIMEOUT',
          });
        }, timeout);
      }

      // Queue or execute immediately
      const worker = this.idleWorkers.pop();
      
      if (worker) {
        this.executeOnWorker(worker, task as WorkerTask<unknown, unknown>, resolver as TaskResolver<unknown>);
      } else {
        this.taskQueue.push({ 
          task: task as WorkerTask<unknown, unknown>, 
          resolver: resolver as TaskResolver<unknown> 
        });
      }
    });
  }

  /**
   * Execute task on specific worker
   */
  private executeOnWorker(
    worker: Worker,
    task: WorkerTask<unknown, unknown>,
    resolver: TaskResolver<unknown>
  ): void {
    this.activeTaskMap.set(task.id, { worker, resolver });
    
    worker.postMessage({
      type: 'execute',
      taskId: task.id,
      taskType: task.type,
      input: task.input,
    });
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
    const data = event.data;

    if (data.type === 'progress') {
      const entry = this.activeTaskMap.get(data.taskId);
      if (entry?.resolver.onProgress) {
        entry.resolver.onProgress(data.progress, data.message);
      }
      return;
    }

    if (data.type === 'result' || data.type === 'error') {
      const entry = this.activeTaskMap.get(data.taskId);
      
      if (entry) {
        // Clear timeout
        if (entry.resolver.timeout) {
          clearTimeout(entry.resolver.timeout);
        }

        // Resolve the promise
        entry.resolver.resolve(
          data.type === 'result'
            ? {
                success: true,
                taskId: data.taskId,
                result: data.result,
                executionTimeMs: data.executionTimeMs || 0,
              }
            : {
                success: false,
                taskId: data.taskId,
                error: data.error,
                code: 'ERROR',
              }
        );

        this.activeTaskMap.delete(data.taskId);
      }

      // Return worker to pool and process next task
      this.returnWorkerToPool(worker);
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(worker: Worker, event: ErrorEvent): void {
    console.error('Worker error:', event);

    // Find and reject any active task on this worker
    for (const [taskId, entry] of this.activeTaskMap.entries()) {
      if (entry.worker === worker) {
        if (entry.resolver.timeout) {
          clearTimeout(entry.resolver.timeout);
        }
        entry.resolver.resolve({
          success: false,
          taskId,
          error: event.message || 'Worker error',
          code: 'ERROR',
        });
        this.activeTaskMap.delete(taskId);
      }
    }

    // Remove broken worker and create new one
    this.workers = this.workers.filter((w) => w !== worker);
    this.idleWorkers = this.idleWorkers.filter((w) => w !== worker);
    
    worker.terminate();

    // Create replacement worker
    try {
      const newWorker = new Worker(this.config.workerScript, { type: 'module' });
      newWorker.onmessage = (e) => this.handleWorkerMessage(newWorker, e);
      newWorker.onerror = (e) => this.handleWorkerError(newWorker, e);
      this.workers.push(newWorker);
      this.returnWorkerToPool(newWorker);
    } catch (error) {
      console.error('Failed to create replacement worker:', error);
    }
  }

  /**
   * Return worker to pool and process next task
   */
  private returnWorkerToPool(worker: Worker): void {
    const nextTask = this.taskQueue.shift();
    
    if (nextTask) {
      this.executeOnWorker(worker, nextTask.task, nextTask.resolver);
    } else {
      this.idleWorkers.push(worker);
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    // Check if in queue
    const queueIdx = this.taskQueue.findIndex((t) => t.task.id === taskId);
    if (queueIdx !== -1) {
      const task = this.taskQueue.splice(queueIdx, 1)[0];
      if (task.resolver.timeout) clearTimeout(task.resolver.timeout);
      task.resolver.resolve({
        success: false,
        taskId,
        error: 'Task cancelled',
        code: 'CANCELLED',
      });
      return true;
    }

    // Check if active
    const entry = this.activeTaskMap.get(taskId);
    if (entry) {
      // Can't truly cancel a running worker, but we can ignore the result
      if (entry.resolver.timeout) clearTimeout(entry.resolver.timeout);
      this.activeTaskMap.delete(taskId);
      return true;
    }

    return false;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    idleWorkers: number;
    activeTasks: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      idleWorkers: this.idleWorkers.length,
      activeTasks: this.activeTaskMap.size,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.isTerminated = true;

    // Reject all queued tasks
    for (const { task, resolver } of this.taskQueue) {
      if (resolver.timeout) clearTimeout(resolver.timeout);
      resolver.resolve({
        success: false,
        taskId: task.id,
        error: 'Worker pool terminated',
        code: 'CANCELLED',
      });
    }
    this.taskQueue = [];

    // Reject all active tasks
    for (const [taskId, entry] of this.activeTaskMap.entries()) {
      if (entry.resolver.timeout) clearTimeout(entry.resolver.timeout);
      entry.resolver.resolve({
        success: false,
        taskId,
        error: 'Worker pool terminated',
        code: 'CANCELLED',
      });
    }
    this.activeTaskMap.clear();

    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.idleWorkers = [];
  }
}

// ============================================================================
// SINGLETON POOL
// ============================================================================

let defaultPool: CalculationWorkerPool | null = null;

export function getWorkerPool(): CalculationWorkerPool {
  if (!defaultPool) {
    defaultPool = new CalculationWorkerPool();
  }
  return defaultPool;
}

export async function initializeWorkerPool(config?: WorkerPoolConfig): Promise<CalculationWorkerPool> {
  if (defaultPool) {
    defaultPool.terminate();
  }
  defaultPool = new CalculationWorkerPool(config);
  await defaultPool.initialize();
  return defaultPool;
}

// ============================================================================
// HELPER FOR MAIN THREAD FALLBACK
// ============================================================================

/**
 * Execute calculation with worker fallback to main thread
 */
export async function executeWithWorkerFallback<TInput, TOutput>(
  taskType: string,
  input: TInput,
  mainThreadFn: (input: TInput) => TOutput | Promise<TOutput>,
  options?: {
    timeout?: number;
    onProgress?: (progress: number, message?: string) => void;
  }
): Promise<TOutput> {
  const pool = getWorkerPool();
  
  // If no workers, run on main thread
  if (pool.getStats().totalWorkers === 0) {
    return mainThreadFn(input);
  }

  try {
    return await pool.execute({
      id: `${taskType}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: taskType,
      input,
      timeout: options?.timeout,
      onProgress: options?.onProgress,
    });
  } catch (error) {
    // Fallback to main thread
    console.warn(`Worker execution failed, falling back to main thread: ${error}`);
    return mainThreadFn(input);
  }
}
