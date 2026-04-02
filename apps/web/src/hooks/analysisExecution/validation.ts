import type { Member, Node, NodeLoad } from "../../store/model";
import { runDiagnostics } from "../../engine/diagnostics";
import {
  validateStructure,
  type ValidationError,
  type ValidationResult,
} from "../../utils/structuralValidation";

export type ValidationGateStatus = "ok" | "error" | "warning" | "info";

export interface ValidationGateResult {
  status: ValidationGateStatus;
  validationResult: ValidationResult;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export function runStructuralValidationGate(
  nodes: Map<string, Node>,
  members: Map<string, Member>,
  loads: NodeLoad[],
): ValidationGateResult {
  const validationResult = validateStructure(nodes, members);

  const nodesArray = Array.from(nodes.values());
  const membersArray = Array.from(members.values());
  const supports = nodesArray
    .filter((n) => {
      const r = n.restraints;
      return !!(r && (r.fx || r.fy || r.fz || r.mx || r.my || r.mz));
    })
    .map((n) => ({
      nodeId: n.id,
      fx: n.restraints?.fx,
      fy: n.restraints?.fy,
      fz: n.restraints?.fz,
      mx: n.restraints?.mx,
      my: n.restraints?.my,
      mz: n.restraints?.mz,
    }));

  const diagSummary = runDiagnostics({
    nodes: nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
    members: membersArray.map((m) => ({
      id: m.id,
      startNodeId: m.startNodeId,
      endNodeId: m.endNodeId,
      E: m.E,
      A: m.A,
      I: m.I,
    })),
    supports,
    loads: loads.map((l) => ({ nodeId: l.nodeId, fx: l.fx, fy: l.fy, fz: l.fz })),
  });

  const diagnosticErrors: ValidationError[] = diagSummary.items
    .filter((d) => d.severity === "error")
    .map((d) => ({
      type: "error",
      message: d.message,
      details: `Code: ${d.code}`,
      affectedItems: d.entityIds,
    }));

  const diagnosticWarnings: ValidationError[] = diagSummary.items
    .filter((d) => d.severity === "warning")
    .map((d) => ({
      type: "warning",
      message: d.message,
      details: `Code: ${d.code}`,
      affectedItems: d.entityIds,
    }));

  const mergedErrors = [...validationResult.errors, ...diagnosticErrors];
  const mergedWarnings = [...validationResult.warnings, ...diagnosticWarnings];
  const mergedInfo = [...(validationResult.info || [])];

  if (!validationResult.valid || mergedErrors.length > 0) {
    return {
      status: "error",
      validationResult,
      errors: mergedErrors,
      warnings: mergedWarnings,
      info: mergedInfo,
    };
  }

  if (mergedWarnings.length > 0) {
    return {
      status: "warning",
      validationResult,
      errors: [],
      warnings: mergedWarnings,
      info: mergedInfo,
    };
  }

  if (mergedInfo.length > 0) {
    return {
      status: "info",
      validationResult,
      errors: [],
      warnings: [],
      info: mergedInfo,
    };
  }

  return {
    status: "ok",
    validationResult,
    errors: [],
    warnings: [],
    info: [],
  };
}
