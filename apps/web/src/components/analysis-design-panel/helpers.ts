import { Material, MATERIALS_DATABASE, SectionProperties, getMaterialById, getSectionById } from '../../data/SectionDatabase';
import { STEEL_SECTIONS } from '../../data/sectionDatabaseSteelSections';
import type { Member, Node, ProjectInfo } from '../../store/model';
import type { SteelDesignResults } from '../../services/SteelDesignService';

export interface MemberDesignConfig {
    memberId: string;
    section: SectionProperties;
    material: Material;
    Lb: number;
    Kx: number;
    Ky: number;
}

export interface DesignSummary {
    passed: number;
    failed: number;
    warnings: number;
    maxRatio: number;
    criticalMember: string;
    total: number;
}

export function computeMemberLengths(
    members: Map<string, Member>,
    nodes: Map<string, Node>
): Map<string, number> {
    const lengths = new Map<string, number>();

    members.forEach((member, id) => {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        if (!startNode || !endNode) {
            return;
        }

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z;
        lengths.set(id, Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000);
    });

    return lengths;
}

export function createDefaultDesignConfig(
    memberId: string,
    memberLengths: Map<string, number>,
    defaultSectionId: string,
    defaultMaterialId: string
): MemberDesignConfig {
    const length = memberLengths.get(memberId) || 3000;

    return {
        memberId,
        section: getSectionById(defaultSectionId) || STEEL_SECTIONS[0],
        material: getMaterialById(defaultMaterialId) || MATERIALS_DATABASE[0],
        Lb: length,
        Kx: 1.0,
        Ky: 1.0,
    };
}

export function computeDesignSummary(designResults: Map<string, SteelDesignResults>): DesignSummary {
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let maxRatio = 0;
    let criticalMember = '';

    designResults.forEach((result, id) => {
        if (result.overallStatus === 'PASS') {
            passed += 1;
        } else if (result.overallStatus === 'FAIL') {
            failed += 1;
        } else {
            warnings += 1;
        }

        if (result.criticalRatio > maxRatio) {
            maxRatio = result.criticalRatio;
            criticalMember = id;
        }
    });

    return {
        passed,
        failed,
        warnings,
        maxRatio,
        criticalMember,
        total: designResults.size,
    };
}

export function buildReportMeta(
    projectInfo: ProjectInfo | undefined,
    user: { fullName?: string; email?: string } | null
): { name: string; engineer: string; date: string; description: string } {
    return {
        name: projectInfo?.name ?? 'Untitled Project',
        engineer: user?.fullName ?? user?.email ?? 'Engineer',
        date: new Date().toLocaleDateString(),
        description: projectInfo?.description ?? 'Automated Design Report',
    };
}
