/**
 * IFCExportService.ts
 * 
 * Industry Foundation Classes (IFC) Export for BIM
 * 
 * Features:
 * - IFC 4x3 schema support
 * - Structural member export
 * - Section profiles
 * - Material properties
 * - Relationships
 */

// ============================================
// TYPES
// ============================================

export interface IFCNode {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface IFCMember {
    id: string;
    name: string;
    startNode: string;
    endNode: string;
    type: 'beam' | 'column' | 'brace' | 'slab';
    section: string;
    material: string;
}

export interface IFCProject {
    name: string;
    description?: string;
    phase?: string;
    author?: string;
    organization?: string;
}

export interface IFCSectionProfile {
    name: string;
    type: 'I' | 'H' | 'C' | 'L' | 'T' | 'HSS' | 'Pipe' | 'Rectangle';
    dimensions: {
        height?: number;
        width?: number;
        webThickness?: number;
        flangeThickness?: number;
        radius?: number;
    };
}

// ============================================
// IFC EXPORT SERVICE
// ============================================

class IFCExportServiceClass {
    private entityId: number = 1;
    private lines: string[] = [];

    /**
     * Export to IFC format
     */
    exportToIFC(
        project: IFCProject,
        nodes: IFCNode[],
        members: IFCMember[],
        sections: Map<string, IFCSectionProfile>
    ): string {
        this.entityId = 1;
        this.lines = [];

        // ISO header
        this.addISOHeader(project);

        // DATA section
        this.lines.push('DATA;');

        // Project setup
        const projectId = this.addProject(project);
        const siteId = this.addSite(projectId);
        const buildingId = this.addBuilding(siteId);
        const storeyId = this.addBuildingStorey(buildingId);

        // Add coordinate system
        const originId = this.addCartesianPoint(0, 0, 0);
        const dirZ = this.addDirection(0, 0, 1);
        const dirX = this.addDirection(1, 0, 0);
        const axis2d = this.addAxis2Placement3D(originId, dirZ, dirX);

        // Materials
        const materialIds = new Map<string, number>();
        const materialTypes = ['A992', 'A36', 'Steel', 'Concrete'];
        for (const mat of materialTypes) {
            materialIds.set(mat, this.addMaterial(mat));
        }

        // Section profiles
        const profileIds = new Map<string, number>();
        for (const [name, profile] of sections) {
            profileIds.set(name, this.addSectionProfile(profile));
        }

        // Add members
        for (const member of members) {
            const startNode = nodes.find(n => n.id === member.startNode);
            const endNode = nodes.find(n => n.id === member.endNode);
            if (!startNode || !endNode) continue;

            const profileId = profileIds.get(member.section) || this.addDefaultProfile();
            const materialId = materialIds.get(member.material) || materialIds.get('Steel')!;

            if (member.type === 'column') {
                this.addColumn(member, startNode, endNode, profileId, materialId, storeyId);
            } else if (member.type === 'beam') {
                this.addBeam(member, startNode, endNode, profileId, materialId, storeyId);
            } else if (member.type === 'brace') {
                this.addMemberGeneric(member, startNode, endNode, profileId, materialId, storeyId);
            }
        }

        // Close DATA section
        this.lines.push('ENDSEC;');
        this.lines.push('END-ISO-10303-21;');

        return this.lines.join('\n');
    }

    /**
     * Add ISO header
     */
    private addISOHeader(project: IFCProject): void {
        this.lines.push('ISO-10303-21;');
        this.lines.push('HEADER;');
        this.lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`);
        this.lines.push(`FILE_NAME('${project.name}.ifc','${new Date().toISOString()}',('${project.author || 'BeamLab'}'),('${project.organization || ''}'),'BeamLab IFC Exporter','BeamLab 1.0','');`);
        this.lines.push(`FILE_SCHEMA(('IFC4X3'));`);
        this.lines.push('ENDSEC;');
    }

    /**
     * Add project entity
     */
    private addProject(project: IFCProject): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCPROJECT('${this.generateGUID()}',$,'${project.name}','${project.description || ''}',$,$,$,$,$);`);
        return id;
    }

