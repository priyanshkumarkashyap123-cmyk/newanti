/**
 * usePhysicalModeling.ts - Hook for Physical Member Workflow
 * 
 * Provides React integration for:
 * - Physical Member creation and management
 * - Auto-meshing (splitting at intersections)
 * - Geometry operations (copy, repeat, mirror)
 * - Import/Export utilities
 */

import { useCallback, useMemo, useState } from 'react';
import { useModelStore, Node, Member } from '../store/model';
import {
    PhysicalMemberManager,
    PhysicalMember,
    PhysicalMemberSection,
    StructureWizard,
    DXFImporter,
    IFCExporter,
    TrussGeneratorParams,
    FrameGeneratorParams,
    ShellGeneratorParams
} from '../modules/modeling/physical_modeler';
import {
    Vector3,
    extrudeGeometry,
    rotateCopy,
    mirror as mirrorGeometryFn,
    cylindricalToCartesian,
    cartesianToCylindrical,
    CylindricalCoord
} from '../core/geometry_engine';

// ============================================
// TYPES
// ============================================

interface PhysicalModelingState {
    physicalMembers: PhysicalMember[];
    lastMeshResult: { nodes: Node[]; members: Member[] } | null;
    isProcessing: boolean;
    error: string | null;
}

interface UsePhysicalModelingReturn {
    // State
    physicalMembers: PhysicalMember[];
    isProcessing: boolean;
    error: string | null;
    
    // Physical Member Operations
    addPhysicalMember: (
        startPoint: Vector3,
        endPoint: Vector3,
        section?: Partial<PhysicalMemberSection>
    ) => PhysicalMember;
    updatePhysicalMember: (id: string, updates: Partial<PhysicalMember>) => void;
    deletePhysicalMember: (id: string) => void;
    clearPhysicalMembers: () => void;
    
    // Auto-Mesh
    autoMesh: () => { nodes: Node[]; members: Member[] };
    meshAndLoadToScene: () => void;
    
    // Structure Wizard
    generateTruss: (params: TrussGeneratorParams) => void;
    generateFrame: (params: FrameGeneratorParams) => void;
    generateShell: (params: ShellGeneratorParams) => void;
    
    // Geometry Operations
    linearRepeat: (memberIds: string[], direction: Vector3, count: number, spacing: number) => void;
    circularRepeat: (memberIds: string[], center: Vector3, axis: Vector3, count: number) => void;
    mirror: (memberIds: string[], plane: 'XY' | 'XZ' | 'YZ') => void;
    
    // Import/Export
    importDXF: (dxfContent: string) => { nodes: Node[]; members: Member[] };
    exportIFC: (projectName?: string) => string;
    exportISM: (projectName?: string) => string;
    
