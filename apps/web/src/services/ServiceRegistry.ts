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
import { geminiAI } from './GeminiAIService';
import { aiValidation } from './AIValidationService';
import { codeCompliance } from './CodeComplianceEngine';
import { connectionDesign } from './ConnectionDesignService';
import { loadCombinations } from './loads/LoadCombinationsService';
import { voiceInput } from './voice/VoiceInputService';
import { voiceExecutor } from './voice/VoiceCommandExecutor';
import { errorHandler } from './ErrorHandlingService';
import { peReport } from './reports/PEReadyReportGenerator';
import { generateIFC } from './IFCExportService';
import { enhancedDXF } from './EnhancedDXFExportService';

/**
 * Unified service interface for CEO-level access
 */
export class BeamLabServices {
    // Core
    readonly solver = wasmSolver;
    readonly db = database;
    readonly errors = errorHandler;

    // AI
    readonly ai = geminiAI;
    readonly validation = aiValidation;

    // Design
    readonly codes = codeCompliance;
    readonly connections = connectionDesign;
    readonly loadCombos = loadCombinations;

    // Voice
    readonly voice = voiceInput;
    readonly voiceCommands = voiceExecutor;

    // Export
    readonly reports = peReport;
    readonly ifc = { generate: generateIFC };
    readonly dxf = enhancedDXF;

    /**
     * Initialize all services
     */
    async initialize(): Promise<void> {
        console.log('[BeamLab] Initializing services...');

        // Initialize database if available
        if (typeof (database as any).initialize === 'function') {
            await (database as any).initialize();
        }

        // Initialize WASM solver
        await wasmSolver.initialize?.();

        console.log('[BeamLab] All services initialized');
    }

    /**
     * Run complete structural workflow
     */
    async runStructuralWorkflow(model: any, options: {
        designCode: 'IS800' | 'AISC360' | 'EC3';
        includeConnections?: boolean;
        generateReport?: boolean;
    }): Promise<{
        analysis: any;
        designChecks: any[];
        report?: string;
    }> {
        // 1. Run analysis
        const nodes = Array.isArray(model.nodes) ? model.nodes : Array.from(model.nodes?.values?.() || []);
        const members = Array.isArray(model.members) ? model.members : Array.from(model.members?.values?.() || []);
        const pointLoads = model.pointLoads || model.loads || [];
        const memberLoads = model.memberLoads || [];
        const analysis = await this.solver.analyze(nodes, members, pointLoads, memberLoads);
        const analysisResult = analysis as any;
        const memberForcesMap = analysisResult.memberForces || analysisResult.member_forces || {};

        // 2. Run design checks
        const designChecks = [];
        for (const member of model.members) {
            const forces = memberForcesMap[member.id] || {
                axial: 0,
                momentZ: 0,
                momentY: 0,
                shearY: 0,
                shearZ: 0
            };
            const result = this.codes.checkSteelMember(
                {
                    section: member.section,
                    material: member.material,
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
                utilization: Math.max(...dc.checks.map((c: any) => c.ratio)),
                status: dc.checks.every((c: any) => c.status === 'PASS') ? 'PASS' as const : 'FAIL' as const
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
