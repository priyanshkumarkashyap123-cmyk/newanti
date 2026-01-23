/**
 * Structural Validation Utilities
 * Validates structures BEFORE analysis to prevent errors
 */

import { 
    analyzeDeterminacy, 
    type Node as DeterminacyNode, 
    type Member as DeterminacyMember,
    type DeterminacyResult,
    getDeterminacyDescription 
} from './determinacyAnalysis';

export interface ValidationError {
    type: 'error' | 'warning' | 'critical';
    message: string;
    details?: string;
    affectedItems?: string[];
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    determinacy?: DeterminacyResult;  // Added comprehensive determinacy analysis
}

interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx?: boolean;
        fy?: boolean;
        fz?: boolean;
        mx?: boolean;
        my?: boolean;
        mz?: boolean;
    };
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E?: number;
    I?: number;
    A?: number;
}

/**
 * Validates a structural model for stability, determinacy, and geometry
 */
export function validateStructure(
    nodes: Map<string, Node>,
    members: Map<string, Member>
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Basic checks
    if (nodes.size === 0) {
        errors.push({
            type: 'critical',
            message: 'No nodes defined',
            details: 'Add at least 2 nodes to create a structure'
        });
        return { valid: false, errors, warnings };
    }

    if (members.size === 0) {
        errors.push({
            type: 'critical',
            message: 'No members defined',
            details: 'Add at least 1 member connecting nodes'
        });
        return { valid: false, errors, warnings };
    }

    // 1. Check for zero-length members
    const zeroLengthMembers: string[] = [];
    members.forEach((member, id) => {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        
        if (!startNode || !endNode) {
            errors.push({
                type: 'error',
                message: `Member ${id} references non-existent node`,
                affectedItems: [id]
            });
            return;
        }

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = (endNode.z || 0) - (startNode.z || 0);
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (length < 1e-6) {
            zeroLengthMembers.push(id);
        }
    });

    if (zeroLengthMembers.length > 0) {
        errors.push({
            type: 'error',
            message: 'Zero-length members detected',
            details: 'Members must connect two different points',
            affectedItems: zeroLengthMembers
        });
    }

    // 2. Check for disconnected nodes
    const connectedNodes = new Set<string>();
    members.forEach(member => {
        connectedNodes.add(member.startNodeId);
        connectedNodes.add(member.endNodeId);
    });

    const disconnectedNodes: string[] = [];
    nodes.forEach((node, id) => {
        if (!connectedNodes.has(id)) {
            disconnectedNodes.push(id);
        }
    });

    if (disconnectedNodes.length > 0) {
        warnings.push({
            type: 'warning',
            message: `${disconnectedNodes.length} disconnected node(s)`,
            details: 'These nodes are not connected to any members',
            affectedItems: disconnectedNodes
        });
    }

    // 3. Check support conditions (stability)
    const supportedDOFs = countRestraints(nodes);
    const totalDOFs = nodes.size * 3; // 3 DOF per node in 2D (x, y, rotation)

    if (supportedDOFs < 3) {
        errors.push({
            type: 'critical',
            message: 'UNSTABLE STRUCTURE - Insufficient supports',
            details: `At least 3 restraints required for planar stability. Currently: ${supportedDOFs} restraint(s).\n\n` +
                     'Add supports: Pin (2 DOF) or Fixed (3 DOF) or Roller (1 DOF)'
        });
    } else if (supportedDOFs === 1 || supportedDOFs === 2) {
        errors.push({
            type: 'critical',
            message: 'UNSTABLE - Structure can move/rotate',
            details: 'Add more support restraints to prevent rigid body motion'
        });
    }

    // 4. Check for mechanisms (simplified)
    const numMembers = members.size;
    const numNodes = nodes.size;
    const numReactions = supportedDOFs;
    
    // For planar trusses: m + r >= 2n (static determinacy)
    // For frames, this is more complex, but we can warn
    const staticDeterminacy = numMembers + numReactions - 2 * numNodes;
    
    if (staticDeterminacy < 0) {
        errors.push({
            type: 'critical',
            message: 'UNSTABLE - Mechanism detected',
            details: `Structure lacks sufficient members or supports.\n` +
                     `Members: ${numMembers}, Supports: ${numReactions}, Nodes: ${numNodes}\n` +
                     `Need: m + r ≥ 2n for planar structures`
        });
    } else if (staticDeterminacy === 0) {
        warnings.push({
            type: 'warning',
            message: 'Statically determinate structure',
            details: 'Good! Structure has exactly enough supports and members.'
        });
    } else if (staticDeterminacy > 0) {
        warnings.push({
            type: 'warning',
            message: `Statically indeterminate (degree ${staticDeterminacy})`,
            details: 'Structure has redundant supports/members. Analysis will use stiffness method.'
        });
    }

    // 5. Check for parallel supports (can cause instability)
    const restraintTypes = new Map<string, number>();
    nodes.forEach(node => {
        if (node.restraints) {
            const key = `${node.restraints.fx}_${node.restraints.fy}_${node.restraints.fz}`;
            restraintTypes.set(key, (restraintTypes.get(key) || 0) + 1);
        }
    });

    // 6. Check for material/section properties
    let missingProperties = 0;
    members.forEach((member, id) => {
        if (!member.E || member.E <= 0) missingProperties++;
        if (!member.I || member.I <= 0) missingProperties++;
        if (!member.A || member.A <= 0) missingProperties++;
    });

    if (missingProperties > 0) {
        warnings.push({
            type: 'warning',
            message: 'Missing material properties',
            details: 'Some members have default values for E, I, or A'
        });
    }

    // 7. Check for loads
    // This is handled separately, but we can warn if no loads exist

    // ========================================================================
    // 8. COMPREHENSIVE DETERMINACY ANALYSIS
    // ========================================================================
    
    // Convert to array format for determinacy analysis
    const nodesArray: DeterminacyNode[] = Array.from(nodes.values());
    const membersArray: DeterminacyMember[] = Array.from(members.values());
    
    // Auto-detect if structure is 3D based on Z-coordinate variation
    const zCoords = nodesArray.map(n => n.z || 0);
    const uniqueZ = [...new Set(zCoords.map(z => Math.round(z * 1000)))]; // Round to mm precision
    const is3D = uniqueZ.length > 1; // More than one distinct Z coordinate = 3D structure
    const structureType = is3D ? '3D' : '2D';
    
    console.log(`[Structural Validation] Auto-detected structure type: ${structureType} (${uniqueZ.length} Z-planes)`);
    
    // Run comprehensive determinacy analysis
    const determinacy = analyzeDeterminacy(nodesArray, membersArray, structureType);
    
    // Add determinacy-specific errors and warnings
    determinacy.errors.forEach(err => {
        errors.push({
            type: 'critical',
            message: err,
            details: 'From determinacy analysis'
        });
    });
    
    determinacy.warnings.forEach(warn => {
        warnings.push({
            type: 'warning',
            message: warn,
            details: 'From determinacy analysis'
        });
    });
    
    // Log determinacy analysis for debugging
    console.log('[Structural Validation] Determinacy Analysis:');
    console.log(getDeterminacyDescription(determinacy));

    return {
        valid: errors.filter(e => e.type === 'error' || e.type === 'critical').length === 0,
        errors,
        warnings,
        determinacy  // Include full determinacy analysis
    };
}

