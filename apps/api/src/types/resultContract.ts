export interface Diagnostics {
  solver?: string;
  iterations?: number;
  tolerance?: number;
  conditionEstimate?: number;
  fallback?: string;
  warnings?: string[];
}

export interface SolverResult {
  passed: boolean;
  utilization: number | null;
  message?: string;
  diagnostics?: Diagnostics;
  version?: string;
}

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export default SolverResult;
