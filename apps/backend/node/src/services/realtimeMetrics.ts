/**
 * Realtime Metrics Store
 *
 * Small in-process store updated by SocketServer to allow other
 * services (vmOrchestrator, metrics router) to make decisions based
 * on current active users/projects without introducing circular
 * imports to SocketServer.
 */

export interface RealtimeMetrics {
  activeSocketUsers: number;
  activeProjects: number;
}

let current: RealtimeMetrics = { activeSocketUsers: 0, activeProjects: 0 };

export function setRealtimeMetrics(m: RealtimeMetrics): void {
  current = { ...m };
}

export function getRealtimeMetrics(): RealtimeMetrics {
  return { ...current };
}

export default { setRealtimeMetrics, getRealtimeMetrics };
