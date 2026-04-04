import type { ValidationError } from "../../utils/structuralValidation";
import type { ValidationGateResult } from "./validation";

export interface ValidationUiActions {
  setStructuralValidationErrors: (v: ValidationError[]) => void;
  setStructuralValidationWarnings: (v: ValidationError[]) => void;
  setStructuralValidationInfo: (v: ValidationError[]) => void;
  setShowValidationDialog: (v: boolean) => void;
}

export function applyValidationGateToUi(
  validationGate: ValidationGateResult,
  actions: ValidationUiActions,
): boolean {
  if (validationGate.status === "error") {
    actions.setStructuralValidationErrors(validationGate.errors);
    actions.setStructuralValidationWarnings(validationGate.warnings);
    actions.setStructuralValidationInfo(validationGate.info);
    actions.setShowValidationDialog(true);
    return false;
  }

  if (validationGate.status === "warning") {
    actions.setStructuralValidationErrors([]);
    actions.setStructuralValidationWarnings(validationGate.warnings);
    actions.setStructuralValidationInfo(validationGate.info);
    actions.setShowValidationDialog(true);
    return false;
  }

  if (validationGate.status === "info") {
    actions.setStructuralValidationErrors([]);
    actions.setStructuralValidationWarnings([]);
    actions.setStructuralValidationInfo(validationGate.info);
    actions.setShowValidationDialog(true);
    return false;
  }

  return true;
}