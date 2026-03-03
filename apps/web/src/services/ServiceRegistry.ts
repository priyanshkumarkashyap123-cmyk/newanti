/**
 * ServiceRegistry.ts - Central Service Registry
 * 
 * CEO-level integration point for all services.
 * Provides unified access to all platform capabilities.
 */

// ============================================
// CORE SERVICES
// ============================================
export { wasmSolver } from './wasmSolverService';
export { database } from './DatabaseService';
export { errorHandler, ERROR_CODES } from './ErrorHandlingService';

// ============================================
// AI SERVICES
// ============================================
export { geminiAI } from './GeminiAIService';
export { aiValidation } from './AIValidationService';
export { PINNService } from './PINNService';
export { vertexTraining } from './VertexAITrainingService';

// ============================================
// DESIGN CODE SERVICES
// ============================================
export { codeCompliance } from './CodeComplianceEngine';
export { connectionDesign } from './ConnectionDesignService';
export { default as concreteDesign } from './ConcreteDesignService';
export { default as steelDesign } from './SteelDesignService';
export { loadCombinations } from './loads/LoadCombinationsService';

// Design code checkers
export * from './design-codes';

// ============================================
// ML SERVICES
// ============================================
export { reinforcementLearning } from './ml/ReinforcementLearningService';
// export { feedbackLearning } from './learning/FeedbackLearningService';
// export { adaptivePreferences } from './learning/AdaptivePreferencesService';

// ============================================
// VOICE & INPUT SERVICES
// ============================================
export { voiceInput } from './voice/VoiceInputService';
export { voiceExecutor } from './voice/VoiceCommandExecutor';

// ============================================
// COLLABORATION SERVICES
// ============================================
// export { collaborationService } from './collaboration/CollaborationService';

// ============================================
// EXPORT SERVICES
// ============================================
export { generateIFC, downloadIFC } from './IFCExportService';
export { enhancedDXF } from './EnhancedDXFExportService';
export { peReport } from './reports/PEReadyReportGenerator';

// ============================================
// AUDIT & LOGGING
// ============================================
export { auditTrail } from './AuditTrailService';

// ============================================
// UNIFIED SERVICE INTERFACE
// ============================================

import { wasmSolver } from './wasmSolverService';
import { database } from './DatabaseService';
import { errorHandler } from './ErrorHandlingService';
import { geminiAI } from './GeminiAIService';
import { aiValidation } from './AIValidationService';
import { codeCompliance } from './CodeComplianceEngine';
import { connectionDesign } from './ConnectionDesignService';
import { loadCombinations } from './loads/LoadCombinationsService';
import { voiceInput } from './voice/VoiceInputService';
import { voiceExecutor } from './voice/VoiceCommandExecutor';
import { peReport } from './reports/PEReadyReportGenerator';
import { generateIFC } from './IFCExportService';
import { enhancedDXF } from './EnhancedDXFExportService';

/**
 * Unified service interface for CEO-level access
 * Exposes unified service access for app initialization and workflows.
 */
export class BeamLabServices {
     // Core
    readonly errors = errorHandler;

     get solver() { return wasmSolver; }
     get db() { return database; }
     get ai() { return geminiAI; }
     get validation() { return aiValidation; }
     get codes() { return codeCompliance; }
     get connections() { return connectionDesign; }
     get loadCombos() { return loadCombinations; }
     get voice() { return voiceInput; }
     get voiceCommands() { return voiceExecutor; }
     get reports() { return peReport; }
     get ifc() { return { generate: generateIFC }; }
     get dxf() { return enhancedDXF; }

    /**
     * Initialize all services
     */
    async initialize(): Promise<void> {
        console.log('[BeamLab] Initializing services...');

        // Initialize database if available
        if (typeof this.db?.initialize === 'function') {
            await this.db.initialize();
        }

        // Initialize WASM solver
        await this.solver.initialize?.();

        console.log('[BeamLab] All services initialized');
    }

    /**
     * Run complete structural workflow
     */
    async runStructuralWorkflow(model: {
        nodes: unknown;
        members: Array<{ id: string; section: string; material: string; length: number }>;
        pointLoads?: unknown[];
        loads?: unknown[];
        memberLoads?: unknown[];
        projectName?: string;
    }, options: {
        designCode: 'IS800' | 'AISC360' | 'EC3';
        includeConnections?: boolean;
        generateReport?: boolean;
    }): Promise<{
        analysis: unknown;
        designChecks: Array<{ memberId: string; checks: Array<{ ratio: number; status: string }> }>;
        report?: string;
    }> {
        // 1. Run analysis
        const nodes = (Array.isArray(model.nodes) ? model.nodes : Array.from((model.nodes as Map<string, unknown>)?.values?.() || [])) as unknown[];
        const members = (Array.isArray(model.members) ? model.members : Array.from((model.members as Map<string, unknown>)?.values?.() || [])) as unknown[];
        const pointLoads = (model.pointLoads || model.loads || []) as unknown[];
        const memberLoads = (model.memberLoads || []) as unknown[];
        const analysis = await (this.solver.analyze as (n: unknown, m: unknown, p: unknown, ml: unknown) => Promise<unknown>)(nodes, members, pointLoads, memberLoads);
        const analysisResult = analysis as Record<string, unknown>;
        const memberForcesMap = (analysisResult.memberForces || analysisResult.member_forces || {}) as Record<string, Record<string, number>>;

        // 2. Run design checks
        const designChecks = [];
        for (const member of model.members) {
            const forces = (memberForcesMap[member.id] || {
                axial: 0,
                momentZ: 0,
                momentY: 0,
                shearY: 0,
                shearZ: 0
            }) as any;
            const result = this.codes.checkSteelMember(
                {
                    section: member.section as unknown as any,
                    material: member.material as unknown as any,
                    length: member.length,
                    unbracedLength: member.length,
                    effectiveLengthY: 1.0,
                    effectiveLengthZ: 1.0
                },
                forces
            );
            designChecks.push({ memberId: member.id, checks: result.checks });
        }

        // 3. Generate report if requested
        let report;
        if (options.generateReport) {
            const memberSummaries = designChecks.map(dc => ({
                id: dc.memberId,
                section: 'ISMB 300',
                length: 6,
                axial: 0,
                moment: memberForcesMap[dc.memberId]?.moment || 0,
                shear: memberForcesMap[dc.memberId]?.shear || 0,
                utilization: Math.max(...dc.checks.map((c: { ratio: number; status: string }) => c.ratio)),
                status: dc.checks.every((c: { ratio: number; status: string }) => c.status === 'PASS') ? 'PASS' as const : 'FAIL' as const
            }));

            report = this.reports.generateReport(memberSummaries, [], {
                projectName: model.projectName || 'Untitled Project',
                projectNumber: 'PRJ-001',
                client: 'Client Name',
                engineer: 'Engineer Name',
                date: new Date(),
                designCode: options.designCode === 'IS800' ? 'IS' : options.designCode === 'AISC360' ? 'ASCE' : 'EC',
                includeCalculations: true,
                includeLoadCombinations: true
            });
        }

        return { analysis, designChecks, report };
    }
}

// Singleton instance
export const beamlab = new BeamLabServices();
export default beamlab;
