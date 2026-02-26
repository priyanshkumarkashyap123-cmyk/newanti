/**
 * IFCIntegration.ts
 * 
 * BIM/IFC Integration Module for BeamLab Ultimate:
 * 1. IFC 2x3 and IFC 4 parsing
 * 2. IFC export/generation
 * 3. BIM coordination
 * 4. Property set extraction
 * 5. Spatial structure mapping
 * 6. Material mapping
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type IfcType =
  | 'IfcBeam'
  | 'IfcColumn'
  | 'IfcSlab'
  | 'IfcWall'
  | 'IfcFooting'
  | 'IfcPile'
  | 'IfcPlate'
  | 'IfcMember'
  | 'IfcBuildingElementProxy';

export interface IfcEntity {
  expressId: number;
  type: string;
  attributes: Record<string, unknown>;
  children?: IfcEntity[];
}

export interface IfcProject {
  id: string;
  name: string;
  description?: string;
  units: IfcUnits;
  sites: IfcSite[];
  propertysets: Map<string, IfcPropertySet>;
}

export interface IfcUnits {
  lengthUnit: 'METRE' | 'MILLIMETRE' | 'FOOT' | 'INCH';
  areaUnit: 'SQUARE_METRE' | 'SQUARE_FOOT';
  volumeUnit: 'CUBIC_METRE' | 'CUBIC_FOOT';
  angleUnit: 'RADIAN' | 'DEGREE';
  forceUnit: 'NEWTON' | 'KILONEWTON' | 'POUND_FORCE';
}

export interface IfcSite {
  id: string;
  name: string;
  refLatitude?: number;
  refLongitude?: number;
  refElevation?: number;
  buildings: IfcBuilding[];
}

export interface IfcBuilding {
  id: string;
  name: string;
  storeys: IfcBuildingStorey[];
}

export interface IfcBuildingStorey {
  id: string;
  name: string;
  elevation: number;
  elements: IfcStructuralElement[];
}

export interface IfcPropertySet {
  name: string;
  properties: Map<string, unknown>;
}

export interface IfcGeometry {
  type: 'ExtrudedAreaSolid' | 'SweptSolid' | 'Brep' | 'Faceted';
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
}

export interface IfcStructuralElement {
  expressId: number;
  globalId: string;
  type: IfcType;
  name?: string;
  description?: string;
  objectType?: string;
  
  // Geometry
  geometry?: IfcGeometry;
  placement: IfcPlacement;
  
  // Profile/Section
  profile?: IfcProfile;
  
  // Material
  material?: IfcMaterial;
  
  // Structural properties
  structuralProperties?: {
    area?: number;
    momentOfInertiaX?: number;
    momentOfInertiaY?: number;
    sectionModulusX?: number;
    sectionModulusY?: number;
    radiusOfGyrationX?: number;
    radiusOfGyrationY?: number;
  };
  
  // Property sets
  propertySets: Map<string, IfcPropertySet>;
  
  // Relationships
  containedIn?: string; // Storey ID
  connectedTo?: string[]; // Element IDs
}

export interface IfcPlacement {
  location: { x: number; y: number; z: number };
  axis: { x: number; y: number; z: number };
  refDirection: { x: number; y: number; z: number };
}

export interface IfcProfile {
  type: 'I' | 'L' | 'C' | 'T' | 'Rectangle' | 'Circle' | 'Arbitrary';
  name?: string;
  dimensions: Record<string, number>;
}

export interface IfcMaterial {
  name: string;
  category?: string;
  properties?: {
    yieldStrength?: number;
    ultimateStrength?: number;
    elasticModulus?: number;
    poissonRatio?: number;
    density?: number;
    thermalExpansion?: number;
  };
}

// ============================================
// IFC PARSER
// ============================================

export class IFCParser {
  private entities: Map<number, IfcEntity> = new Map();
  private schema: 'IFC2X3' | 'IFC4' = 'IFC4';
  
  /**
   * Parse IFC file content
   */
  async parse(content: string): Promise<IfcProject> {
    // Reset state
    this.entities.clear();
    
    // Detect schema version
    this.detectSchema(content);
    
    // Parse header
    const header = this.parseHeader(content);
    
    // Parse data section
    const dataStart = content.indexOf('DATA;');
    const dataEnd = content.indexOf('ENDSEC;', dataStart);
    const dataSection = content.substring(dataStart + 5, dataEnd);
    
    this.parseDataSection(dataSection);
    
    // Build project hierarchy
    return this.buildProject(header);
  }
  
  /**
   * Detect IFC schema version
   */
  private detectSchema(content: string): void {
    if (content.includes('IFC2X3')) {
      this.schema = 'IFC2X3';
    } else if (content.includes('IFC4')) {
      this.schema = 'IFC4';
    }
  }
  
  /**
   * Parse IFC header section
   */
  private parseHeader(content: string): Record<string, string> {
    const header: Record<string, string> = {};
    
    const headerMatch = content.match(/HEADER;([\s\S]*?)ENDSEC;/);
    if (headerMatch) {
      const headerContent = headerMatch[1];
      
      // Extract file description
      const descMatch = headerContent.match(/FILE_DESCRIPTION\s*\(\s*\('([^']*)'/);
      if (descMatch) {
        header.description = descMatch[1];
      }
      
      // Extract file name
      const nameMatch = headerContent.match(/FILE_NAME\s*\(\s*'([^']*)'/);
      if (nameMatch) {
        header.filename = nameMatch[1];
      }
      
      // Extract schema
      const schemaMatch = headerContent.match(/FILE_SCHEMA\s*\(\s*\('([^']*)'/);
      if (schemaMatch) {
        header.schema = schemaMatch[1];
      }
    }
    
    return header;
  }
  
  /**
   * Parse data section entities
   */
  private parseDataSection(data: string): void {
    // Regular expression to match IFC entities
    const entityRegex = /#(\d+)\s*=\s*(\w+)\s*\((.*?)\)\s*;/g;
    
    let match;
    while ((match = entityRegex.exec(data)) !== null) {
      const expressId = parseInt(match[1], 10);
      const type = match[2];
      const attributeString = match[3];
      
      const attributes = this.parseAttributes(attributeString);
      
      this.entities.set(expressId, {
        expressId,
        type,
        attributes,
      });
    }
  }
  
  /**
   * Parse entity attributes
   */
  private parseAttributes(attrString: string): Record<string, unknown> {
    const attributes: Record<string, unknown> = {};
    const parts: string[] = [];
    
    let depth = 0;
    let current = '';
    
    for (const char of attrString) {
      if (char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) {
      parts.push(current.trim());
    }
    
    parts.forEach((part, index) => {
      attributes[`attr${index}`] = this.parseValue(part);
    });
    
    return attributes;
  }
  
  /**
   * Parse individual attribute value
   */
  private parseValue(value: string): unknown {
    value = value.trim();
    
    // Null/undefined
    if (value === '$' || value === '*') {
      return null;
    }
    
    // Reference
    if (value.startsWith('#')) {
      return { ref: parseInt(value.substring(1), 10) };
    }
    
    // String
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.substring(1, value.length - 1);
    }
    
    // Enumeration
    if (value.startsWith('.') && value.endsWith('.')) {
      return value.substring(1, value.length - 1);
    }
    
    // Number
    if (!isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    // List
    if (value.startsWith('(') && value.endsWith(')')) {
      const listContent = value.substring(1, value.length - 1);
      return this.parseAttributes(listContent);
    }
    
    return value;
  }
  
  /**
   * Build project hierarchy from parsed entities
   */
  private buildProject(header: Record<string, string>): IfcProject {
    // Find project entity
    const projectEntity = this.findEntitiesByType('IFCPROJECT')[0];
    
    const project: IfcProject = {
      id: this.getGlobalId(projectEntity),
      name: this.getName(projectEntity) || header.filename || 'Untitled Project',
      description: header.description,
      units: this.parseUnits(),
      sites: [],
      propertysets: new Map(),
    };
    
    // Build spatial hierarchy
    const sites = this.findEntitiesByType('IFCSITE');
    for (const site of sites) {
      project.sites.push(this.buildSite(site));
    }
    
    return project;
  }
  
  /**
   * Parse units from project
   */
  private parseUnits(): IfcUnits {
    const defaultUnits: IfcUnits = {
      lengthUnit: 'METRE',
      areaUnit: 'SQUARE_METRE',
      volumeUnit: 'CUBIC_METRE',
      angleUnit: 'RADIAN',
      forceUnit: 'NEWTON',
    };
    
    // Find unit assignment
    const unitAssignments = this.findEntitiesByType('IFCUNITASSIGNMENT');
    if (unitAssignments.length === 0) return defaultUnits;
    
    // Would parse unit entities here in full implementation
    
    return defaultUnits;
  }
  
  /**
   * Build site from entity
   */
  private buildSite(siteEntity: IfcEntity): IfcSite {
    const site: IfcSite = {
      id: this.getGlobalId(siteEntity),
      name: this.getName(siteEntity) || 'Site',
      buildings: [],
    };
    
    // Find buildings in site
    const relContained = this.findRelationships('IFCRELAGGREGATES', siteEntity.expressId);
    for (const rel of relContained) {
      const related = this.getRelatedObjects(rel);
      for (const relatedId of related) {
        const entity = this.entities.get(relatedId);
        if (entity && entity.type === 'IFCBUILDING') {
          site.buildings.push(this.buildBuilding(entity));
        }
      }
    }
    
    return site;
  }
  
  /**
   * Build building from entity
   */
  private buildBuilding(buildingEntity: IfcEntity): IfcBuilding {
    const building: IfcBuilding = {
      id: this.getGlobalId(buildingEntity),
      name: this.getName(buildingEntity) || 'Building',
      storeys: [],
    };
    
    // Find storeys
    const relAggregates = this.findRelationships('IFCRELAGGREGATES', buildingEntity.expressId);
    for (const rel of relAggregates) {
      const related = this.getRelatedObjects(rel);
      for (const relatedId of related) {
        const entity = this.entities.get(relatedId);
        if (entity && entity.type === 'IFCBUILDINGSTOREY') {
          building.storeys.push(this.buildStorey(entity));
        }
      }
    }
    
    // Sort by elevation
    building.storeys.sort((a, b) => a.elevation - b.elevation);
    
    return building;
  }
  
  /**
   * Build building storey from entity
   */
  private buildStorey(storeyEntity: IfcEntity): IfcBuildingStorey {
    const storey: IfcBuildingStorey = {
      id: this.getGlobalId(storeyEntity),
      name: this.getName(storeyEntity) || 'Storey',
      elevation: this.getElevation(storeyEntity),
      elements: [],
    };
    
    // Find contained elements
    const relContained = this.findRelationships('IFCRELCONTAINEDINSPATIALSTRUCTURE', storeyEntity.expressId);
    for (const rel of relContained) {
      const related = this.getRelatedObjects(rel);
      for (const relatedId of related) {
        const element = this.buildStructuralElement(relatedId);
        if (element) {
          element.containedIn = storey.id;
          storey.elements.push(element);
        }
      }
    }
    
    return storey;
  }
  
  /**
   * Build structural element from entity ID
   */
  private buildStructuralElement(expressId: number): IfcStructuralElement | null {
    const entity = this.entities.get(expressId);
    if (!entity) return null;
    
    // Check if structural element type
    const structuralTypes = [
      'IFCBEAM', 'IFCCOLUMN', 'IFCSLAB', 'IFCWALL',
      'IFCFOOTING', 'IFCPILE', 'IFCPLATE', 'IFCMEMBER',
      'IFCBUILDINGELEMENTPROXY',
    ];
    
    if (!structuralTypes.includes(entity.type)) {
      return null;
    }
    
    const element: IfcStructuralElement = {
      expressId: entity.expressId,
      globalId: this.getGlobalId(entity),
      type: this.mapIfcType(entity.type),
      name: this.getName(entity),
      objectType: entity.attributes.attr4 as string | undefined,
      placement: this.getPlacement(entity),
      propertySets: new Map(),
    };
    
    // Get geometry
    element.geometry = this.extractGeometry(entity);
    
    // Get profile
    element.profile = this.extractProfile(entity);
    
    // Get material
    element.material = this.extractMaterial(entity);
    
    // Get property sets
    this.extractPropertySets(entity, element);
    
    return element;
  }
  
  private mapIfcType(type: string): IfcType {
    const mapping: Record<string, IfcType> = {
      'IFCBEAM': 'IfcBeam',
      'IFCCOLUMN': 'IfcColumn',
      'IFCSLAB': 'IfcSlab',
      'IFCWALL': 'IfcWall',
      'IFCFOOTING': 'IfcFooting',
      'IFCPILE': 'IfcPile',
      'IFCPLATE': 'IfcPlate',
      'IFCMEMBER': 'IfcMember',
      'IFCBUILDINGELEMENTPROXY': 'IfcBuildingElementProxy',
    };
    return mapping[type] || 'IfcBuildingElementProxy';
  }
  
  private getGlobalId(entity: IfcEntity): string {
    return (entity.attributes.attr0 as string) || `id-${entity.expressId}`;
  }
  
  private getName(entity: IfcEntity): string | undefined {
    return entity.attributes.attr2 as string | undefined;
  }
  
  private getElevation(entity: IfcEntity): number {
    return (entity.attributes.attr9 as number) || 0;
  }
  
  private getPlacement(entity: IfcEntity): IfcPlacement {
    // Default placement
    return {
      location: { x: 0, y: 0, z: 0 },
      axis: { x: 0, y: 0, z: 1 },
      refDirection: { x: 1, y: 0, z: 0 },
    };
  }
  
  private extractGeometry(entity: IfcEntity): IfcGeometry | undefined {
    // Simplified - would need full geometry processing
    return undefined;
  }
  
  private extractProfile(entity: IfcEntity): IfcProfile | undefined {
    // Simplified - would extract from representation
    return undefined;
  }
  
  private extractMaterial(entity: IfcEntity): IfcMaterial | undefined {
    // Find material association
    const relAssociates = this.findMaterialAssociation(entity.expressId);
    if (!relAssociates) return undefined;
    
    return {
      name: 'Steel', // Would extract from material entity
    };
  }
  
  private extractPropertySets(entity: IfcEntity, element: IfcStructuralElement): void {
    // Find property set relationships
    const relDefines = this.findEntitiesByType('IFCRELDEFINESBYPROPERTIES');
    
    for (const rel of relDefines) {
      const relatedObjects = this.getRelatedObjects(rel);
      if (relatedObjects.includes(entity.expressId)) {
        // Get property set
        const psetRef = rel.attributes.attr5 as { ref: number } | undefined;
        if (psetRef) {
          const pset = this.entities.get(psetRef.ref);
          if (pset && pset.type === 'IFCPROPERTYSET') {
            const propertySet: IfcPropertySet = {
              name: this.getName(pset) || 'PropertySet',
              properties: new Map(),
            };
            
            // Would parse individual properties here
            
            element.propertySets.set(propertySet.name, propertySet);
          }
        }
      }
    }
  }
  
  private findEntitiesByType(type: string): IfcEntity[] {
    const result: IfcEntity[] = [];
    this.entities.forEach((entity) => {
      if (entity.type === type) {
        result.push(entity);
      }
    });
    return result;
  }
  
  private findRelationships(relType: string, relatingId: number): IfcEntity[] {
    return this.findEntitiesByType(relType).filter((rel) => {
      const relating = rel.attributes.attr4 as { ref: number } | undefined;
      return relating && relating.ref === relatingId;
    });
  }
  
  private getRelatedObjects(rel: IfcEntity): number[] {
    const related = rel.attributes.attr5 as Record<string, { ref: number }> | undefined;
    if (!related) return [];
    
    return Object.values(related)
      .filter((v): v is { ref: number } => typeof v === 'object' && 'ref' in v)
      .map((v) => v.ref);
  }
  
  private findMaterialAssociation(elementId: number): IfcEntity | undefined {
    const relAssociates = this.findEntitiesByType('IFCRELASSOCIATESMATERIAL');
    
    return relAssociates.find((rel) => {
      const relatedObjects = this.getRelatedObjects(rel);
      return relatedObjects.includes(elementId);
    });
  }
}

// ============================================
// IFC EXPORTER
// ============================================

export interface ExportOptions {
  schema: 'IFC2X3' | 'IFC4';
  applicationName?: string;
  authorName?: string;
  organizationName?: string;
  includePropertySets?: boolean;
  includeQuantities?: boolean;
}

export class IFCExporter {
  private expressId = 0;
  private entities: string[] = [];
  
  /**
   * Export project to IFC format
   */
  export(project: IfcProject, elements: IfcStructuralElement[], options: ExportOptions): string {
    this.expressId = 0;
    this.entities = [];
    
    // Generate IFC content
    const header = this.generateHeader(project, options);
    const data = this.generateData(project, elements, options);
    
    return [
      'ISO-10303-21;',
      header,
      'DATA;',
      data,
      'ENDSEC;',
      'END-ISO-10303-21;',
    ].join('\n');
  }
  
  private nextId(): number {
    return ++this.expressId;
  }
  
  private generateHeader(project: IfcProject, options: ExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const schema = options.schema;
    
    return `HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('${project.name}.ifc','${timestamp}',('${options.authorName || 'BeamLab'}'),('${options.organizationName || 'BeamLab'}'),'${options.applicationName || 'BeamLab Ultimate'}','${options.applicationName || 'BeamLab Ultimate'}','');
FILE_SCHEMA(('${schema}'));
ENDSEC;`;
  }
  
  private generateData(project: IfcProject, elements: IfcStructuralElement[], options: ExportOptions): string {
    // Core entities
    const personId = this.addEntity('IFCPERSON', ["$", "$", "'BeamLab User'", "$", "$", "$", "$", "$"]);
    const orgId = this.addEntity('IFCORGANIZATION', ["$", "'BeamLab'", "$", "$", "$"]);
    const personOrgId = this.addEntity('IFCPERSONANDORGANIZATION', [`#${personId}`, `#${orgId}`, "$"]);
    
    const appId = this.addEntity('IFCAPPLICATION', [`#${orgId}`, "'1.0'", "'BeamLab Ultimate'", "'BeamLab'"]);
    const ownerHistoryId = this.addEntity('IFCOWNERHISTORY', [
      `#${personOrgId}`, `#${appId}`, "$", ".NOCHANGE.", "$", `#${personOrgId}`, `#${appId}`,
      `${Math.floor(Date.now() / 1000)}`,
    ]);
    
    // Units
    const unitsId = this.generateUnits(project.units);
    
    // Geometric context
    const contextId = this.generateGeometricContext();
    
    // Project
    const projectId = this.addEntity('IFCPROJECT', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, `'${project.name}'`,
      project.description ? `'${project.description}'` : '$',
      '$', '$', '$', `(#${contextId})`, `#${unitsId}`,
    ]);
    
    // Site
    const siteId = this.addEntity('IFCSITE', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, "'Default Site'",
      '$', '$', '$', '$', '$', '.ELEMENT.', '$', '$', '$', '$', '$',
    ]);
    
    this.addEntity('IFCRELAGGREGATES', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
      `#${projectId}`, `(#${siteId})`,
    ]);
    
    // Building
    const buildingId = this.addEntity('IFCBUILDING', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, "'Default Building'",
      '$', '$', '$', '$', '$', '.ELEMENT.', '$', '$', '$',
    ]);
    
    this.addEntity('IFCRELAGGREGATES', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
      `#${siteId}`, `(#${buildingId})`,
    ]);
    
    // Storey
    const storeyId = this.addEntity('IFCBUILDINGSTOREY', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, "'Level 0'",
      '$', '$', '$', '$', '$', '.ELEMENT.', '0.0',
    ]);
    
    this.addEntity('IFCRELAGGREGATES', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
      `#${buildingId}`, `(#${storeyId})`,
    ]);
    
    // Export elements
    const elementIds: number[] = [];
    for (const element of elements) {
      const elemId = this.exportElement(element, ownerHistoryId, contextId, options);
      elementIds.push(elemId);
    }
    
    // Relate elements to storey
    if (elementIds.length > 0) {
      this.addEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', [
        `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
        `(${elementIds.map(id => `#${id}`).join(',')})`, `#${storeyId}`,
      ]);
    }
    
    return this.entities.join('\n');
  }
  
  private generateUnits(units: IfcUnits): number {
    const lengthUnitId = this.addEntity('IFCSIUNIT', ['*', '.LENGTHUNIT.', '$', '.METRE.']);
    const areaUnitId = this.addEntity('IFCSIUNIT', ['*', '.AREAUNIT.', '$', '.SQUARE_METRE.']);
    const volumeUnitId = this.addEntity('IFCSIUNIT', ['*', '.VOLUMEUNIT.', '$', '.CUBIC_METRE.']);
    const angleUnitId = this.addEntity('IFCSIUNIT', ['*', '.PLANEANGLEUNIT.', '$', '.RADIAN.']);
    const forceUnitId = this.addEntity('IFCSIUNIT', ['*', '.FORCEUNIT.', '$', '.NEWTON.']);
    
    return this.addEntity('IFCUNITASSIGNMENT', [
      `(#${lengthUnitId},#${areaUnitId},#${volumeUnitId},#${angleUnitId},#${forceUnitId})`,
    ]);
  }
  
  private generateGeometricContext(): number {
    const originId = this.addEntity('IFCCARTESIANPOINT', ['(0.0,0.0,0.0)']);
    const zAxisId = this.addEntity('IFCDIRECTION', ['(0.0,0.0,1.0)']);
    const xAxisId = this.addEntity('IFCDIRECTION', ['(1.0,0.0,0.0)']);
    const placementId = this.addEntity('IFCAXIS2PLACEMENT3D', [`#${originId}`, `#${zAxisId}`, `#${xAxisId}`]);
    
    const contextId = this.addEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', [
      "'Model'", "'Model'", '3', '1.0E-5', `#${placementId}`, '$',
    ]);
    
    return contextId;
  }
  
  private exportElement(element: IfcStructuralElement, ownerHistoryId: number, contextId: number, options: ExportOptions): number {
    // Create placement
    const placementId = this.createPlacement(element.placement);
    
    // Create geometry representation
    const representationId = this.createRepresentation(element, contextId);
    
    // Map element type
    const ifcType = this.mapTypeToIfc(element.type);
    
    // Create element entity
    const elementId = this.addEntity(ifcType, [
      `'${element.globalId || this.generateGuid()}'`,
      `#${ownerHistoryId}`,
      element.name ? `'${element.name}'` : '$',
      element.description ? `'${element.description}'` : '$',
      element.objectType ? `'${element.objectType}'` : '$',
      `#${placementId}`,
      representationId ? `#${representationId}` : '$',
      '$', // Tag
    ]);
    
    // Add material if present
    if (element.material) {
      this.addMaterialAssociation(elementId, element.material, ownerHistoryId);
    }
    
    // Add property sets if enabled
    if (options.includePropertySets && element.propertySets.size > 0) {
      this.addPropertySets(elementId, element.propertySets, ownerHistoryId);
    }
    
    return elementId;
  }
  
  private createPlacement(placement: IfcPlacement): number {
    const locationId = this.addEntity('IFCCARTESIANPOINT', [
      `(${placement.location.x},${placement.location.y},${placement.location.z})`,
    ]);
    
    const axisId = this.addEntity('IFCDIRECTION', [
      `(${placement.axis.x},${placement.axis.y},${placement.axis.z})`,
    ]);
    
    const refDirId = this.addEntity('IFCDIRECTION', [
      `(${placement.refDirection.x},${placement.refDirection.y},${placement.refDirection.z})`,
    ]);
    
    const axis2PlacementId = this.addEntity('IFCAXIS2PLACEMENT3D', [
      `#${locationId}`, `#${axisId}`, `#${refDirId}`,
    ]);
    
    return this.addEntity('IFCLOCALPLACEMENT', ['$', `#${axis2PlacementId}`]);
  }
  
  private createRepresentation(element: IfcStructuralElement, contextId: number): number | null {
    if (!element.geometry) return null;
    
    // Simplified - would create proper geometric representation
    // For now, create a simple box representation
    const pointListId = this.addEntity('IFCCARTESIANPOINTLIST3D', [
      '((0.0,0.0,0.0),(1.0,0.0,0.0),(1.0,1.0,0.0),(0.0,1.0,0.0),(0.0,0.0,1.0),(1.0,0.0,1.0),(1.0,1.0,1.0),(0.0,1.0,1.0))',
    ]);
    
    const faceSetId = this.addEntity('IFCINDEXEDPOLYGONALFACE', ['(1,2,6,5)']);
    
    const tessellatedId = this.addEntity('IFCPOLYGONALFACE', [`#${pointListId}`, `(#${faceSetId})`]);
    
    const shapeRepId = this.addEntity('IFCSHAPEREPRESENTATION', [
      `#${contextId}`, "'Body'", "'Tessellation'", `(#${tessellatedId})`,
    ]);
    
    return this.addEntity('IFCPRODUCTDEFINITIONSHAPE', ['$', '$', `(#${shapeRepId})`]);
  }
  
  private addMaterialAssociation(elementId: number, material: IfcMaterial, ownerHistoryId: number): void {
    const materialId = this.addEntity('IFCMATERIAL', [`'${material.name}'`]);
    
    this.addEntity('IFCRELASSOCIATESMATERIAL', [
      `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
      `(#${elementId})`, `#${materialId}`,
    ]);
  }
  
  private addPropertySets(elementId: number, propertySets: Map<string, IfcPropertySet>, ownerHistoryId: number): void {
    for (const [name, pset] of propertySets) {
      const propertyIds: number[] = [];
      
      for (const [propName, propValue] of pset.properties) {
        const propId = this.addEntity('IFCPROPERTYSINGLEVALUE', [
          `'${propName}'`, '$', this.formatValue(propValue), '$',
        ]);
        propertyIds.push(propId);
      }
      
      if (propertyIds.length > 0) {
        const psetId = this.addEntity('IFCPROPERTYSET', [
          `'${this.generateGuid()}'`, `#${ownerHistoryId}`, `'${name}'`, '$',
          `(${propertyIds.map(id => `#${id}`).join(',')})`,
        ]);
        
        this.addEntity('IFCRELDEFINESBYPROPERTIES', [
          `'${this.generateGuid()}'`, `#${ownerHistoryId}`, '$', '$',
          `(#${elementId})`, `#${psetId}`,
        ]);
      }
    }
  }
  
  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return `IFCTEXT('${value}')`;
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? `IFCINTEGER(${value})` : `IFCREAL(${value})`;
    } else if (typeof value === 'boolean') {
      return `IFCBOOLEAN(.${value ? 'T' : 'F'}.)`;
    }
    return '$';
  }
  
  private mapTypeToIfc(type: IfcType): string {
    const mapping: Record<IfcType, string> = {
      'IfcBeam': 'IFCBEAM',
      'IfcColumn': 'IFCCOLUMN',
      'IfcSlab': 'IFCSLAB',
      'IfcWall': 'IFCWALL',
      'IfcFooting': 'IFCFOOTING',
      'IfcPile': 'IFCPILE',
      'IfcPlate': 'IFCPLATE',
      'IfcMember': 'IFCMEMBER',
      'IfcBuildingElementProxy': 'IFCBUILDINGELEMENTPROXY',
    };
    return mapping[type] || 'IFCBUILDINGELEMENTPROXY';
  }
  
  private addEntity(type: string, attributes: string[]): number {
    const id = this.nextId();
    this.entities.push(`#${id}=${type}(${attributes.join(',')});`);
    return id;
  }
  
  private generateGuid(): string {
    // Generate IFC-compliant GUID (22 characters, base64-like)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    let guid = '';
    for (let i = 0; i < 22; i++) {
      guid += chars.charAt(Math.floor(Math.random() * 64));
    }
    return guid;
  }
}

