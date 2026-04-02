import type { Member, Node, NodeLoad } from "../../store/model";
import type { MemberForceData } from "../../store/model";
import { estimateModelBytesFromMaps } from "../../utils/modelMemoryEstimator";
import { ROUTING_THRESHOLDS } from "../../config";
import type { Plate } from "../../store/model";

export type AnalysisRoutingDecision = "cloud" | "worker" | "wasm";

export interface AnalysisRoutingContext {
  nodes: Map<string, Node>;
  members: Map<string, Member>;
  loads: NodeLoad[];
  memberLoads: unknown[];
  floorLoads: unknown[];
  plates: Map<string, Plate>;
  forceCloudRequested: boolean;
}

export function decideAnalysisRouting(context: AnalysisRoutingContext): AnalysisRoutingDecision {
  if (context.forceCloudRequested) return "cloud";

  const modelBytes = estimateModelBytesFromMaps(context.nodes, context.members);
  const workerCompatible = context.plates.size === 0 && context.floorLoads.length === 0;
  const shouldPreferWorkerPath =
    workerCompatible &&
    (
      context.nodes.size >= ROUTING_THRESHOLDS.worker.nodes ||
      context.members.size >= ROUTING_THRESHOLDS.worker.members ||
      modelBytes >= ROUTING_THRESHOLDS.WORKER_THRESHOLD_BYTES
    );

  if (shouldPreferWorkerPath) return "worker";
  return "wasm";
}

export async function executeAnalysisRoute(
  decision: AnalysisRoutingDecision,
  actions: {
    runCloud: () => Promise<unknown>;
    runWorker: () => Promise<unknown>;
    runWasm: () => Promise<unknown>;
  },
) {
  if (decision === "cloud") return actions.runCloud();
  if (decision === "worker") return actions.runWorker();
  return actions.runWasm();
}