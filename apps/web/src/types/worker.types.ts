/**
 * Worker message/response types for computationWorker.ts
 */

export interface WorkerMessage {
  id: string;
  type:
    | 'ASSEMBLE_FRAME'
    | 'SOLVE_LINEAR_SYSTEM'
    | 'COMPUTE_MODAL_ANALYSIS'
    | 'STRESS_CALCULATION'
    | 'INTERPOLATE_DISPLACEMENT'
    | 'MATRIX_OPERATIONS';
  payload: any;
}

export interface WorkerResponse {
  id: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}
