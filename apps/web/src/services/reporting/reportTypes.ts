export interface ProjectData {
  projectName: string;
  clientName?: string;
  engineerName?: string;
  projectNumber?: string;
  description?: string;
}

export interface NodeDisplacementRow {
  nodeId: string;
  dx: number;
  dy: number;
  dz: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface MemberForceRow {
  memberId: string;
  axial: number;
  shearY: number;
  shearZ?: number;
  momentY?: number;
  momentZ: number;
  torsion?: number;
}

export interface ReactionRow {
  nodeId: string;
  fx: number;
  fy: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

export interface DesignResult {
  memberId: string;
  section: string;
  criticalRatio: number;
  status: 'PASS' | 'FAIL';
  clause: string;
  designCode: 'IS 800:2007' | 'AISC 360-16' | 'IS 456:2000' | 'ACI 318-19';
  checkType: string;
  failureReason?: string;
}
