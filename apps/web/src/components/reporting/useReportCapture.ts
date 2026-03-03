/**
 * useReportCapture - Hook for capturing 3D views and charts for PDF reports
 * Integrates with ReportGenerator to create comprehensive analysis reports
 */

import { useCallback, useRef } from 'react';
// html2canvas is dynamically imported on first use to keep it out of the main bundle (~204 KB)
import { ReportGenerator, type ProjectData, type NodeDisplacementRow, type MemberForceRow, type ReactionRow } from '../../services/ReportGenerator';
import { useModelStore } from '../../store/model';
import { logger } from '../../lib/logging/logger';

// ============================================
// TYPES
// ============================================

export interface ReportCaptureResult {
    success: boolean;
    error?: string;
}

export interface CapturedImage {
    id: string;
    dataUrl: string;
    caption?: string;
}

// ============================================
// HOOK: useReportCapture
// ============================================

export function useReportCapture() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    /**
     * Capture 3D view from Three.js canvas
     * Must render a frame before capturing to ensure buffer isn't empty
     */
    const capture3DView = useCallback(async (): Promise<string | null> => {
        try {
            // Find the Three.js canvas element
            const canvas = document.querySelector('canvas') as HTMLCanvasElement;

            if (!canvas) {
                logger.error('No canvas element found');
                return null;
            }

            // Get WebGL context
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

            if (!gl) {
                logger.error('Could not get WebGL context');
                return null;
            }

            // Force a render to ensure buffer isn't empty
            // This is crucial for proper capture
            gl.flush();
            gl.finish();

            // Small delay to ensure the frame is complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Capture the canvas as data URL
            const dataUrl = canvas.toDataURL('image/png', 1.0);

            return dataUrl;
        } catch (error) {
            logger.error('Error capturing 3D view', { error });
            return null;
        }
    }, []);

    /**
     * Capture specific HTML elements (charts, diagrams) using html2canvas
     */
    const captureCharts = useCallback(async (chartIds: string[]): Promise<CapturedImage[]> => {
        const images: CapturedImage[] = [];

        for (const id of chartIds) {
            try {
                const element = document.getElementById(id);

                if (!element) {
                    logger.warn('Chart element not found', { id });
                    continue;
                }

                const { default: html2canvas } = await import('html2canvas');
                const canvas = await html2canvas(element, {
                    backgroundColor: '#1a1a24', // Dark background
                    scale: 2, // Higher resolution
                    logging: false,
                    useCORS: true,
                });

                const dataUrl = canvas.toDataURL('image/png', 1.0);

                images.push({
                    id,
                    dataUrl,
                    caption: element.getAttribute('data-caption') || `Chart: ${id}`,
                });
            } catch (error) {
                logger.error('Error capturing chart', { id, error });
            }
        }

        return images;
    }, []);

    /**
     * Capture a specific DOM element by selector
     */
    const captureElement = useCallback(async (selector: string, _caption?: string): Promise<string | null> => {
        try {
            const element = document.querySelector(selector) as HTMLElement;

            if (!element) {
                logger.warn('Element not found', { selector });
                return null;
            }

            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(element, {
                backgroundColor: '#1a1a24',
                scale: 2,
                logging: false,
                useCORS: true,
            });

            return canvas.toDataURL('image/png', 1.0);
        } catch (error) {
            logger.error('Error capturing element', { selector, error });
            return null;
        }
    }, []);

    /**
     * Collect model data from the store
     */
    const collectModelData = useCallback(() => {
        const state = useModelStore.getState();
        const { nodes, members, loads, analysisResults } = state;

        // Convert Maps to arrays for reporting
        const nodesArray = Array.from(nodes.values());
        const membersArray = Array.from(members.values());

        // Prepare displacement data
        const displacements: NodeDisplacementRow[] = [];
        if (analysisResults) {
            Array.from(analysisResults.displacements.entries()).forEach(([nodeId, disp]) => {
                displacements.push({
                    nodeId,
                    dx: disp.dx,
                    dy: disp.dy,
                    dz: disp.dz,
                    rx: disp.rx,
                    ry: disp.ry,
                    rz: disp.rz,
                });
            });
        }

        // Prepare member forces data
        const memberForces: MemberForceRow[] = [];
        if (analysisResults) {
            Array.from(analysisResults.memberForces.entries()).forEach(([memberId, forces]) => {
                memberForces.push({
                    memberId,
                    axial: forces.axial,
                    shearY: forces.shearY,
                    shearZ: forces.shearZ,
                    momentY: forces.momentY,
                    momentZ: forces.momentZ,
                    torsion: forces.torsion,
                });
            });
        }

        // Prepare reactions data
        const reactions: ReactionRow[] = [];
        if (analysisResults) {
            Array.from(analysisResults.reactions.entries()).forEach(([nodeId, rxn]) => {
                reactions.push({
                    nodeId,
                    fx: rxn.fx,
                    fy: rxn.fy,
                    fz: rxn.fz,
                    mx: rxn.mx,
                    my: rxn.my,
                    mz: rxn.mz,
                });
            });
        }

        return {
            nodes: nodesArray,
            members: membersArray,
            loads,
            displacements,
            memberForces,
            reactions,
            hasResults: !!analysisResults,
        };
    }, []);

    /**
     * Generate full PDF report
     */
    const generateFullReport = useCallback(async (projectData?: Partial<ProjectData>): Promise<ReportCaptureResult> => {
        try {
            logger.info('Starting report generation');

            // 1. Create report generator
            const report = new ReportGenerator();

            // 2. Add header and project info
            report.addHeader('Structural Analysis Report');
            report.addProjectInfo({
                projectName: projectData?.projectName || 'BeamLab Analysis',
                clientName: projectData?.clientName || 'N/A',
                engineerName: projectData?.engineerName || 'N/A',
                projectNumber: projectData?.projectNumber || 'N/A',
                description: projectData?.description || 'Structural analysis performed with BeamLab',
            });

            // 3. Capture 3D view
            logger.info('Capturing 3D view');
            const view3D = await capture3DView();
            if (view3D) {
                report.add3DSnapshot(view3D, 'Figure 1: 3D Structural Model');
            }

            // 4. Collect model data
            logger.info('Collecting model data');
            const modelData = collectModelData();

            // 5. Add model summary
            report.addPage('Model Summary');
            report.addHeader('Model Summary');
            report.addParagraph(
                `The structural model consists of ${modelData.nodes.length} nodes and ${modelData.members.length} members. ` +
                `${modelData.loads.length} point loads have been applied to the structure.`
            );

            // 6. Add results tables (if analysis has been run)
            if (modelData.hasResults) {
                // Displacements
                if (modelData.displacements.length > 0) {
                    report.addPage('Displacement Results');
                    report.addHeader('Displacement Results');
                    report.addNodeDisplacementsTable(modelData.displacements);
                }

                // Member forces
                if (modelData.memberForces.length > 0) {
                    report.addPage('Member Forces');
                    report.addHeader('Member Forces');
                    report.addMemberForcesTable(modelData.memberForces);
                }

                // Reactions
                if (modelData.reactions.length > 0) {
                    report.addPage('Support Reactions');
                    report.addHeader('Support Reactions');
                    report.addReactionsTable(modelData.reactions);
                }

                // 7. Try to capture diagram charts if they exist
                logger.info('Capturing diagrams');
                const diagramIds = ['sfd-chart', 'bmd-chart', 'deflection-chart'];
                const charts = await captureCharts(diagramIds);

                if (charts.length > 0) {
                    report.addPage('Diagrams');
                    report.addHeader('Analysis Diagrams');
                    for (const chart of charts) {
                        report.add3DSnapshot(chart.dataUrl, chart.caption);
                    }
                }
            } else {
                report.addParagraph(
                    'Note: No analysis results available. Please run the analysis to include displacement, force, and reaction data in the report.'
                );
            }

            // 8. Save the report
            logger.info('Saving report');
            const filename = projectData?.projectName?.replace(/\s+/g, '_') || 'BeamLab_Analysis';
            report.save(filename);

            logger.info('Report generated successfully');
            return { success: true };

        } catch (error) {
            logger.error('Error generating report', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }, [capture3DView, captureCharts, collectModelData]);

    /**
     * Quick capture - just the 3D view (for thumbnails)
     */
    const quickCapture = useCallback(async (): Promise<string | null> => {
        return capture3DView();
    }, [capture3DView]);

    return {
        capture3DView,
        captureCharts,
        captureElement,
        collectModelData,
        generateFullReport,
        quickCapture,
        canvasRef,
    };
}

export default useReportCapture;
