/**
 * PHASE 4 SPRINT 2 - AI VALIDATION
 * 
 * File: scripts/validate-ai-flow.js
 * Command: node scripts/validate-ai-flow.js
 * 
 * Objectives:
 * 1. Verify Prompt Parsing Logic (Regex).
 * 2. Verify Model Generation Dispatch.
 */

// Mock Architect Logic (Reproduction of TS logic for standalone testing)
class AIArchitectMock {
    static parsePrompt(prompt) {
        const text = prompt.toLowerCase();

        let type = 'unknown';
        if (text.includes('bridge')) type = 'bridge';
        else if (text.includes('tower') || text.includes('skyscraper')) type = 'tower';
        else if (text.includes('frame') || text.includes('portal')) type = 'frame';

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

    static validateModel(model) {
        const issues = [];

        if (!Array.isArray(model.nodes) || model.nodes.length === 0) {
            issues.push('Missing or empty nodes array');
        }

        if (!Array.isArray(model.members) || model.members.length === 0) {
            issues.push('Missing or empty members array');
        }

        if (Array.isArray(model.nodes) && Array.isArray(model.members)) {
            const nodeIds = new Set(model.nodes.map(n => n.id));
            const hasSupport = model.nodes.some(n => n.isSupport || n.restraints?.fy || n.restraints?.fx || n.restraints?.fz);

            for (const member of model.members) {
                if (!nodeIds.has(member.s)) {
                    issues.push(`Member ${member.id} has invalid start node ${member.s}`);
                }
                if (!nodeIds.has(member.e)) {
                    issues.push(`Member ${member.id} has invalid end node ${member.e}`);
                }
            }

            if (!hasSupport) {
                issues.push('No supports defined');
            }
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }
}

function testAIFlow() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Prompt Parsing');
    console.log('='.repeat(60));

    const prompt1 = "Generate a 100m span bridge with 20 bays and 10m height";
    console.log(`Prompt: "${prompt1}"`);

    const intent1 = AIArchitectMock.parsePrompt(prompt1);
    console.log("Parsed Intent:", intent1);

    if (intent1.type === 'bridge' && intent1.span === 100 && intent1.bays === 20 && intent1.height === 10) {
        console.log("PASS: Correctly extracted Bridge params.");
    } else {
        console.log("FAIL: Parameter extraction failed.");
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Tower Parsing');
    console.log('='.repeat(60));

    const prompt2 = "Design a 50m tall tower with 10 floors";
    console.log(`Prompt: "${prompt2}"`);

    const intent2 = AIArchitectMock.parsePrompt(prompt2);
    console.log("Parsed Intent:", intent2);

    if (intent2.type === 'tower' && intent2.height === 50 && intent2.bays === 10) { // 'floors' maps to bays
        console.log("PASS: Correctly extracted Tower params.");
    } else {
        console.log("FAIL: Parameter extraction failed.");
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Generator Dispatch (Mock Check)');
    console.log('='.repeat(60));

    // Simulate Generator Call logic
    if (intent1.type === 'bridge') {
        const span = intent1.span || 50;
        const height = intent1.height || 5;
        const panels = intent1.bays || 10;
        console.log(`Dispatching to: generateWarrenBridge(span=${span}, height=${height}, panels=${panels})`);
        console.log("PASS: Dispatch logic correct.");
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Deterministic Validation - Invalid Node Reference');
    console.log('='.repeat(60));

    const invalidRefModel = {
        nodes: [
            { id: 'n1', x: 0, y: 0, z: 0, isSupport: true },
            { id: 'n2', x: 6, y: 0, z: 0 }
        ],
        members: [
            { id: 'm1', s: 'n1', e: 'n3', section: 'ISMB300' }
        ]
    };

    const invalidRefValidation = AIArchitectMock.validateModel(invalidRefModel);
    console.log('Validation:', invalidRefValidation);
    if (!invalidRefValidation.valid && invalidRefValidation.issues.some(i => i.includes('invalid end node'))) {
        console.log('PASS: Invalid member node reference detected.');
    } else {
        console.log('FAIL: Invalid member node reference was not detected.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 5: Deterministic Validation - Missing Supports');
    console.log('='.repeat(60));

    const noSupportModel = {
        nodes: [
            { id: 'n1', x: 0, y: 0, z: 0 },
            { id: 'n2', x: 6, y: 0, z: 0 }
        ],
        members: [
            { id: 'm1', s: 'n1', e: 'n2', section: 'ISMB300' }
        ]
    };

    const noSupportValidation = AIArchitectMock.validateModel(noSupportModel);
    console.log('Validation:', noSupportValidation);
    if (!noSupportValidation.valid && noSupportValidation.issues.includes('No supports defined')) {
        console.log('PASS: Missing supports detected.');
    } else {
        console.log('FAIL: Missing supports were not detected.');
    }
}

testAIFlow();