// ============================================
// BIM COORDINATOR
// ============================================

export interface ClashResult {
  element1Id: string;
  element2Id: string;
  type: 'hard' | 'soft' | 'clearance';
  distance: number;
  location: { x: number; y: number; z: number };
  severity: 'critical' | 'major' | 'minor';
}

export class BIMCoordinator {
  private elements: Map<string, IfcStructuralElement> = new Map();
  
  /**
   * Add elements for coordination
   */
  addElements(elements: IfcStructuralElement[]): void {
    for (const element of elements) {
      this.elements.set(element.globalId, element);
    }
  }
  
  /**
   * Run clash detection
   */
  detectClashes(tolerance: number = 0.01): ClashResult[] {
    const clashes: ClashResult[] = [];
    const elementArray = Array.from(this.elements.values());
    
    // Simple AABB collision detection
    for (let i = 0; i < elementArray.length; i++) {
      for (let j = i + 1; j < elementArray.length; j++) {
        const clash = this.checkClash(elementArray[i], elementArray[j], tolerance);
        if (clash) {
          clashes.push(clash);
        }
      }
    }
    
    return clashes;
  }
  
  private checkClash(e1: IfcStructuralElement, e2: IfcStructuralElement, tolerance: number): ClashResult | null {
    // Simplified - would need proper geometry intersection
    // For demonstration, check if placements are too close
    const dist = this.distance(e1.placement.location, e2.placement.location);
    
    if (dist < tolerance) {
      return {
        element1Id: e1.globalId,
        element2Id: e2.globalId,
        type: 'hard',
        distance: dist,
        location: {
          x: (e1.placement.location.x + e2.placement.location.x) / 2,
          y: (e1.placement.location.y + e2.placement.location.y) / 2,
          z: (e1.placement.location.z + e2.placement.location.z) / 2,
        },
        severity: dist < tolerance / 10 ? 'critical' : dist < tolerance / 2 ? 'major' : 'minor',
      };
    }
    
    return null;
  }
  
