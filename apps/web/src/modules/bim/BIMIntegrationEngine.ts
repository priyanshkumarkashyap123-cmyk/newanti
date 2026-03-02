/**
 * ============================================================================
 * BIM INTEGRATION ENGINE
 * ============================================================================
 * 
 * Building Information Modeling integration for structural engineering:
 * - IFC file import/export
 * - Structural model extraction
 * - Property set handling
 * - Coordinate transformation
 * - Clash detection
 * - Model validation
 * 
 * Standards:
 * - IFC 2x3 / IFC 4
 * - buildingSMART specifications
 * - ISO 16739
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IFCEntity {
  expressId: number;
  type: string;
  properties: Record<string, unknown>;
  relationships: {
    parent?: number;
    children: number[];
    relatedTo: number[];
  };
}

export interface StructuralMember {
  id: string;
  ifcId?: number;
  type: 'beam' | 'column' | 'slab' | 'wall' | 'footing' | 'pile' | 'brace';
  name: string;
  material: string;
  section: string;
  geometry: {
    startPoint: { x: number; y: number; z: number };
    endPoint: { x: number; y: number; z: number };
    rotation: number;
    profileArea?: number;
    length?: number;
  };
  properties: Record<string, unknown>;
  loads?: { type: string; value: number; direction: string }[];
}

export interface StructuralNode {
  id: string;
  ifcId?: number;
  position: { x: number; y: number; z: number };
  restraints: {
    fx: boolean; fy: boolean; fz: boolean;
    mx: boolean; my: boolean; mz: boolean;
  };
  connectedMembers: string[];
}

export interface PropertySet {
  name: string;
  properties: {
    name: string;
    type: 'single' | 'bounded' | 'enumerated' | 'list';
    value: string | number | boolean | null;
    unit?: string;
  }[];
}

export interface CoordinateSystem {
  origin: { x: number; y: number; z: number };
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
  zAxis: { x: number; y: number; z: number };
}

export interface ClashResult {
  id: string;
  element1: { id: string; type: string; name: string };
  element2: { id: string; type: string; name: string };
  type: 'hard' | 'soft' | 'clearance';
  point: { x: number; y: number; z: number };
  distance: number;
  severity: 'critical' | 'major' | 'minor';
}

export interface IFCModel {
  schema: 'IFC2X3' | 'IFC4' | 'IFC4X3';
  project: {
    name: string;
    description?: string;
    author?: string;
    organization?: string;
  };
  site?: {
    name: string;
    latitude?: number;
    longitude?: number;
    elevation?: number;
  };
  building?: {
    name: string;
    stories: { name: string; elevation: number; height: number }[];
  };
  entities: Map<number, IFCEntity>;
  structuralModel?: {
    nodes: StructuralNode[];
    members: StructuralMember[];
    loads: IFCLoad[];
    loadCases: IFCLoadCase[];
  };
}

/** Recursive IFC parsed value type */
export type IFCValue = string | number | boolean | null | { ref: number } | IFCValue[];

export interface IFCLoad {
  ifcId: number;
  type: string;
  name: string;
  properties: IFCValue[];
}

export interface IFCLoadCase {
  ifcId: number;
  name: string;
  type: string;
  actionType: string;
  actionSource: string;
}

// ============================================================================
// IFC ENTITY TYPES (Common structural types)
// ============================================================================

export const IFC_STRUCTURAL_TYPES = {
  // Structural elements
  IFCBEAM: 'IfcBeam',
  IFCCOLUMN: 'IfcColumn',
  IFCSLAB: 'IfcSlab',
  IFCWALL: 'IfcWall',
  IFCFOOTING: 'IfcFooting',
  IFCPILE: 'IfcPile',
  IFCMEMBER: 'IfcMember',
  IFCPLATE: 'IfcPlate',

  // Structural analysis
  IFCSTRUCTURALCURVEMEMBER: 'IfcStructuralCurveMember',
  IFCSTRUCTURALSURFACEMEMBER: 'IfcStructuralSurfaceMember',
  IFCSTRUCTURALPOINTCONNECTION: 'IfcStructuralPointConnection',
  IFCSTRUCTURALCURVECONNECTION: 'IfcStructuralCurveConnection',
  IFCSTRUCTURALANALYSISMODEL: 'IfcStructuralAnalysisModel',

  // Loads
  IFCSTRUCTURALLOADCASE: 'IfcStructuralLoadCase',
  IFCSTRUCTURALLOADGROUP: 'IfcStructuralLoadGroup',
  IFCSTRUCTURALPOINTACTION: 'IfcStructuralPointAction',
  IFCSTRUCTURALLINEARACTION: 'IfcStructuralLinearAction',
  IFCSTRUCTURALSURFACEACTION: 'IfcStructuralSurfaceAction',

  // Connections
  IFCSTRUCTURALCONNECTIONCONDITION: 'IfcStructuralConnectionCondition',
  IFCBOUNDARYNODECONDITION: 'IfcBoundaryNodeCondition'
};

