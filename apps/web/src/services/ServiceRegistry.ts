/**
 * ServiceRegistry.ts - Central Service Registry
 * 
 * CEO-level integration point for all services.
 * Provides unified access to all platform capabilities.
 */

// Allow CommonJS require() for lazy service loading
// eslint-disable-next-line @typescript-eslint/no-require-imports
declare const require: (id: string) => Record<string, unknown>;

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

import { errorHandler } from './ErrorHandlingService';

/**
 * Unified service interface for CEO-level access
 * Services are lazily loaded on first access to avoid loading everything at startup
 */
export class BeamLabServices {
    // Core — only error handler loaded eagerly
    readonly errors = errorHandler;

    // Lazy service accessors — require() returns dynamic modules, any is unavoidable
    /* eslint-disable @typescript-eslint/no-explicit-any */
    private _solver: any = null;
    private _db: any = null;
    private _ai: any = null;
    private _validation: any = null;
    private _codes: any = null;
    private _connections: any = null;
    private _loadCombos: any = null;
    private _voice: any = null;
    private _voiceCommands: any = null;
    private _reports: any = null;
    private _ifc: any = null;
    private _dxf: any = null;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    get solver() { if (!this._solver) { this._solver = require('./wasmSolverService').wasmSolver; } return this._solver; }
    get db() { if (!this._db) { this._db = require('./DatabaseService').database; } return this._db; }
    get ai() { if (!this._ai) { this._ai = require('./GeminiAIService').geminiAI; } return this._ai; }
    get validation() { if (!this._validation) { this._validation = require('./AIValidationService').aiValidation; } return this._validation; }
    get codes() { if (!this._codes) { this._codes = require('./CodeComplianceEngine').codeCompliance; } return this._codes; }
    get connections() { if (!this._connections) { this._connections = require('./ConnectionDesignService').connectionDesign; } return this._connections; }
    get loadCombos() { if (!this._loadCombos) { this._loadCombos = require('./loads/LoadCombinationsService').loadCombinations; } return this._loadCombos; }
    get voice() { if (!this._voice) { this._voice = require('./voice/VoiceInputService').voiceInput; } return this._voice; }
    get voiceCommands() { if (!this._voiceCommands) { this._voiceCommands = require('./voice/VoiceCommandExecutor').voiceExecutor; } return this._voiceCommands; }
    get reports() { if (!this._reports) { this._reports = require('./reports/PEReadyReportGenerator').peReport; } return this._reports; }
    get ifc() { if (!this._ifc) { this._ifc = { generate: require('./IFCExportService').generateIFC }; } return this._ifc; }
    get dxf() { if (!this._dxf) { this._dxf = require('./EnhancedDXFExportService').enhancedDXF; } return this._dxf; }

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
        analysis: Record<string, unknown>;
        designChecks: Array<{ memberId: string; checks: Array<{ ratio: number; status: string }> }>;
        report?: string;
    }> {
        // 1. Run analysis
        const nodes = Array.isArray(model.nodes) ? model.nodes : Array.from((model.nodes as Map<string, unknown>)?.values?.() || []);
        const members = Array.isArray(model.members) ? model.members : Array.from((model.members as Map<string, unknown>)?.values?.() || []);
        const pointLoads = model.pointLoads || model.loads || [];
        const memberLoads = model.memberLoads || [];
        const analysis = await this.solver.analyze(nodes, members, pointLoads, memberLoads);
        const analysisResult = analysis as Record<string, unknown>;
        const memberForcesMap = (analysisResult.memberForces || analysisResult.member_forces || {}) as Record<string, Record<string, number>>;

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
