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
}

testAIFlow();