    // Coordinate Systems
    convertCylindrical: (coords: CylindricalCoord[]) => Vector3[];
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePhysicalModeling(): UsePhysicalModelingReturn {
    // Model store
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const loadStructure = useModelStore((s) => s.loadStructure);
    const addNodes = useModelStore((s) => s.addNodes);
    const addMembers = useModelStore((s) => s.addMembers);
    
    // Local state
    const [manager] = useState(() => new PhysicalMemberManager());
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Physical members as array
    const physicalMembers = useMemo(() => 
        manager.getAllPhysicalMembers(),
        [manager]
    );
    
    // ============================================
    // PHYSICAL MEMBER OPERATIONS
    // ============================================
    
    const addPhysicalMember = useCallback((
        startPoint: Vector3,
        endPoint: Vector3,
        sectionParams?: Partial<PhysicalMemberSection>
    ): PhysicalMember => {
        const section: PhysicalMemberSection = {
            id: sectionParams?.id ?? 'default',
            name: sectionParams?.name ?? 'Default Section',
            width: sectionParams?.width ?? 0.2,
            height: sectionParams?.height ?? 0.3,
            area: sectionParams?.area ?? 0.01,
            Ix: sectionParams?.Ix ?? 1e-4,
            Iy: sectionParams?.Iy ?? 1e-4,
            material: sectionParams?.material ?? 'Steel'
        };
        
        const id = `PM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return manager.addPhysicalMember({
            id,
            name: `Member ${physicalMembers.length + 1}`,
            startPoint,
            endPoint,
            section
        });
    }, [manager, physicalMembers.length]);
    
    const updatePhysicalMember = useCallback((id: string, updates: Partial<PhysicalMember>) => {
        manager.updatePhysicalMember(id, updates);
    }, [manager]);
    
    const deletePhysicalMember = useCallback((id: string) => {
        manager.deletePhysicalMember(id);
    }, [manager]);
    
    const clearPhysicalMembers = useCallback(() => {
        manager.clear();
    }, [manager]);
    
    // ============================================
    // AUTO-MESH
    // ============================================
    
    const autoMesh = useCallback(() => {
        try {
            setIsProcessing(true);
            setError(null);
            return manager.autoMesh();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Auto-mesh failed';
            setError(message);
            return { nodes: [], members: [] };
        } finally {
            setIsProcessing(false);
        }
    }, [manager]);
    
    const meshAndLoadToScene = useCallback(() => {
        const result = autoMesh();
        if (result.nodes.length > 0) {
            loadStructure(result.nodes, result.members);
        }
    }, [autoMesh, loadStructure]);
    
    // ============================================
    // STRUCTURE WIZARD
    // ============================================
    
    const generateTruss = useCallback((params: TrussGeneratorParams) => {
        try {
            setIsProcessing(true);
            const result = StructureWizard.generateTruss(params);
            loadStructure(result.nodes, result.members);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Truss generation failed');
        } finally {
            setIsProcessing(false);
        }
    }, [loadStructure]);
    
    const generateFrame = useCallback((params: FrameGeneratorParams) => {
        try {
            setIsProcessing(true);
            const result = StructureWizard.generateFrame(params);
            loadStructure(result.nodes, result.members);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Frame generation failed');
        } finally {
            setIsProcessing(false);
        }
    }, [loadStructure]);
    
    const generateShell = useCallback((params: ShellGeneratorParams) => {
        try {
            setIsProcessing(true);
            const result = StructureWizard.generateShell(params);
            loadStructure(result.nodes, result.members);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Shell generation failed');
        } finally {
            setIsProcessing(false);
        }
    }, [loadStructure]);
    
    // ============================================
    // GEOMETRY OPERATIONS
    // ============================================
    
    const linearRepeat = useCallback((
        memberIds: string[],
        direction: Vector3,
        count: number,
        spacing: number
    ) => {
        try {
            setIsProcessing(true);
            
            // Get members to copy
            const membersToRepeat = memberIds
                .map(id => members.get(id))
                .filter((m): m is Member => m !== undefined);
            
            if (membersToRepeat.length === 0) return;
            
            // Get relevant nodes
            const nodeIds = new Set<string>();
            membersToRepeat.forEach(m => {
                nodeIds.add(m.startNodeId);
                nodeIds.add(m.endNodeId);
            });
            
            const nodesToCopy = Array.from(nodeIds)
                .map(id => nodes.get(id))
                .filter((n): n is Node => n !== undefined);
            
            // Use geometry engine to extrude (linear copy)
            const { nodes: newNodes, members: newMembers } = extrudeGeometry(
                nodesToCopy,
                membersToRepeat,
                direction,
                spacing,
                count,
                false // Don't link steps for linear repeat
            );
            
            addNodes(newNodes);
            addMembers(newMembers);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Linear repeat failed');
        } finally {
            setIsProcessing(false);
        }
    }, [members, nodes, addNodes, addMembers]);
    
    const circularRepeat = useCallback((
        memberIds: string[],
        center: Vector3,
        axis: Vector3,
        count: number
    ) => {
        try {
            setIsProcessing(true);
            
            const membersToRepeat = memberIds
                .map(id => members.get(id))
                .filter((m): m is Member => m !== undefined);
            
            if (membersToRepeat.length === 0) return;
            
            const nodeIds = new Set<string>();
            membersToRepeat.forEach(m => {
                nodeIds.add(m.startNodeId);
                nodeIds.add(m.endNodeId);
            });
            
            const nodesToCopy = Array.from(nodeIds)
                .map(id => nodes.get(id))
                .filter((n): n is Node => n !== undefined);
            
            // Calculate angle step for equal distribution around circle
            const angleStep = (2 * Math.PI) / count;
            
            const { nodes: newNodes, members: newMembers } = rotateCopy(
                nodesToCopy,
                membersToRepeat,
                axis,
                center,
                angleStep,
                count - 1  // totalSteps (excluding original)
            );
            
            addNodes(newNodes);
            addMembers(newMembers);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Circular repeat failed');
        } finally {
            setIsProcessing(false);
        }
    }, [members, nodes, addNodes, addMembers]);
    
    const mirror = useCallback((memberIds: string[], plane: 'XY' | 'XZ' | 'YZ') => {
        try {
            setIsProcessing(true);
            
            const membersToMirror = memberIds
                .map(id => members.get(id))
                .filter((m): m is Member => m !== undefined);
            
            if (membersToMirror.length === 0) return;
            
            const nodeIds = new Set<string>();
            membersToMirror.forEach(m => {
                nodeIds.add(m.startNodeId);
                nodeIds.add(m.endNodeId);
            });
            
            const nodesToMirror = Array.from(nodeIds)
                .map(id => nodes.get(id))
                .filter((n): n is Node => n !== undefined);
            
            const { nodes: newNodes, members: newMembers } = mirrorGeometryFn(
                nodesToMirror,
                membersToMirror,
                plane
            );
            
            addNodes(newNodes);
            addMembers(newMembers);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Mirror failed');
        } finally {
            setIsProcessing(false);
        }
    }, [members, nodes, addNodes, addMembers]);
    
    // ============================================
    // IMPORT/EXPORT
    // ============================================
    
    const importDXF = useCallback((dxfContent: string) => {
        try {
            setIsProcessing(true);
            setError(null);
            
            const entities = DXFImporter.parse(dxfContent);
            return DXFImporter.toStructuralModel(entities);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'DXF import failed';
            setError(message);
            return { nodes: [], members: [] };
        } finally {
            setIsProcessing(false);
        }
    }, []);
    
    const exportIFC = useCallback((projectName: string = 'BeamLab Project'): string => {
        try {
            setIsProcessing(true);
            
            // Convert current model to physical members
            const physicalMembers: PhysicalMember[] = [];
            members.forEach((member) => {
                const startNode = nodes.get(member.startNodeId);
                const endNode = nodes.get(member.endNodeId);
                
                if (startNode && endNode) {
                    const section: PhysicalMemberSection = {
                        id: member.sectionId || 'Default',
                        name: member.sectionId || 'Default',
                        width: 0.2,
                        height: 0.3,
                        area: member.A || 0.01,
                        Ix: member.I || 1e-4,
                        Iy: member.I || 1e-4,
                        material: 'Steel'
                    };
                    
                    physicalMembers.push({
                        id: member.id,
                        name: member.id,
                        startPoint: { x: startNode.x, y: startNode.y, z: startNode.z },
                        endPoint: { x: endNode.x, y: endNode.y, z: endNode.z },
                        section,
                        analyticalMemberIds: [member.id],
                        analyticalNodeIds: []
                    });
                }
            });
            
            const ifcModel = IFCExporter.exportToIFC(physicalMembers, projectName);
            return IFCExporter.toJSON(ifcModel);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'IFC export failed');
            return '';
        } finally {
            setIsProcessing(false);
        }
    }, [members, nodes]);
    
    const exportISM = useCallback((projectName: string = 'BeamLab Project'): string => {
        try {
            setIsProcessing(true);
            
            const ismModel = {
                version: '1.0',
                schema: 'ISM',
                application: 'BeamLab',
                timestamp: new Date().toISOString(),
                project: {
                    name: projectName,
                    units: {
                        length: 'm',
                        force: 'kN',
                        moment: 'kN-m'
                    },
                    coordinateSystem: 'Cartesian'
                },
                geometry: {
                    nodes: Array.from(nodes.values()).map(n => ({
                        id: n.id,
                        coordinates: [n.x, n.y, n.z],
                        restraints: n.restraints ? {
                            translation: [n.restraints.fx, n.restraints.fy, n.restraints.fz],
                            rotation: [n.restraints.mx, n.restraints.my, n.restraints.mz]
                        } : null
                    })),
                    members: Array.from(members.values()).map(m => ({
                        id: m.id,
                        type: 'IfcBeam',
                        connectivity: [m.startNodeId, m.endNodeId],
                        section: {
                            id: m.sectionId,
                            profile: 'RectangularHollow'
                        },
                        material: {
                            type: 'Steel',
                            E: m.E || 200e6,
                            fy: 250e3
                        },
                        properties: {
                            A: m.A || 0.01,
                            I: m.I || 1e-4
                        },
                        releases: m.releases || null,
                        offsets: {
                            start: m.startOffset || null,
                            end: m.endOffset || null
                        }
                    }))
                },
                metadata: {
                    nodeCount: nodes.size,
                    memberCount: members.size,
                    createdBy: 'BeamLab',
                    exportedAt: new Date().toISOString()
                }
            };
            
            return JSON.stringify(ismModel, null, 2);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ISM export failed');
            return '';
        } finally {
            setIsProcessing(false);
        }
    }, [members, nodes]);
    
    // ============================================
    // COORDINATE SYSTEMS
    // ============================================
    
    const convertCylindrical = useCallback((coords: CylindricalCoord[]): Vector3[] => {
        return coords.map(cylindricalToCartesian);
    }, []);
    
    // ============================================
    // RETURN
    // ============================================
    
    return {
        // State
        physicalMembers,
        isProcessing,
        error,
        
        // Physical Member Operations
        addPhysicalMember,
        updatePhysicalMember,
        deletePhysicalMember,
        clearPhysicalMembers,
        
        // Auto-Mesh
        autoMesh,
        meshAndLoadToScene,
        
        // Structure Wizard
        generateTruss,
        generateFrame,
        generateShell,
        
        // Geometry Operations
        linearRepeat,
        circularRepeat,
        mirror,
        
        // Import/Export
        importDXF,
        exportIFC,
        exportISM,
        
        // Coordinate Systems
        convertCylindrical
    };
}

export default usePhysicalModeling;
