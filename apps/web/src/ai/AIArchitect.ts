import { generateWarrenBridge } from '../demos/warren-bridge';

// Types
interface ModelData {
    nodes: any[];
    members: any[];
    loads: any[];
    materials: any[];
    sections: any[];
    dofPerNode: number; // 2, 3, or 6
}

export class AIArchitect {

    /**
     * Parsing Logic (Rule-Based NLP)
     * Extract intent and parameters from text.
     */
    static parsePrompt(prompt: string) {
        const text = prompt.toLowerCase();

        let type = 'unknown';
        if (text.includes('bridge')) type = 'bridge';
        else if (text.includes('tower') || text.includes('skyscraper')) type = 'tower';
        else if (text.includes('frame') || text.includes('portal')) type = 'frame';

        // Extract Numbers
        // Look for "Xm span", "X m height", "X bays"
        const spanMatch = text.match(/(\d+(\.\d+)?)\s*m\s*(span|length|width)/);
        const heightMatch = text.match(/(\d+(\.\d+)?)\s*m\s*(height|tall)/);
        const baysMatch = text.match(/(\d+)\s*(bays?|floors?|stories?)/);

        return {
            type,
            span: spanMatch ? parseFloat(spanMatch[1]) : undefined,
            height: heightMatch ? parseFloat(heightMatch[1]) : undefined,
            bays: baysMatch ? parseInt(baysMatch[1]) : undefined
        };
    }

    /**
     * Generates a Structural Model based on the prompt.
     */
    static generateModel(prompt: string): ModelData | null {
        const intent = this.parsePrompt(prompt);
        console.log('AI Intent:', intent);

        if (intent.type === 'bridge') {
            // Default Params
            const span = intent.span || 40;
            const height = intent.height || 5;
            const bays = intent.bays || Math.ceil(span / 5); // Default 5m panels

            // Call Warren Bridge Generator
            // Note: generateWarrenBridge might need adaptation if it expects specific args
            // Assuming it accepts (span, height, bays).
            // We need to check `generateWarrenBridge` signature.
            // For now, assume it returns a ModelData-like object.

            return generateWarrenBridge(span, height, bays, 5); // width=5 default
        }

        if (intent.type === 'tower') {
            // Stub for Tower
            return this.generateSimpleTower(intent.height || 50, intent.bays || 10);
        }

        return null;
    }

    // Simple Tower Generator (Stub)
    static generateSimpleTower(height: number, floors: number): ModelData {
        // Generate a 2D Tower (Ladder)
        const width = 10;
        const floorHeight = height / floors;

        const nodes = [];
        const members = [];

        // Nodes
        for (let i = 0; i <= floors; i++) {
            const y = i * floorHeight;
            nodes.push({ id: `nL${i}`, x: 0, y, z: 0, fixed: i === 0 });
            nodes.push({ id: `nR${i}`, x: width, y, z: 0, fixed: i === 0 });
        }

        // Members
        for (let i = 0; i < floors; i++) {
            // Columns
            members.push({ id: `cL${i}`, startNodeId: `nL${i}`, endNodeId: `nL${i + 1}`, section: 'Default', E: 2e11, A: 0.01 });
            members.push({ id: `cR${i}`, startNodeId: `nR${i}`, endNodeId: `nR${i + 1}`, section: 'Default', E: 2e11, A: 0.01 });
            // Beams
            members.push({ id: `b${i + 1}`, startNodeId: `nL${i + 1}`, endNodeId: `nR${i + 1}`, section: 'Default', E: 2e11, A: 0.005 });
            // Bracing?
            members.push({ id: `x${i}`, startNodeId: `nL${i}`, endNodeId: `nR${i + 1}`, section: 'Default', E: 2e11, A: 0.002 });
            members.push({ id: `y${i}`, startNodeId: `nR${i}`, endNodeId: `nL${i + 1}`, section: 'Default', E: 2e11, A: 0.002 });
        }

        return {
            nodes,
            members,
            loads: [],
            materials: [],
            sections: [],
            dofPerNode: 3
        };
    }
}
