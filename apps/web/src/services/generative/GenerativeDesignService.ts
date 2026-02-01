import { Node, Member, SectionDimensions } from '../../store/model';

/**
 * Generates parameters for a portal frame building
 */
interface PortalFrameParams {
    width: number;          // Span (m)
    length: number;         // Length of building (m)
    eaveHeight: number;     // Height at eave (m)
    apexHeight: number;     // Height at apex (m)
    baySpacing: number;     // Distance between frames (m)
}

interface GeneratedStructure {
    nodes: Node[];
    members: Member[];
    description: string;
}

export const GenerativeDesignService = {

    /**
     * Generate a Steel Portal Frame Warehouse
     */
    generatePortalFrame(params: PortalFrameParams): GeneratedStructure {
        const { width, length, eaveHeight, apexHeight, baySpacing } = params;

        const nodes: Node[] = [];
        const members: Member[] = [];
        const nodeIdCounter = 1;
        const memberIdCounter = 1;

        const numBays = Math.ceil(length / baySpacing);
        const actualSpacing = length / numBays;

        // Generate Frames
        for (let i = 0; i <= numBays; i++) {
            const z = i * actualSpacing;
            const framePrefix = i * 100; // ID spacing

            // 1. Column Base Left
            const n1: Node = {
                id: `N${framePrefix + 1}`,
                x: 0, y: 0, z,
                restraints: { fx: true, fy: true, fz: true, mx: true, my: false, mz: false } // Pinned base
            };

            // 2. Column Eave Left
            const n2: Node = { id: `N${framePrefix + 2}`, x: 0, y: eaveHeight, z };

            // 3. Apex
            const n3: Node = { id: `N${framePrefix + 3}`, x: width / 2, y: apexHeight, z };

            // 4. Column Eave Right
            const n4: Node = { id: `N${framePrefix + 4}`, x: width, y: eaveHeight, z };

            // 5. Column Base Right
            const n5: Node = {
                id: `N${framePrefix + 5}`,
                x: width, y: 0, z,
                restraints: { fx: true, fy: true, fz: true, mx: true, my: false, mz: false }
            };

            nodes.push(n1, n2, n3, n4, n5);

            // Members
            // Left Column
            members.push({
                id: `M${framePrefix + 1}`,
                startNodeId: n1.id, endNodeId: n2.id,
                sectionType: 'I-BEAM',
                dimensions: { height: 0.4, width: 0.2, webThickness: 0.008, flangeThickness: 0.012 }, // HEA 400 approx
                E: 200e6
            });

            // Left Rafter
            members.push({
                id: `M${framePrefix + 2}`,
                startNodeId: n2.id, endNodeId: n3.id,
                sectionType: 'I-BEAM',
                dimensions: { height: 0.35, width: 0.18, webThickness: 0.007, flangeThickness: 0.011 }, // IPE 360
                E: 200e6
            });

            // Right Rafter
            members.push({
                id: `M${framePrefix + 3}`,
                startNodeId: n3.id, endNodeId: n4.id,
                sectionType: 'I-BEAM',
                dimensions: { height: 0.35, width: 0.18, webThickness: 0.007, flangeThickness: 0.011 },
                E: 200e6
            });

            // Right Column
            members.push({
                id: `M${framePrefix + 4}`,
                startNodeId: n4.id, endNodeId: n5.id,
                sectionType: 'I-BEAM',
                dimensions: { height: 0.4, width: 0.2, webThickness: 0.008, flangeThickness: 0.012 },
                E: 200e6
            });

            // Purlins / Bracing (Connect to previous frame)
            if (i > 0) {
                const prevFramePrefix = (i - 1) * 100;

                // Eave Beam Left
                members.push({
                    id: `M${framePrefix + 10}`,
                    startNodeId: `N${prevFramePrefix + 2}`, endNodeId: n2.id,
                    sectionType: 'C-CHANNEL',
                    dimensions: { channelHeight: 0.2, channelWidth: 0.08, channelThickness: 0.005 }
                });

                // Eave Beam Right
                members.push({
                    id: `M${framePrefix + 11}`,
                    startNodeId: `N${prevFramePrefix + 4}`, endNodeId: n4.id,
                    sectionType: 'C-CHANNEL',
                    dimensions: { channelHeight: 0.2, channelWidth: 0.08, channelThickness: 0.005 }
                });

                // Ridge Beam (Apex)
                members.push({
                    id: `M${framePrefix + 12}`,
                    startNodeId: `N${prevFramePrefix + 3}`, endNodeId: n3.id,
                    sectionType: 'C-CHANNEL',
                    dimensions: { channelHeight: 0.2, channelWidth: 0.08, channelThickness: 0.005 }
                });
            }
        }

        return {
            nodes,
            members,
            description: `Generated Steel Portal Frame (${width}m x ${length}m) with ${numBays} bays.`
        };
    },

    /**
     * Generate a Grillage / Grid Foundation
     */
    generateGrid(width: number, length: number, spacing: number): GeneratedStructure {
        const nodes: Node[] = [];
        const members: Member[] = [];

        const nx = Math.ceil(width / spacing);
        const nz = Math.ceil(length / spacing);

        // ... (Grid generation logic could go here)

        return {
            nodes: [],
            members: [],
            description: "Grid generation not fully implemented yet."
        };
    }
};
