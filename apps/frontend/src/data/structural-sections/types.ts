export type SectionType = 'I-BEAM' | 'TUBE' | 'L-ANGLE' | 'RECTANGLE' | 'CIRCLE' | 'C-CHANNEL';

export interface SectionDimensions {
  height?: number;
  width?: number;
  webThickness?: number;
  flangeThickness?: number;
  outerWidth?: number;
  outerHeight?: number;
  thickness?: number;
  legWidth?: number;
  legHeight?: number;
  rectWidth?: number;
  rectHeight?: number;
  diameter?: number;
  channelHeight?: number;
  channelWidth?: number;
  channelThickness?: number;
}

export interface StructuralSection {
  id: string;
  name: string;
  type: SectionType;
  dimensions: SectionDimensions;
  E: number;
  A: number;
  I: number;
  weight?: number;
  grade?: string;
}

export type ConnectionType =
  | 'bolted_shear'
  | 'bolted_moment'
  | 'welded_full'
  | 'welded_fillet'
  | 'pinned'
  | 'cable_socket'
  | 'base_plate'
  | 'splice'
  | 'gusset_plate';

export type BoltGrade = '4.6' | '8.8' | '10.9' | '12.9' | 'A325' | 'A490';

export type WeldType = 'CJP' | 'PJP' | 'fillet' | 'plug' | 'flare';

export interface JointConnection {
  id: string;
  name: string;
  type: ConnectionType;
  bolt?: {
    grade: BoltGrade;
    diameter: number;
    numBolts: number;
    rows: number;
    columns: number;
    pitch: number;
    gauge: number;
    edgeDistance: number;
    shearCapacity: number;
    tensionCapacity: number;
  };
  weld?: {
    type: WeldType;
    size: number;
    length: number;
    electrode: string;
    strengthMPa: number;
    capacity: number;
  };
  plate?: {
    thickness: number;
    width: number;
    length: number;
    grade: string;
  };
  capacity: {
    shear: number;
    moment?: number;
    axial?: number;
  };
  standard: string;
}