/**
 * Count total number of restraints in the structure
 */
function countRestraints(nodes: Map<string, Node>): number {
    let count = 0;
    nodes.forEach(node => {
        if (node.restraints) {
            if (node.restraints.fx) count++;
            if (node.restraints.fy) count++;
            if (node.restraints.fz) count++;
            // Note: For 2D analysis, we typically only count translational restraints
            // Rotational restraints are implicit in beam formulation
        }
    });
    return count;
}

/**
 * Get support type description
 */
export function getSupportType(restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
}): string {
    if (!restraints) return 'None';
    
    const fx = restraints.fx || false;
    const fy = restraints.fy || false;
    const fz = restraints.fz || false;
    
    if (fx && fy && fz) return 'Fixed (3 DOF)';
    if (fx && fy) return 'Pin (2 DOF)';
    if (fy) return 'Roller-X (1 DOF)';
    if (fx) return 'Roller-Y (1 DOF)';
    if (fz) return 'Roller-Z (1 DOF)';
    
    return 'None';
}

/**
 * Quick validation for specific error types
 */
export function hasMinimumSupports(nodes: Map<string, Node>): boolean {
    return countRestraints(nodes) >= 3;
}

export function hasZeroLengthMembers(nodes: Map<string, Node>, members: Map<string, Member>): boolean {
    for (const member of members.values()) {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        
        if (!startNode || !endNode) continue;

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = (endNode.z || 0) - (startNode.z || 0);
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (length < 1e-6) return true;
    }
    return false;
}