  private distance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    return Math.sqrt(
      Math.pow(p2.x - p1.x, 2) +
      Math.pow(p2.y - p1.y, 2) +
      Math.pow(p2.z - p1.z, 2)
    );
  }
  
  /**
   * Generate coordination report
   */
  generateReport(clashes: ClashResult[]): string {
    const critical = clashes.filter(c => c.severity === 'critical');
    const major = clashes.filter(c => c.severity === 'major');
    const minor = clashes.filter(c => c.severity === 'minor');
    
    return `
# BIM Coordination Report

## Summary
- Total Clashes: ${clashes.length}
- Critical: ${critical.length}
- Major: ${major.length}
- Minor: ${minor.length}

## Critical Clashes
${critical.map(c => `- ${c.element1Id} ↔ ${c.element2Id} (${c.distance.toFixed(3)}m)`).join('\n')}

## Major Clashes
${major.map(c => `- ${c.element1Id} ↔ ${c.element2Id} (${c.distance.toFixed(3)}m)`).join('\n')}

## Minor Clashes
${minor.map(c => `- ${c.element1Id} ↔ ${c.element2Id} (${c.distance.toFixed(3)}m)`).join('\n')}
    `.trim();
  }
}

// ============================================
// EXPORTS
// ============================================

export const ifcParser = new IFCParser();
export const ifcExporter = new IFCExporter();
export const bimCoordinator = new BIMCoordinator();

export default {
  IFCParser,
  IFCExporter,
  BIMCoordinator,
  ifcParser,
  ifcExporter,
  bimCoordinator,
};