    /**
     * Add site
     */
    private addSite(projectId: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCSITE('${this.generateGUID()}',$,'Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);

        // Rel aggregates
        const relId = this.nextId();
        this.lines.push(`#${relId}=IFCRELAGGREGATES('${this.generateGUID()}',$,$,$,#${projectId},(#${id}));`);

        return id;
    }

    /**
     * Add building
     */
    private addBuilding(siteId: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCBUILDING('${this.generateGUID()}',$,'Building',$,$,$,$,$,.ELEMENT.,$,$,$);`);

        const relId = this.nextId();
        this.lines.push(`#${relId}=IFCRELAGGREGATES('${this.generateGUID()}',$,$,$,#${siteId},(#${id}));`);

        return id;
    }

    /**
     * Add building storey
     */
    private addBuildingStorey(buildingId: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCBUILDINGSTOREY('${this.generateGUID()}',$,'Level 1',$,$,$,$,$,.ELEMENT.,0.0);`);

        const relId = this.nextId();
        this.lines.push(`#${relId}=IFCRELAGGREGATES('${this.generateGUID()}',$,$,$,#${buildingId},(#${id}));`);

        return id;
    }

    /**
     * Add Cartesian point
     */
    private addCartesianPoint(x: number, y: number, z: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCCARTESIANPOINT((${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
        return id;
    }

    /**
     * Add direction
     */
    private addDirection(x: number, y: number, z: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCDIRECTION((${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
        return id;
    }

    /**
     * Add axis placement
     */
    private addAxis2Placement3D(locationId: number, axisId: number, refDirId: number): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCAXIS2PLACEMENT3D(#${locationId},#${axisId},#${refDirId});`);
        return id;
    }

    /**
     * Add material
     */
    private addMaterial(name: string): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCMATERIAL('${name}',$,$);`);
        return id;
    }

    /**
     * Add section profile
     */
    private addSectionProfile(profile: IFCSectionProfile): number {
        const id = this.nextId();
        const dim = profile.dimensions;

        switch (profile.type) {
            case 'I':
            case 'H':
                this.lines.push(`#${id}=IFCISHAPEPROFILEDEF(.AREA.,'${profile.name}',$,${(dim.width || 0.1).toFixed(6)},${(dim.height || 0.2).toFixed(6)},${(dim.webThickness || 0.01).toFixed(6)},${(dim.flangeThickness || 0.015).toFixed(6)},${(dim.radius || 0.005).toFixed(6)},$,$);`);
                break;

            case 'Rectangle':
                this.lines.push(`#${id}=IFCRECTANGLEPROFILEDEF(.AREA.,'${profile.name}',$,${(dim.width || 0.1).toFixed(6)},${(dim.height || 0.2).toFixed(6)});`);
                break;

            case 'Pipe':
                this.lines.push(`#${id}=IFCCIRCLEPROFILEDEF(.AREA.,'${profile.name}',$,${(dim.radius || 0.1).toFixed(6)});`);
                break;

            default:
                // Default to rectangle
                this.lines.push(`#${id}=IFCRECTANGLEPROFILEDEF(.AREA.,'${profile.name}',$,0.1,0.2);`);
        }

        return id;
    }

    /**
     * Add default profile
     */
    private addDefaultProfile(): number {
        const id = this.nextId();
        this.lines.push(`#${id}=IFCRECTANGLEPROFILEDEF(.AREA.,'Default',$,0.1,0.2);`);
        return id;
    }

    /**
     * Add column
     */
    private addColumn(
        member: IFCMember,
        startNode: IFCNode,
        endNode: IFCNode,
        profileId: number,
        materialId: number,
        storeyId: number
    ): number {
        const height = endNode.y - startNode.y;

        const pointId = this.addCartesianPoint(startNode.x, startNode.y, startNode.z);
        const dirZ = this.addDirection(0, 1, 0);
        const dirX = this.addDirection(1, 0, 0);
        const axisId = this.addAxis2Placement3D(pointId, dirZ, dirX);

        const localId = this.nextId();
        this.lines.push(`#${localId}=IFCLOCALPLACEMENT($,#${axisId});`);

        // Extruded area solid
        const extDirId = this.addDirection(0, 0, 1);
        const solidId = this.nextId();
        this.lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},#${axisId},#${extDirId},${Math.abs(height).toFixed(6)});`);

        const shapeRepId = this.nextId();
        this.lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#${solidId}));`);

        const prodDefId = this.nextId();
        this.lines.push(`#${prodDefId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

        const columnId = this.nextId();
        this.lines.push(`#${columnId}=IFCCOLUMN('${this.generateGUID()}',$,'${member.name}',$,$,#${localId},#${prodDefId},$,.COLUMN.);`);

        // Relate to storey
        const relId = this.nextId();
        this.lines.push(`#${relId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${this.generateGUID()}',$,$,$,(#${columnId}),#${storeyId});`);

        return columnId;
    }

    /**
     * Add beam
     */
    private addBeam(
        member: IFCMember,
        startNode: IFCNode,
        endNode: IFCNode,
        profileId: number,
        materialId: number,
        storeyId: number
    ): number {
        const length = Math.sqrt(
            (endNode.x - startNode.x) ** 2 +
            (endNode.y - startNode.y) ** 2 +
            (endNode.z - startNode.z) ** 2
        );

        const pointId = this.addCartesianPoint(startNode.x, startNode.y, startNode.z);

        // Calculate direction
        const dx = (endNode.x - startNode.x) / length;
        const dy = (endNode.y - startNode.y) / length;
        const dz = (endNode.z - startNode.z) / length;
        const dirZ = this.addDirection(dx, dy, dz);
        const dirX = this.addDirection(0, 0, 1);

        const axisId = this.addAxis2Placement3D(pointId, dirZ, dirX);

        const localId = this.nextId();
        this.lines.push(`#${localId}=IFCLOCALPLACEMENT($,#${axisId});`);

        const extDirId = this.addDirection(0, 0, 1);
        const solidId = this.nextId();
        this.lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},#${axisId},#${extDirId},${length.toFixed(6)});`);

        const shapeRepId = this.nextId();
        this.lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#${solidId}));`);

        const prodDefId = this.nextId();
        this.lines.push(`#${prodDefId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

        const beamId = this.nextId();
        this.lines.push(`#${beamId}=IFCBEAM('${this.generateGUID()}',$,'${member.name}',$,$,#${localId},#${prodDefId},$,.BEAM.);`);

        const relId = this.nextId();
        this.lines.push(`#${relId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${this.generateGUID()}',$,$,$,(#${beamId}),#${storeyId});`);

        return beamId;
    }

    /**
     * Add generic member
     */
    private addMemberGeneric(
        member: IFCMember,
        startNode: IFCNode,
        endNode: IFCNode,
        profileId: number,
        materialId: number,
        storeyId: number
    ): number {
        // Use beam representation for braces
        return this.addBeam(member, startNode, endNode, profileId, materialId, storeyId);
    }

    /**
     * Generate simple GUID
     */
    private generateGUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }).replace(/-/g, '').substring(0, 22);
    }

    /**
     * Get next entity ID
     */
    private nextId(): number {
        return this.entityId++;
    }

    /**
     * Download IFC file
     */
    download(content: string, filename: string = 'structure.ifc'): void {
        const blob = new Blob([content], { type: 'application/x-step' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================
// SINGLETON
// ============================================

export const ifcExport = new IFCExportServiceClass();

export default IFCExportServiceClass;
