/**
 * Structural Analysis Solver - Direct Stiffness Method for 2D Frame
 *
 * For simplicity, we start with a 2D analysis (X-Y plane):
 * - 3 DOFs per node: dx, dy, rz (translation X, Y, rotation Z)
 * - Full frame element with axial, shear, and bending
 */
interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}
interface NodeLoad {
    id: string;
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}
interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId: string;
    E?: number;
    A?: number;
    I?: number;
}
interface AnalysisRequest {
    nodes: Node[];
    members: Member[];
    loads: NodeLoad[];
}
interface DisplacementResult {
    dx: number;
    dy: number;
    dz: number;
    rx: number;
    ry: number;
    rz: number;
}
interface ReactionResult {
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
}
interface MemberForceResult {
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
}
interface AnalysisResult {
    displacements: Record<string, DisplacementResult>;
    reactions: Record<string, ReactionResult>;
    memberForces: Record<string, MemberForceResult>;
    success: boolean;
    message: string;
}
/**
 * Main analysis function
 */
export declare function analyzeStructure(request: AnalysisRequest): AnalysisResult;
export {};
//# sourceMappingURL=solver.d.ts.map