// ============================================================================
// IFC PARSER
// ============================================================================

export class IFCParser {
  private entities: Map<number, IFCEntity> = new Map();
  private schema: 'IFC2X3' | 'IFC4' | 'IFC4X3' = 'IFC4';

  /**
   * Parse IFC STEP file content
   */
  parse(content: string): IFCModel {
    this.entities.clear();

    const lines = content.split('\n');
    let headerParsed = false;

    const model: IFCModel = {
      schema: this.schema,
      project: { name: 'Unnamed Project' },
      entities: new Map()
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse header
      if (trimmed.startsWith('FILE_SCHEMA')) {
        if (trimmed.includes('IFC2X3')) {
          model.schema = 'IFC2X3';
        } else if (trimmed.includes('IFC4X3')) {
          model.schema = 'IFC4X3';
        } else if (trimmed.includes('IFC4')) {
          model.schema = 'IFC4';
        }
        headerParsed = true;
        continue;
      }

      // Parse entity lines
      if (trimmed.startsWith('#')) {
        const entity = this.parseEntityLine(trimmed);
        if (entity) {
          this.entities.set(entity.expressId, entity);
        }
      }
    }

    model.entities = this.entities;

    // Extract project info
    this.extractProjectInfo(model);

    // Extract structural model
    model.structuralModel = this.extractStructuralModel();

    return model;
  }

  /**
   * Parse a single entity line
   */
  private parseEntityLine(line: string): IFCEntity | null {
    // Format: #123= IFCENTITYTYPE(param1, param2, ...);
    const match = line.match(/^#(\d+)\s*=\s*(\w+)\s*\((.*)\)\s*;?\s*$/);
    if (!match) return null;

    const expressId = parseInt(match[1]);
    const type = match[2].toUpperCase();
    const params = this.parseParameters(match[3]);

    return {
      expressId,
      type,
      properties: { _raw: params },
      relationships: {
        children: [],
        relatedTo: []
      }
    };
  }

  /**
   * Parse parameter string
   */
  private parseParameters(paramString: string): IFCValue[] {
    const params: IFCValue[] = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if (char === "'" && paramString[i - 1] !== '\\') {
        inString = !inString;
        current += char;
      } else if (!inString) {
        if (char === '(' || char === '[') {
          depth++;
          current += char;
        } else if (char === ')' || char === ']') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          params.push(this.parseValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(this.parseValue(current.trim()));
    }

    return params;
  }

  /**
   * Parse individual parameter value
   */
  private parseValue(value: string): IFCValue {
    // Null/undefined
    if (value === '$' || value === '*') return null;

    // Reference
    if (value.startsWith('#')) {
      return { ref: parseInt(value.substring(1)) };
    }

    // String
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }

    // Number
    if (/^-?\d+\.?\d*([eE][+-]?\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Enumeration
    if (value.startsWith('.') && value.endsWith('.')) {
      return value.slice(1, -1);
    }

    // Boolean
    if (value === '.T.') return true;
    if (value === '.F.') return false;

    // List/set
    if (value.startsWith('(') && value.endsWith(')')) {
      return this.parseParameters(value.slice(1, -1));
    }

    return value;
  }

  /**
   * Extract project information
   */
  private extractProjectInfo(model: IFCModel): void {
    for (const [id, entity] of this.entities) {
      if (entity.type === 'IFCPROJECT') {
        const params = entity.properties._raw as IFCValue[];
        model.project.name = params[2] || 'Unnamed';
        model.project.description = params[3] || undefined;
      }

      if (entity.type === 'IFCSITE') {
        const params = entity.properties._raw as IFCValue[];
        model.site = {
          name: params[2] || 'Site',
          latitude: params[5]?.[0],
          longitude: params[6]?.[0],
          elevation: params[7]
        };
      }

      if (entity.type === 'IFCBUILDING') {
        const params = entity.properties._raw as IFCValue[];
        model.building = {
          name: params[2] || 'Building',
          stories: []
        };
      }

      if (entity.type === 'IFCBUILDINGSTOREY') {
        const params = entity.properties._raw as IFCValue[];
        if (model.building) {
          model.building.stories.push({
            name: params[2] || 'Story',
            elevation: params[9] || 0,
            height: 3.0 // Default height
          });
        }
      }
    }
  }

  /**
   * Extract structural model from IFC
   */
  private extractStructuralModel(): { nodes: StructuralNode[]; members: StructuralMember[]; loads: IFCLoad[]; loadCases: IFCLoadCase[] } {
    const nodes: StructuralNode[] = [];
    const members: StructuralMember[] = [];
    const loads: IFCLoad[] = [];
    const loadCases: IFCLoadCase[] = [];

    let nodeCounter = 1;
    let memberCounter = 1;

    for (const [id, entity] of this.entities) {
      // Extract structural curve members (beams, columns, braces)
      if (entity.type === 'IFCBEAM' || entity.type === 'IFCCOLUMN' || entity.type === 'IFCMEMBER') {
        const member = this.extractMember(entity, memberCounter++);
        if (member) members.push(member);
      }

      // Extract structural point connections (nodes)
      if (entity.type === 'IFCSTRUCTURALPOINTCONNECTION') {
        const node = this.extractNode(entity, nodeCounter++);
        if (node) nodes.push(node);
      }

      // Extract loads
      if (entity.type.includes('STRUCTURALACTION') || entity.type.includes('STRUCTURALLOAD')) {
        const load = this.extractLoad(entity);
        if (load) loads.push(load);
      }

      // Extract load cases
      if (entity.type === 'IFCSTRUCTURALLOADCASE') {
        const loadCase = this.extractLoadCase(entity);
        if (loadCase) loadCases.push(loadCase);
      }
    }

    return { nodes, members, loads, loadCases };
  }

  /**
   * Extract structural member from entity
   */
  private extractMember(entity: IFCEntity, counter: number): StructuralMember | null {
    const params = entity.properties._raw as IFCValue[];

    const type = entity.type === 'IFCBEAM' ? 'beam' : 
                 entity.type === 'IFCCOLUMN' ? 'column' : 'brace';

    // Extract geometry from placement and representation
    const geometry = this.extractGeometry(entity);

    return {
      id: `M${counter}`,
      ifcId: entity.expressId,
      type: type as StructuralMember['type'],
      name: params[2] || `${type}-${counter}`,
      material: 'Concrete', // Would need to traverse relationships
      section: 'Default', // Would need to traverse profile definition
      geometry: geometry || {
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        rotation: 0
      },
      properties: {}
    };
  }

  /**
   * Extract geometry from entity
   */
  private extractGeometry(entity: IFCEntity): StructuralMember['geometry'] | null {
    const params = entity.properties._raw as IFCValue[];

    // Look for placement reference
    const placementRef = params[5];
    if (placementRef?.ref) {
      const placement = this.entities.get(placementRef.ref);
      if (placement) {
        const origin = this.extractPoint(placement);
        if (origin) {
          return {
            startPoint: origin,
            endPoint: { x: origin.x + 1, y: origin.y, z: origin.z },
            rotation: 0
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract point from placement entity
   */
  private extractPoint(placement: IFCEntity): { x: number; y: number; z: number } | null {
    const params = placement.properties._raw as IFCValue[];

    for (const param of params) {
      if (param?.ref) {
        const entity = this.entities.get(param.ref);
        if (entity?.type === 'IFCCARTESIANPOINT') {
          const coords = entity.properties._raw?.[0];
          if (Array.isArray(coords) && coords.length >= 3) {
            return { x: coords[0], y: coords[1], z: coords[2] };
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract structural node
   */
  private extractNode(entity: IFCEntity, counter: number): StructuralNode | null {
    const params = entity.properties._raw as IFCValue[];

    // Extract position from placement
    let position = { x: 0, y: 0, z: 0 };
    const placementRef = params[5];
    if (placementRef?.ref) {
      const placement = this.entities.get(placementRef.ref);
      if (placement) {
        const point = this.extractPoint(placement);
        if (point) position = point;
      }
    }

    // Extract boundary conditions
    const restraints = { fx: false, fy: false, fz: false, mx: false, my: false, mz: false };
    const conditionRef = params[7];
    if (conditionRef?.ref) {
      const condition = this.entities.get(conditionRef.ref);
      if (condition?.type === 'IFCBOUNDARYNODECONDITION') {
        const condParams = condition.properties._raw as IFCValue[];
        // Parse boundary conditions
        restraints.fx = condParams[1] !== null;
        restraints.fy = condParams[2] !== null;
        restraints.fz = condParams[3] !== null;
        restraints.mx = condParams[4] !== null;
        restraints.my = condParams[5] !== null;
        restraints.mz = condParams[6] !== null;
      }
    }

    return {
      id: `N${counter}`,
      ifcId: entity.expressId,
      position,
      restraints,
      connectedMembers: []
    };
  }

  /**
   * Extract load from entity
   */
  private extractLoad(entity: IFCEntity): IFCLoad {
    const params = entity.properties._raw as IFCValue[];

    return {
      ifcId: entity.expressId,
      type: entity.type,
      name: params[2] || 'Load',
      properties: params
    };
  }

  /**
   * Extract load case
   */
  private extractLoadCase(entity: IFCEntity): IFCLoadCase {
    const params = entity.properties._raw as IFCValue[];

    return {
      ifcId: entity.expressId,
      name: params[2] || 'Load Case',
      type: params[4] || 'LOAD_CASE',
      actionType: params[5] || 'PERMANENT_G',
      actionSource: params[6] || 'DEAD_LOAD_G'
    };
  }
}

// ============================================================================
// IFC WRITER
// ============================================================================

export class IFCWriter {
  private lines: string[] = [];
  private entityId: number = 1;
  private entityMap: Map<string, number> = new Map();

  /**
   * Generate IFC file content
   */
  generate(model: IFCModel): string {
    this.lines = [];
    this.entityId = 1;
    this.entityMap.clear();

    // Write header
    this.writeHeader(model);

    // Write data section
    this.lines.push('DATA;');

    // Write project structure
    const projectId = this.writeProject(model);
    const siteId = this.writeSite(model, projectId);
    const buildingId = this.writeBuilding(model, siteId);

    // Write structural elements
    if (model.structuralModel) {
      this.writeStructuralModel(model.structuralModel, buildingId);
    }

    this.lines.push('ENDSEC;');
    this.lines.push('END-ISO-10303-21;');

    return this.lines.join('\n');
  }

  /**
   * Write IFC header
   */
  private writeHeader(model: IFCModel): void {
    const now = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];

    this.lines.push('ISO-10303-21;');
    this.lines.push('HEADER;');
    this.lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');`);
    this.lines.push(`FILE_NAME('${model.project.name}.ifc','${now}',('${model.project.author || 'Unknown'}'),('${model.project.organization || 'Unknown'}'),'','','');`);
    this.lines.push(`FILE_SCHEMA(('${model.schema}'));`);
    this.lines.push('ENDSEC;');
  }

  /**
   * Write project entity
   */
  private writeProject(model: IFCModel): number {
    const id = this.nextId();

    // Owner history
    const personId = this.nextId();
    this.lines.push(`#${personId}= IFCPERSON($,$,'${model.project.author || 'Author'}',$,$,$,$,$);`);

    const orgId = this.nextId();
    this.lines.push(`#${orgId}= IFCORGANIZATION($,'${model.project.organization || 'Organization'}',$,$,$);`);

    const personOrgId = this.nextId();
    this.lines.push(`#${personOrgId}= IFCPERSONANDORGANIZATION(#${personId},#${orgId},$);`);

    const appId = this.nextId();
    this.lines.push(`#${appId}= IFCAPPLICATION(#${orgId},'1.0','Structural Analysis Export','BIMExport');`);

    const ownerHistoryId = this.nextId();
    const timestamp = Math.floor(Date.now() / 1000);
    this.lines.push(`#${ownerHistoryId}= IFCOWNERHISTORY(#${personOrgId},#${appId},$,.ADDED.,$,#${personOrgId},#${appId},${timestamp});`);

    // Units
    const unitsId = this.writeUnits();

    // World coordinate system
    const originId = this.nextId();
    this.lines.push(`#${originId}= IFCCARTESIANPOINT((0.,0.,0.));`);

    const axisId = this.nextId();
    this.lines.push(`#${axisId}= IFCAXIS2PLACEMENT3D(#${originId},$,$);`);

    const contextId = this.nextId();
    this.lines.push(`#${contextId}= IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${axisId},$);`);

    // Project
    const projectId = this.nextId();
    this.lines.push(`#${projectId}= IFCPROJECT('${this.generateGuid()}',#${ownerHistoryId},'${model.project.name}','${model.project.description || ''}',`);
    this.lines.push(`  $,$,$,(#${contextId}),#${unitsId});`);

    this.entityMap.set('ownerHistory', ownerHistoryId);
    this.entityMap.set('context', contextId);
    this.entityMap.set('project', projectId);

    return projectId;
  }

  /**
   * Write unit assignments
   */
  private writeUnits(): number {
    // Length unit (meters)
    const lengthId = this.nextId();
    this.lines.push(`#${lengthId}= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);

    // Area unit
    const areaId = this.nextId();
    this.lines.push(`#${areaId}= IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);

    // Volume unit
    const volumeId = this.nextId();
    this.lines.push(`#${volumeId}= IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);

    // Force unit (Newtons)
    const forceId = this.nextId();
    this.lines.push(`#${forceId}= IFCSIUNIT(*,.FORCEUNIT.,$,.NEWTON.);`);

    // Unit assignment
    const unitsId = this.nextId();
    this.lines.push(`#${unitsId}= IFCUNITASSIGNMENT((#${lengthId},#${areaId},#${volumeId},#${forceId}));`);

    return unitsId;
  }

  /**
   * Write site entity
   */
  private writeSite(model: IFCModel, projectId: number): number {
    const ownerHistoryId = this.entityMap.get('ownerHistory')!;

    const placementId = this.writeLocalPlacement(null, { x: 0, y: 0, z: 0 });

    const siteId = this.nextId();
    this.lines.push(`#${siteId}= IFCSITE('${this.generateGuid()}',#${ownerHistoryId},'${model.site?.name || 'Default Site'}',$,$,#${placementId},$,$,.ELEMENT.,$,$,$,$,$);`);

    // Aggregate relationship
    const relId = this.nextId();
    this.lines.push(`#${relId}= IFCRELAGGREGATES('${this.generateGuid()}',#${ownerHistoryId},$,$,#${projectId},(#${siteId}));`);

    return siteId;
  }

  /**
   * Write building entity
   */
  private writeBuilding(model: IFCModel, siteId: number): number {
    const ownerHistoryId = this.entityMap.get('ownerHistory')!;

    const placementId = this.writeLocalPlacement(siteId, { x: 0, y: 0, z: 0 });

    const buildingId = this.nextId();
    this.lines.push(`#${buildingId}= IFCBUILDING('${this.generateGuid()}',#${ownerHistoryId},'${model.building?.name || 'Default Building'}',$,$,#${placementId},$,$,.ELEMENT.,$,$,$);`);

    // Aggregate relationship
    const relId = this.nextId();
    this.lines.push(`#${relId}= IFCRELAGGREGATES('${this.generateGuid()}',#${ownerHistoryId},$,$,#${siteId},(#${buildingId}));`);

    // Write stories
    const storyIds: number[] = [];
    for (const story of model.building?.stories || []) {
      const storyPlacementId = this.writeLocalPlacement(buildingId, { x: 0, y: 0, z: story.elevation });
      const storyId = this.nextId();
      this.lines.push(`#${storyId}= IFCBUILDINGSTOREY('${this.generateGuid()}',#${ownerHistoryId},'${story.name}',$,$,#${storyPlacementId},$,$,.ELEMENT.,${story.elevation});`);
      storyIds.push(storyId);
    }

    if (storyIds.length > 0) {
      const storyRelId = this.nextId();
      this.lines.push(`#${storyRelId}= IFCRELAGGREGATES('${this.generateGuid()}',#${ownerHistoryId},$,$,#${buildingId},(${storyIds.map(id => `#${id}`).join(',')}));`);
    }

    return buildingId;
  }

  /**
   * Write structural model
   */
  private writeStructuralModel(
    structuralModel: { nodes: StructuralNode[]; members: StructuralMember[]; loads: IFCLoad[]; loadCases: IFCLoadCase[] },
    buildingId: number
  ): void {
    const ownerHistoryId = this.entityMap.get('ownerHistory')!;

    // Write structural analysis model
    const analysisModelId = this.nextId();
    this.lines.push(`#${analysisModelId}= IFCSTRUCTURALANALYSISMODEL('${this.generateGuid()}',#${ownerHistoryId},'Structural Model',$,$,$,$,.IN_PLANE_LOADING_2D.,$);`);

    // Write members
    for (const member of structuralModel.members) {
      this.writeMember(member, buildingId);
    }

    // Write nodes/connections
    for (const node of structuralModel.nodes) {
      this.writeNode(node, analysisModelId);
    }
  }

  /**
   * Write structural member
   */
  private writeMember(member: StructuralMember, buildingId: number): number {
    const ownerHistoryId = this.entityMap.get('ownerHistory')!;

    // Create placement
    const placementId = this.writeLocalPlacement(buildingId, member.geometry.startPoint);

    // Create extrusion direction
    const dirId = this.nextId();
    const dx = member.geometry.endPoint.x - member.geometry.startPoint.x;
    const dy = member.geometry.endPoint.y - member.geometry.startPoint.y;
    const dz = member.geometry.endPoint.z - member.geometry.startPoint.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.lines.push(`#${dirId}= IFCDIRECTION((${dx / length},${dy / length},${dz / length}));`);

    // Create profile (rectangular for simplicity)
    const profileId = this.nextId();
    this.lines.push(`#${profileId}= IFCRECTANGLEPROFILEDEF(.AREA.,$,$,0.3,0.5);`);

    // Create extruded area solid
    const solidId = this.nextId();
    this.lines.push(`#${solidId}= IFCEXTRUDEDAREASOLID(#${profileId},$,#${dirId},${length});`);

    // Create shape representation
    const shapeRepId = this.nextId();
    const contextId = this.entityMap.get('context')!;
    this.lines.push(`#${shapeRepId}= IFCSHAPEREPRESENTATION(#${contextId},'Body','SweptSolid',(#${solidId}));`);

    const productRepId = this.nextId();
    this.lines.push(`#${productRepId}= IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

    // Create member entity
    const memberId = this.nextId();
    const entityType = member.type === 'beam' ? 'IFCBEAM' : 
                       member.type === 'column' ? 'IFCCOLUMN' : 'IFCMEMBER';
    this.lines.push(`#${memberId}= ${entityType}('${this.generateGuid()}',#${ownerHistoryId},'${member.name}','${member.type}',$,#${placementId},#${productRepId},$,$);`);

    return memberId;
  }

  /**
   * Write structural node
   */
  private writeNode(node: StructuralNode, analysisModelId: number): number {
    const ownerHistoryId = this.entityMap.get('ownerHistory')!;

    // Create point
    const pointId = this.nextId();
    this.lines.push(`#${pointId}= IFCCARTESIANPOINT((${node.position.x},${node.position.y},${node.position.z}));`);

    // Create vertex
    const vertexId = this.nextId();
    this.lines.push(`#${vertexId}= IFCVERTEXPOINT(#${pointId});`);

    // Create boundary condition
    const conditionId = this.nextId();
    const fx = node.restraints.fx ? 'IFCBOOLEAN(.T.)' : '$';
    const fy = node.restraints.fy ? 'IFCBOOLEAN(.T.)' : '$';
    const fz = node.restraints.fz ? 'IFCBOOLEAN(.T.)' : '$';
    const mx = node.restraints.mx ? 'IFCBOOLEAN(.T.)' : '$';
    const my = node.restraints.my ? 'IFCBOOLEAN(.T.)' : '$';
    const mz = node.restraints.mz ? 'IFCBOOLEAN(.T.)' : '$';
    this.lines.push(`#${conditionId}= IFCBOUNDARYNODECONDITION('Support',${fx},${fy},${fz},${mx},${my},${mz});`);

    // Create structural point connection
    const connectionId = this.nextId();
    this.lines.push(`#${connectionId}= IFCSTRUCTURALPOINTCONNECTION('${this.generateGuid()}',#${ownerHistoryId},'${node.id}',$,$,$,#${vertexId},#${conditionId});`);

    return connectionId;
  }

  /**
   * Write local placement
   */
  private writeLocalPlacement(relativeToId: number | null, origin: { x: number; y: number; z: number }): number {
    const pointId = this.nextId();
    this.lines.push(`#${pointId}= IFCCARTESIANPOINT((${origin.x},${origin.y},${origin.z}));`);

    const axisId = this.nextId();
    this.lines.push(`#${axisId}= IFCAXIS2PLACEMENT3D(#${pointId},$,$);`);

    const placementId = this.nextId();
    const relativeTo = relativeToId ? `#${relativeToId}` : '$';
    this.lines.push(`#${placementId}= IFCLOCALPLACEMENT(${relativeTo},#${axisId});`);

    return placementId;
  }

  /**
   * Generate unique ID (simplified GUID)
   */
  private generateGuid(): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    let guid = '';
    for (let i = 0; i < 22; i++) {
      guid += chars[Math.floor(Math.random() * 64)];
    }
    return guid;
  }

  private nextId(): number {
    return this.entityId++;
  }
}

// ============================================================================
// CLASH DETECTOR
// ============================================================================

export class ClashDetector {
  /**
   * Detect clashes between structural elements
   */
  detectClashes(
    members: StructuralMember[],
    tolerance: number = 0.01,
    clearance: number = 0.05
  ): ClashResult[] {
    const clashes: ClashResult[] = [];
    let clashCounter = 1;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const clash = this.checkMemberClash(members[i], members[j], tolerance, clearance);
        if (clash) {
          clashes.push({ ...clash, id: `CLASH-${clashCounter++}` });
        }
      }
    }

    return clashes;
  }

  /**
   * Check clash between two members
   */
  private checkMemberClash(
    member1: StructuralMember,
    member2: StructuralMember,
    tolerance: number,
    clearance: number
  ): Omit<ClashResult, 'id'> | null {
    // Get bounding boxes (simplified)
    const box1 = this.getBoundingBox(member1);
    const box2 = this.getBoundingBox(member2);

    // Quick bounding box check
    if (!this.boxesIntersect(box1, box2, clearance)) {
      return null;
    }

    // Calculate minimum distance between member axes
    const distance = this.calculateMinDistance(member1, member2);

    // Determine clash type
    let type: 'hard' | 'soft' | 'clearance';
    let severity: 'critical' | 'major' | 'minor';

    if (distance < tolerance) {
      type = 'hard';
      severity = 'critical';
    } else if (distance < clearance) {
      type = 'clearance';
      severity = 'major';
    } else {
      return null;
    }

    // Calculate intersection point (approximate)
    const point = this.calculateIntersectionPoint(member1, member2);

    return {
      element1: { id: member1.id, type: member1.type, name: member1.name },
      element2: { id: member2.id, type: member2.type, name: member2.name },
      type,
      point,
      distance,
      severity
    };
  }

  /**
   * Get bounding box for member
   */
  private getBoundingBox(member: StructuralMember): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
    const { startPoint, endPoint } = member.geometry;
    const padding = 0.3; // Approximate section size

    return {
      min: {
        x: Math.min(startPoint.x, endPoint.x) - padding,
        y: Math.min(startPoint.y, endPoint.y) - padding,
        z: Math.min(startPoint.z, endPoint.z) - padding
      },
      max: {
        x: Math.max(startPoint.x, endPoint.x) + padding,
        y: Math.max(startPoint.y, endPoint.y) + padding,
        z: Math.max(startPoint.z, endPoint.z) + padding
      }
    };
  }

  /**
   * Check if bounding boxes intersect
   */
  private boxesIntersect(
    box1: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
    box2: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
    margin: number
  ): boolean {
    return !(
      box1.max.x + margin < box2.min.x ||
      box1.min.x - margin > box2.max.x ||
      box1.max.y + margin < box2.min.y ||
      box1.min.y - margin > box2.max.y ||
      box1.max.z + margin < box2.min.z ||
      box1.min.z - margin > box2.max.z
    );
  }

  /**
   * Calculate minimum distance between two line segments
   */
  private calculateMinDistance(member1: StructuralMember, member2: StructuralMember): number {
    // Simplified: use midpoint distance
    const mid1 = {
      x: (member1.geometry.startPoint.x + member1.geometry.endPoint.x) / 2,
      y: (member1.geometry.startPoint.y + member1.geometry.endPoint.y) / 2,
      z: (member1.geometry.startPoint.z + member1.geometry.endPoint.z) / 2
    };

    const mid2 = {
      x: (member2.geometry.startPoint.x + member2.geometry.endPoint.x) / 2,
      y: (member2.geometry.startPoint.y + member2.geometry.endPoint.y) / 2,
      z: (member2.geometry.startPoint.z + member2.geometry.endPoint.z) / 2
    };

    return Math.sqrt(
      (mid1.x - mid2.x) ** 2 +
      (mid1.y - mid2.y) ** 2 +
      (mid1.z - mid2.z) ** 2
    );
  }

  /**
   * Calculate intersection point
   */
  private calculateIntersectionPoint(member1: StructuralMember, member2: StructuralMember): { x: number; y: number; z: number } {
    // Return midpoint between member midpoints
    const mid1 = {
      x: (member1.geometry.startPoint.x + member1.geometry.endPoint.x) / 2,
      y: (member1.geometry.startPoint.y + member1.geometry.endPoint.y) / 2,
      z: (member1.geometry.startPoint.z + member1.geometry.endPoint.z) / 2
    };

    const mid2 = {
      x: (member2.geometry.startPoint.x + member2.geometry.endPoint.x) / 2,
      y: (member2.geometry.startPoint.y + member2.geometry.endPoint.y) / 2,
      z: (member2.geometry.startPoint.z + member2.geometry.endPoint.z) / 2
    };

    return {
      x: (mid1.x + mid2.x) / 2,
      y: (mid1.y + mid2.y) / 2,
      z: (mid1.z + mid2.z) / 2
    };
  }
}

// ============================================================================
// MODEL VALIDATOR
// ============================================================================

export class ModelValidator {
  /**
   * Validate structural model
   */
  validate(model: IFCModel): {
    valid: boolean;
    errors: { type: string; message: string; entityId?: number }[];
    warnings: { type: string; message: string; entityId?: number }[];
  } {
    const errors: { type: string; message: string; entityId?: number }[] = [];
    const warnings: { type: string; message: string; entityId?: number }[] = [];

    // Check project exists
    if (!model.project?.name) {
      errors.push({ type: 'MISSING_PROJECT', message: 'Model must have a project definition' });
    }

    // Validate structural model
    if (model.structuralModel) {
      // Check for disconnected nodes
      const connectedNodeIds = new Set<string>();
      for (const member of model.structuralModel.members) {
        // Would need start/end node references
      }

      // Check member geometry
      for (const member of model.structuralModel.members) {
        const length = this.calculateMemberLength(member);
        if (length < 0.01) {
          errors.push({
            type: 'ZERO_LENGTH_MEMBER',
            message: `Member ${member.name} has zero or near-zero length`,
            entityId: member.ifcId
          });
        }

        if (length > 100) {
          warnings.push({
            type: 'LONG_MEMBER',
            message: `Member ${member.name} is very long (${length.toFixed(2)}m)`,
            entityId: member.ifcId
          });
        }
      }

      // Check for support conditions
      const hasSupports = model.structuralModel.nodes.some(
        node => node.restraints.fx || node.restraints.fy || node.restraints.fz
      );

      if (!hasSupports) {
        errors.push({
          type: 'NO_SUPPORTS',
          message: 'Model has no support conditions (will be unstable)'
        });
      }

      // Check load cases
      if (model.structuralModel.loadCases.length === 0) {
        warnings.push({
          type: 'NO_LOAD_CASES',
          message: 'Model has no defined load cases'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate member length
   */
  private calculateMemberLength(member: StructuralMember): number {
    const dx = member.geometry.endPoint.x - member.geometry.startPoint.x;
    const dy = member.geometry.endPoint.y - member.geometry.startPoint.y;
    const dz = member.geometry.endPoint.z - member.geometry.startPoint.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// ============================================================================
// EXPORTS - Classes/constants already exported at declaration
// ============================================================================

export default {
  IFCParser,
  IFCWriter,
  ClashDetector,
  ModelValidator,
  IFC_STRUCTURAL_TYPES
};
