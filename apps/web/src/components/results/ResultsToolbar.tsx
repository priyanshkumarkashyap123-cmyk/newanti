/**
 * ResultsToolbar - Post-Analysis Results Controls
 * 
 * Floating toolbar after analysis:
 * - Toggle buttons for Deflected Shape, BMD, SFD, Reactions
 * - Scale slider for diagram visualization
 * - Animation controls for deflected shape
 * - Quick access to Advanced Analysis and Design
 * - Heat map visualization for stress/displacement
 * - Full Results Dashboard with enhanced visualizations
 */

import React, { FC, useState, useEffect, useMemo } from 'react';
import {
    TrendingDown,
    BarChart2,
    Activity,
    ArrowDownToLine,
    Play,
    Pause,
    RotateCcw,
    SlidersHorizontal,
    X,
    Maximize2,
    Minimize2,
    Zap,
    FileCheck,
    Flame,
    LayoutDashboard,
    Download,
    FileText,
    FileSpreadsheet,
    Loader,
    Eye
} from 'lucide-react';
import { useModelStore, type AnalysisResults } from '../../store/model';
import { useUIStore } from '../../store/uiStore';
import { AnalysisResultsDashboard, type AnalysisResultsData } from './AnalysisResultsDashboard';
import { MemberDetailPanel, type MemberForceData } from './MemberDetailPanel';
import { CheckpointLegalModal } from '../CheckpointLegalModal';
import consentService from '../../services/ConsentService';

// ============================================
// TYPES
// ============================================

interface ResultsToolbarProps {
    onClose?: () => void;
}

type DiagramType = 'deflection' | 'bmd' | 'sfd' | 'reactions' | 'axial' | 'heatmap';

// ============================================
// HELPER: Convert store results to dashboard format
// ============================================

/**
 * Helper: compute actual member length from node coordinates
 */
const getMemberLength = (
    member: { startNodeId: string; endNodeId: string },
    modelNodes: Map<string, { x: number; y: number; z?: number }>
): number => {
    const n1 = modelNodes.get(member.startNodeId);
    const n2 = modelNodes.get(member.endNodeId);
    if (!n1 || !n2) return 5; // fallback
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = (n2.z ?? 0) - (n1.z ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
};

/**
 * Helper: compute real stress and utilization from actual section properties.
 * sigma_bending = M * c / I, sigma_axial = N / A
 * Combined: sigma = sigma_axial + sigma_bending (conservative)
 */
const computeRealStress = (
    moment: number,
    axial: number,
    member: { A?: number; I?: number; Iy?: number; dimensions?: any; sectionType?: string; E?: number }
): { stress: number; utilization: number } => {
    // Get actual section properties
    const A = member.A ?? 0.01;           // m² (default ~100 cm²)
    const I = member.I ?? member.Iy ?? 1e-4; // m⁴

    // Estimate c (distance to extreme fiber) from section dimensions or from I and A
    let c = 0.15; // fallback
    const dims = member.dimensions;
    if (dims) {
        if (dims.height) c = dims.height / 2;
        else if (dims.totalHeight) c = dims.totalHeight / 2;
        else if (dims.rectHeight) c = dims.rectHeight / 2;
        else if (dims.diameter) c = dims.diameter / 2;
        else if (dims.channelHeight) c = dims.channelHeight / 2;
    }
    // If no dimensions but we have I and A, estimate c from Zx ≈ I/c, A = b*d → c ≈ √(12*I/A)/2
    if (c === 0.15 && I > 0 && A > 0) {
        c = Math.sqrt(12 * I / A) / 2;
    }

    // Compute stresses (kN & m → MPa = kN/m² / 1000)
    const sigmaBending = I > 0 ? Math.abs(moment) * c / I / 1000 : 0; // MPa
    const sigmaAxial = A > 0 ? Math.abs(axial) / A / 1000 : 0;        // MPa
    const stress = sigmaBending + sigmaAxial; // Conservative linear combination

    // Yield stress: default Fe250 for steel, Fe415 for rebar
    const fy = 250; // MPa — could be enhanced with material lookup
    const utilization = Math.min(stress / fy, 2.0);

    return { stress, utilization };
};

const convertToAnalysisResultsData = (
    results: AnalysisResults,
    modelNodes?: Map<string, any>,
    modelMembers?: Map<string, any>
): AnalysisResultsData => {
    const nodes: AnalysisResultsData['nodes'] = [];
    const members: AnalysisResultsData['members'] = [];

    let maxDisp = 0;
    let maxStress = 0;
    let maxUtil = 0;

    // Convert node displacements and reactions
    if (results.displacements) {
        results.displacements.forEach((disp, nodeId) => {
            const reaction = results.reactions?.get(nodeId);
            const totalDisp = Math.sqrt(disp.dx ** 2 + disp.dy ** 2 + disp.dz ** 2);
            maxDisp = Math.max(maxDisp, totalDisp);

            nodes.push({
                id: nodeId,
                x: 0,
                y: 0,
                z: 0,
                displacement: {
                    dx: disp.dx,
                    dy: disp.dy,
                    dz: disp.dz,
                    rx: disp.rx,
                    ry: disp.ry,
                    rz: disp.rz
                },
                reaction: reaction ? {
                    fx: reaction.fx,
                    fy: reaction.fy,
                    fz: reaction.fz,
                    mx: reaction.mx,
                    my: reaction.my,
                    mz: reaction.mz
                } : undefined
            });
        });
    }

    // Convert member forces - use actual diagram data from PyNite analysis
    if (results.memberForces) {
        results.memberForces.forEach((forces, memberId) => {
            // Forces are already in kN/kNm from PyNite (no need to divide by 1000)
            const shear = Math.max(Math.abs(forces.shearY), Math.abs(forces.shearZ));
            const moment = Math.max(Math.abs(forces.momentY), Math.abs(forces.momentZ));
            const axial = Math.abs(forces.axial);

            // Get actual member model data for real properties
            const memberModel = modelMembers?.get(memberId);

            // Use actual PyNite diagram data if available, otherwise generate default
            const pyniteDiagram = forces.diagramData;
            let x_values: number[];
            let shear_values: number[];
            let moment_values: number[];
            let axial_values: number[];
            let deflection_values: number[];
            let memberLength: number;

            // Compute actual member length from model nodes
            if (memberModel && modelNodes) {
                memberLength = getMemberLength(memberModel, modelNodes);
            } else {
                memberLength = 5; // fallback only if no geometry
            }

            if (pyniteDiagram && pyniteDiagram.x_values && pyniteDiagram.x_values.length > 0) {
                // Use actual PyNite data
                x_values = pyniteDiagram.x_values;
                shear_values = pyniteDiagram.shear_y;
                moment_values = pyniteDiagram.moment_z;
                axial_values = pyniteDiagram.axial || [];
                deflection_values = pyniteDiagram.deflection_y || [];
                memberLength = x_values[x_values.length - 1] || 5;
            } else {
                // Fallback: Generate uniform data points
                const numPoints = 20;
                memberLength = 5; // Default length

                x_values = [];
                shear_values = [];
                moment_values = [];
                axial_values = [];
                deflection_values = [];

                for (let i = 0; i <= numPoints; i++) {
                    const x = (i / numPoints) * memberLength;
                    x_values.push(x);
                    shear_values.push(forces.shearY);
                    moment_values.push(forces.momentZ);
                    axial_values.push(forces.axial);
                    deflection_values.push(0);
                }
            }

            // Compute real stress from actual section properties
            const { stress: estimatedStress, utilization: util } = computeRealStress(
                moment, axial, memberModel || {}
            );

            maxStress = Math.max(maxStress, Math.abs(estimatedStress));
            maxUtil = Math.max(maxUtil, util);

            members.push({
                id: memberId,
                startNodeId: memberModel?.startNodeId ?? '',
                endNodeId: memberModel?.endNodeId ?? '',
                length: memberLength,
                sectionType: memberModel?.sectionType ?? 'General',
                maxShear: shear,
                minShear: -shear,
                maxMoment: moment,
                minMoment: -moment,
                maxAxial: axial,
                minAxial: -axial,
                maxDeflection: Math.abs(maxDisp * 1000), // Convert to mm
                maxShearZ: Math.abs(forces.shearZ ?? 0),
                maxMomentY: Math.abs(forces.momentY ?? 0),
                torsion: Math.abs(forces.torsion ?? 0),
                sectionProps: {
                    A: memberModel?.A ?? 0.01,
                    I: memberModel?.I ?? memberModel?.Iz ?? 1e-4,
                    Iy: memberModel?.Iy ?? 1e-4,
                    E: memberModel?.E ?? 200000000,  // kN/m² (200 GPa)
                    fy: 250,  // MPa — steel default
                },
                stress: Math.abs(estimatedStress),
                utilization: util,
                diagramData: {
                    x_values,
                    shear_values,
                    moment_values,
                    axial_values,
                    deflection_values
                }
            });
        });
    }

    return {
        nodes,
        members,
        summary: {
            totalNodes: nodes.length,
            totalMembers: members.length,
            totalDOF: nodes.length * 6,
            maxDisplacement: maxDisp,
            maxStress,
            maxUtilization: maxUtil,
            analysisTime: results.stats?.totalTimeMs ?? results.stats?.solveTimeMs ?? 0,
            status: maxUtil > 1 ? 'error' : maxUtil > 0.9 ? 'warning' : 'success'
        }
    };
};

// ============================================
// COMPONENT
// ============================================

export const ResultsToolbar: FC<ResultsToolbarProps> = ({ onClose }) => {
    const analysisResults = useModelStore((s) => s.analysisResults) as AnalysisResults | null;
    const displacementScale = useModelStore((s) => s.displacementScale) as number;
    const showSFD = useModelStore((s) => s.showSFD);
    const showBMD = useModelStore((s) => s.showBMD);
    const showAFD = useModelStore((s) => s.showAFD);
    const showStressOverlay = useModelStore((s) => s.showStressOverlay);
    const setShowSFD = useModelStore((s) => s.setShowSFD);
    const setShowBMD = useModelStore((s) => s.setShowBMD);
    const setShowAFD = useModelStore((s) => s.setShowAFD);
    const setShowStressOverlay = useModelStore((s) => s.setShowStressOverlay);
    const setShowDeflectedShape = useModelStore((s) => s.setShowDeflectedShape);
    const setDisplacementScale = useModelStore((s) => s.setDisplacementScale);
    const openModal = useUIStore((s) => s.openModal);
    const showNotification = useUIStore((s) => s.showNotification);
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);

    // Local state
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);
    const [activeDiagram, setActiveDiagram] = useState<DiagramType | null>('deflection');
    const [scale, setScale] = useState(displacementScale ?? 50);
    const [heatmapType, setHeatmapType] = useState<'displacement' | 'stress' | 'utilization'>('displacement');
    const [showDashboard, setShowDashboard] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showMemberDetail, setShowMemberDetail] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    // Store doesn't have these - we'll use local state
    const [_showReactions, _setShowReactions] = useState(true);

    // Get member IDs for navigation
    const memberIds = useMemo(() => {
        if (!analysisResults?.memberForces) return [];
        return Array.from(analysisResults.memberForces.keys());
    }, [analysisResults?.memberForces]);

    // Get selected member forces
    const selectedMemberForces = useMemo((): MemberForceData | null => {
        if (!selectedMemberId || !analysisResults?.memberForces) return null;
        const forces = analysisResults.memberForces.get(selectedMemberId);
        if (!forces) return null;
        return {
            axial: forces.axial,
            shearY: forces.shearY,
            shearZ: forces.shearZ ?? 0,
            momentY: forces.momentY ?? 0,
            momentZ: forces.momentZ,
            torsion: forces.torsion ?? 0,
            diagramData: forces.diagramData,
        };
    }, [selectedMemberId, analysisResults?.memberForces]);

    // Handle member navigation
    const handleMemberNavigate = (direction: 'prev' | 'next') => {
        if (!selectedMemberId || memberIds.length === 0) return;
        const currentIndex = memberIds.indexOf(selectedMemberId);
        if (currentIndex === -1) return;
        
        const newIndex = direction === 'next' 
            ? (currentIndex + 1) % memberIds.length
            : (currentIndex - 1 + memberIds.length) % memberIds.length;
        setSelectedMemberId(memberIds[newIndex]);
    };

    // Open member detail panel
    const handleOpenMemberDetail = (memberId?: string) => {
        const id = memberId || (memberIds.length > 0 ? memberIds[0] : null);
        if (id) {
            setSelectedMemberId(id);
            setShowMemberDetail(true);
        }
    };

    // Initialize diagram state on mount - ensure deflection is shown by default
    useEffect(() => {
        // Sync initial activeDiagram state with store
        setShowDeflectedShape(activeDiagram === 'deflection');
        setShowSFD(activeDiagram === 'sfd');
        setShowBMD(activeDiagram === 'bmd');
        setShowAFD(activeDiagram === 'axial');
        setShowStressOverlay(activeDiagram === 'heatmap');
    }, []); // Run once on mount

    // Sync diagram toggles with store
    const handleDiagramToggle = (type: DiagramType) => {
        const newActive = activeDiagram === type ? null : type;
        setActiveDiagram(newActive);

        // Update store based on diagram type
        setShowSFD(newActive === 'sfd');
        setShowBMD(newActive === 'bmd');
        setShowAFD(newActive === 'axial');
        setShowStressOverlay(newActive === 'heatmap');
        setShowDeflectedShape(newActive === 'deflection');
    };

    // Handle PDF export
    const [showPDFConsentModal, setShowPDFConsentModal] = useState(false);

    const handleExportPDF = async () => {
        // Check if user has accepted PDF export terms
        const userId = `user-${Date.now()}`; // In real app, use actual user ID
        if (!consentService.hasUserAccepted(userId, 'pdf_export')) {
            setShowPDFConsentModal(true);
            return;
        }

        // Proceed with PDF export
        executePDFExport();
    };

    const executePDFExport = async () => {
        setIsExporting(true);
        try {
            const ReportGeneratorModule = await import('../../services/ReportGenerator');
            const ReportGenerator = ReportGeneratorModule.default;
            const report = new ReportGenerator();

            // Add header and project info
            report.addHeader('Structural Analysis Report');
            report.addProjectInfo({
                projectName: 'BeamLab Ultimate Analysis',
                description: 'Structural analysis results generated by BeamLab Ultimate'
            });

            // Add nodes table
            const nodeList = Array.from(nodes.values()).map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z
            }));
            if (nodeList.length > 0) {
                report.addNodesTable(nodeList);
            }

            // Add members table (basic)
            const memberList = Array.from(members.values()).map(m => ({
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                sectionId: m.sectionId || 'Default'
            }));
            if (memberList.length > 0) {
                report.addMembersTable(memberList);
            }

            // Add cross-sectional details with properties
            const memberDetails = Array.from(members.values()).map(m => {
                // Calculate member length
                const startNode = nodes.get(m.startNodeId);
                const endNode = nodes.get(m.endNodeId);
                let length = 0;
                if (startNode && endNode) {
                    length = Math.sqrt(
                        Math.pow(endNode.x - startNode.x, 2) +
                        Math.pow(endNode.y - startNode.y, 2) +
                        Math.pow(endNode.z - startNode.z, 2)
                    );
                }
                return {
                    id: m.id,
                    sectionId: m.sectionId || 'Default',
                    E: m.E || 200000000,  // Default steel E in kN/m²
                    A: m.A,
                    Iy: m.I,  // Use I as Iy
                    Iz: m.I,
                    J: m.I,   // Approximate J as I for simple cases
                    length
                };
            });
            if (memberDetails.length > 0) {
                report.addCrossSectionalDetails(memberDetails);
            }

            // Add analysis results if available
            if (analysisResults) {
                // Prepare loads for FBD (from applied loads if available)
                const appliedLoads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }> = [];
                // Try to get loads from the store if available
                // For now, we'll use empty loads array - loads should be passed from store

                // Prepare supports info
                const supportsInfo: Array<{ nodeId: string; type: 'fixed' | 'pinned' | 'roller' }> = [];
                if (analysisResults.reactions) {
                    for (const [nodeId, r] of analysisResults.reactions.entries()) {
                        // Determine support type based on reaction components
                        const hasRotation = Math.abs(r.mx ?? 0) > 0.001 || Math.abs(r.my ?? 0) > 0.001 || Math.abs(r.mz ?? 0) > 0.001;
                        const hasHorizontal = Math.abs(r.fx) > 0.001;
                        
                        if (hasRotation && hasHorizontal) {
                            supportsInfo.push({ nodeId, type: 'fixed' });
                        } else if (hasHorizontal) {
                            supportsInfo.push({ nodeId, type: 'pinned' });
                        } else {
                            supportsInfo.push({ nodeId, type: 'roller' });
                        }
                    }
                }

                // Reactions for FBD
                const reactionsForFBD = analysisResults.reactions 
                    ? Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => ({
                        nodeId,
                        fx: r.fx,
                        fy: r.fy,
                        fz: r.fz ?? 0,
                        mx: r.mx ?? 0,
                        my: r.my ?? 0,
                        mz: r.mz ?? 0
                    }))
                    : [];

                // Add Free Body Diagram
                if (nodeList.length > 0 && memberList.length > 0) {
                    try {
                        report.addFreeBodyDiagram(
                            nodeList,
                            memberList,
                            appliedLoads,
                            reactionsForFBD,
                            supportsInfo
                        );
                    } catch (error) {
                        console.warn('Failed to add FBD to PDF:', error);
                    }
                }

                // Add detailed reactions with equilibrium check
                if (analysisResults.reactions && analysisResults.reactions.size > 0) {
                    const reactions = Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => ({
                        nodeId,
                        fx: r.fx,
                        fy: r.fy,
                        fz: r.fz ?? 0,
                        mx: r.mx ?? 0,
                        my: r.my ?? 0,
                        mz: r.mz ?? 0
                    }));
                    report.addDetailedReactionsTable(reactions, appliedLoads);
                }

                // Member forces
                if (analysisResults.memberForces && analysisResults.memberForces.size > 0) {
                    report.addPage('Member Forces');
                    const forces = Array.from(analysisResults.memberForces.entries()).map(([memberId, f]) => ({
                        memberId,
                        axial: f.axial,
                        shearY: f.shearY,
                        shearZ: f.shearZ ?? 0,
                        momentY: f.momentY ?? 0,
                        momentZ: f.momentZ,
                        torsion: f.torsion ?? 0
                    }));
                    report.addMemberForcesTable(forces);
                }

                // Add combined structure diagrams (SFD, BMD, AFD for whole structure)
                if (nodeList.length > 0 && memberList.length > 0) {
                    try {
                        const membersWithDiagrams = Array.from(members.values()).map(m => {
                            const forceData = analysisResults?.memberForces?.get(m.id);
                            return {
                                id: m.id,
                                startNodeId: m.startNodeId,
                                endNodeId: m.endNodeId,
                                diagramData: forceData?.diagramData ? {
                                    x_values: forceData.diagramData.x_values || [],
                                    shear_values: forceData.diagramData.shear_y || [],
                                    moment_values: forceData.diagramData.moment_z || [],
                                    axial_values: forceData.diagramData.axial || []
                                } : undefined
                            };
                        });

                        // Add combined diagrams for entire structure
                        report.addCombinedStructureDiagram(nodeList, membersWithDiagrams, 'SFD');
                        report.addCombinedStructureDiagram(nodeList, membersWithDiagrams, 'BMD');
                        report.addCombinedStructureDiagram(nodeList, membersWithDiagrams, 'AFD');
                    } catch (error) {
                        console.warn('Failed to add combined diagrams to PDF:', error);
                    }
                }

                // Add detailed individual member diagrams with calculations
                const dashboardData = convertToAnalysisResultsData(analysisResults, nodes, members);
                if (dashboardData.members.length > 0) {
                    try {
                        // Prepare detailed member data
                        const detailedMembers = Array.from(members.values()).map(m => {
                            const startNode = nodes.get(m.startNodeId);
                            const endNode = nodes.get(m.endNodeId);
                            let length = 0;
                            if (startNode && endNode) {
                                length = Math.sqrt(
                                    Math.pow(endNode.x - startNode.x, 2) +
                                    Math.pow(endNode.y - startNode.y, 2) +
                                    Math.pow(endNode.z - startNode.z, 2)
                                );
                            }

                            const forceData = analysisResults?.memberForces?.get(m.id);
                            return {
                                id: m.id,
                                startNodeId: m.startNodeId,
                                endNodeId: m.endNodeId,
                                length,
                                sectionId: m.sectionId || 'Default',
                                E: m.E || 200000000,
                                I: m.I,
                                A: m.A,
                                maxShear: forceData?.shearY,
                                maxMoment: forceData?.momentZ,
                                maxAxial: forceData?.axial,
                                diagramData: forceData?.diagramData ? {
                                    x_values: forceData.diagramData.x_values || [],
                                    shear_values: forceData.diagramData.shear_y || [],
                                    moment_values: forceData.diagramData.moment_z || [],
                                    axial_values: forceData.diagramData.axial || [],
                                    deflection_values: forceData.diagramData.deflection_y || []
                                } : undefined
                            };
                        });

                        report.addDetailedMemberDiagrams(detailedMembers);
                    } catch (error) {
                        console.warn('Failed to add detailed member diagrams to PDF:', error);
                    }
                }
            }

            report.save('BeamLab_Analysis_Report');
            showNotification('success', 'PDF Report generated successfully');
        } catch (error) {
            console.error('PDF export failed:', error);
            showNotification('error', 'Failed to generate PDF report');
        } finally {
            setIsExporting(false);
        }
    };

    // Handle CSV export
    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const { ExportService } = await import('../../services/ExportService');

            const exportData = {
                projectName: 'BeamLab_Analysis',
                timestamp: new Date().toISOString(),
                nodes: Array.from(nodes.values()).map(n => ({
                    id: n.id,
                    x: n.x,
                    y: n.y,
                    z: n.z
                })),
                members: Array.from(members.values()).map(m => ({
                    id: m.id,
                    startNodeId: m.startNodeId,
                    endNodeId: m.endNodeId,
                    sectionId: m.sectionId || 'Default'
                })),
                displacements: analysisResults?.displacements ?
                    Array.from(analysisResults.displacements.entries()).map(([nodeId, d]) => ({
                        nodeId,
                        dx: d.dx,
                        dy: d.dy,
                        dz: d.dz,
                        rx: d.rx,
                        ry: d.ry,
                        rz: d.rz
                    })) : [],
                reactions: analysisResults?.reactions ?
                    Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => ({
                        nodeId,
                        fx: r.fx,
                        fy: r.fy,
                        fz: r.fz,
                        mx: r.mx,
                        my: r.my,
                        mz: r.mz
                    })) : [],
                memberForces: analysisResults?.memberForces ?
                    Array.from(analysisResults.memberForces.entries()).map(([memberId, f]) => ({
                        memberId,
                        axial: f.axial,
                        shearY: f.shearY,
                        shearZ: f.shearZ,
                        momentY: f.momentY,
                        momentZ: f.momentZ,
                        torsion: f.torsion
                    })) : []
            };

            const service = new ExportService(exportData as any);
            const blob = service.exportToCSV('all');

            // Trigger download
            showNotification('success', 'CSV exported successfully');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BeamLab_Analysis_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('CSV export failed:', error);
            showNotification('error', 'Failed to export CSV');
        } finally {
            setIsExporting(false);
        }
    };

    if (!analysisResults) return null;

    const diagrams: { id: DiagramType; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'deflection', label: 'Deflected', icon: TrendingDown, color: 'text-blue-500' },
        { id: 'bmd', label: 'BMD', icon: BarChart2, color: 'text-green-500' },
        { id: 'sfd', label: 'SFD', icon: Activity, color: 'text-orange-500' },
        { id: 'reactions', label: 'Reactions', icon: ArrowDownToLine, color: 'text-purple-500' },
        { id: 'axial', label: 'Axial', icon: SlidersHorizontal, color: 'text-red-500' },
        { id: 'heatmap', label: 'Heat Map', icon: Flame, color: 'text-yellow-500' }
    ];

    const handleScaleChange = (newScale: number) => {
        setScale(newScale);
        setDisplacementScale(newScale);
    };

    const toggleAnimation = () => {
        setIsAnimating(!isAnimating);
    };

    const resetView = () => {
        setScale(50);
        setActiveDiagram('deflection');
        setIsAnimating(false);
    };

    // Calculate max values safely
    const getMaxDisplacement = (): string => {
        if (!analysisResults.displacements || analysisResults.displacements.size === 0) return '-';
        const values = Array.from(analysisResults.displacements.values());
        const max = Math.max(...values.map(d => Math.abs(d.dy)));
        return `${max.toFixed(4)} m`;
    };

    const getMaxReaction = (): string => {
        if (!analysisResults.reactions || analysisResults.reactions.size === 0) return '-';
        const values = Array.from(analysisResults.reactions.values());
        const max = Math.max(...values.map(r => Math.abs(r.fy)));
        if (max < 0.001) return '-';
        return `${max.toFixed(2)} kN`;
    };

    // Get support reactions (only nodes with non-negligible reactions)
    const getSupportReactions = (): { nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[] => {
        if (!analysisResults.reactions || analysisResults.reactions.size === 0) return [];
        const supports: { nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[] = [];
        analysisResults.reactions.forEach((r, nodeId) => {
            const total = Math.abs(r.fx) + Math.abs(r.fy) + Math.abs(r.fz) + Math.abs(r.mx) + Math.abs(r.my) + Math.abs(r.mz);
            if (total > 0.001) {
                supports.push({ nodeId, fx: r.fx, fy: r.fy, fz: r.fz, mx: r.mx, my: r.my, mz: r.mz });
            }
        });
        return supports;
    };

    const supportReactions = getSupportReactions();

    if (!isExpanded) {
        return (
            <>
                <div className="fixed bottom-4 right-4 z-40">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
                    >
                        <BarChart2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Results</span>
                        <Maximize2 className="w-3 h-3" />
                    </button>
                </div>
                {/* Full Results Dashboard Modal - accessible even when collapsed */}
                {showDashboard && analysisResults && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                        <div className="w-[95vw] h-[90vh] max-w-[1800px] bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                            <AnalysisResultsDashboard
                                results={convertToAnalysisResultsData(analysisResults, nodes, members)}
                                onClose={() => setShowDashboard(false)}
                            />
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <div className="fixed bottom-4 right-4 z-40 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" />
                        <span className="font-medium">Analysis Results</span>
                        <span className="text-[9px] bg-white/20 rounded px-1.5 py-0.5 font-mono">v3.0</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="p-1 rounded hover:bg-white/20 transition-colors"
                            title="Minimize"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 rounded hover:bg-white/20 transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Diagram Toggles */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        Diagrams
                    </h4>
                    <div className="grid grid-cols-6 gap-1">
                        {diagrams.map((diagram) => {
                            const Icon = diagram.icon;
                            const isActive = activeDiagram === diagram.id;

                            return (
                                <button
                                    key={diagram.id}
                                    onClick={() => handleDiagramToggle(diagram.id)}
                                    className={`
                                    flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                                    ${isActive
                                            ? 'bg-zinc-100 dark:bg-zinc-800'
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                        }
                                `}
                                    title={diagram.label}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? diagram.color : 'text-zinc-400'}`} />
                                    <span className={`text-[9px] ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                                        {diagram.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Heat Map Type Selector - Show when heatmap is active */}
                    {activeDiagram === 'heatmap' && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                            <h5 className="text-[10px] font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase">
                                Heat Map Type
                            </h5>
                            <div className="flex gap-1">
                                {[
                                    { id: 'displacement', label: 'Displacement', gradient: 'from-blue-500 to-red-500' },
                                    { id: 'stress', label: 'Stress', gradient: 'from-green-500 to-red-500' },
                                    { id: 'utilization', label: 'Utilization', gradient: 'from-green-500 via-yellow-500 to-red-500' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setHeatmapType(type.id as any)}
                                        className={`
                                        flex-1 px-2 py-1.5 text-[10px] font-medium rounded transition-all
                                        ${heatmapType === type.id
                                                ? 'bg-gradient-to-r ' + type.gradient + ' text-white shadow-md'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                            }
                                    `}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                            {/* Color Scale Legend */}
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[9px] text-zinc-400">Low</span>
                                <div className={`flex-1 h-2 rounded bg-gradient-to-r ${heatmapType === 'displacement' ? 'from-blue-500 to-red-500' :
                                    heatmapType === 'stress' ? 'from-green-500 to-red-500' :
                                        'from-green-500 via-yellow-500 to-red-500'
                                    }`} />
                                <span className="text-[9px] text-zinc-400">High</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Scale Slider */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
                            Scale
                        </h4>
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {scale}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="200"
                        value={scale}
                        onChange={(e) => handleScaleChange(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                        <span>1x</span>
                        <span>100x</span>
                        <span>200x</span>
                    </div>
                </div>

                {/* Animation Controls */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        Animation
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleAnimation}
                            className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1
                            ${isAnimating
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                }
                        `}
                        >
                            {isAnimating ? (
                                <>
                                    <Pause className="w-4 h-4" />
                                    <span className="text-sm font-medium">Stop</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    <span className="text-sm font-medium">Animate</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={resetView}
                            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="Reset View"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        Max Values
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="text-[10px] text-blue-600 dark:text-blue-400">Max Displacement</div>
                            <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                {getMaxDisplacement()}
                            </div>
                        </div>
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-[10px] text-purple-600 dark:text-purple-400">Max Reaction</div>
                            <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
                                {getMaxReaction()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Reactions Table — NEW: Visible computed reactions */}
                {activeDiagram === 'reactions' && supportReactions.length > 0 && (
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto">
                        <h4 className="text-xs font-medium text-purple-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                            <ArrowDownToLine className="w-3 h-3" />
                            Support Reactions ({supportReactions.length} supports)
                        </h4>
                        <div className="space-y-1.5">
                            {supportReactions.map((sr) => (
                                <div key={sr.nodeId} className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <div className="text-[10px] font-medium text-purple-600 dark:text-purple-300 mb-1">Node {sr.nodeId}</div>
                                    <div className="grid grid-cols-3 gap-1 text-[9px]">
                                        {Math.abs(sr.fx) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">Fx: <span className="font-mono text-white">{sr.fx.toFixed(2)}</span></div>
                                        )}
                                        {Math.abs(sr.fy) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">Fy: <span className="font-mono text-white">{sr.fy.toFixed(2)}</span></div>
                                        )}
                                        {Math.abs(sr.fz) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">Fz: <span className="font-mono text-white">{sr.fz.toFixed(2)}</span></div>
                                        )}
                                        {Math.abs(sr.mx) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">Mx: <span className="font-mono text-white">{sr.mx.toFixed(2)}</span></div>
                                        )}
                                        {Math.abs(sr.my) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">My: <span className="font-mono text-white">{sr.my.toFixed(2)}</span></div>
                                        )}
                                        {Math.abs(sr.mz) > 0.001 && (
                                            <div className="text-zinc-500 dark:text-zinc-400">Mz: <span className="font-mono text-white">{sr.mz.toFixed(2)}</span></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Advanced Tools - Quick Access */}
                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        Export Results
                    </h4>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg text-sm font-medium"
                        >
                            {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            <span>Export PDF Report</span>
                        </button>
                        <button
                            onClick={handleExportCSV}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-all text-sm font-medium"
                        >
                            {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            <span>Export CSV Data</span>
                        </button>
                    </div>
                </div>

                {/* Advanced Tools - Quick Access */}
                <div className="px-4 py-3">
                    <h4 className="text-xs font-medium text-zinc-400 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        Next Steps
                    </h4>
                    <div className="flex flex-col gap-2">
                        {/* Member Force Diagrams Button */}
                        <button
                            onClick={() => handleOpenMemberDetail()}
                            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg text-sm"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="font-medium">Member Force Diagrams</span>
                        </button>
                        {/* Full Dashboard Button - Premium feature */}
                        <button
                            onClick={() => setShowDashboard(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg text-sm"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="font-medium">Full Results Dashboard</span>
                        </button>
                        <button
                            onClick={() => openModal('advancedAnalysis')}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors text-sm"
                        >
                            <Zap className="w-4 h-4" />
                            <span className="font-medium">Advanced Analysis</span>
                        </button>
                        <button
                            onClick={() => openModal('designCodes')}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors text-sm"
                        >
                            <FileCheck className="w-4 h-4" />
                            <span className="font-medium">Design Code Check</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Full Results Dashboard Modal */}
            {showDashboard && analysisResults && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-[95vw] h-[90vh] max-w-[1800px] bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                        <AnalysisResultsDashboard
                            results={convertToAnalysisResultsData(analysisResults, nodes, members)}
                            onClose={() => setShowDashboard(false)}
                            onExport={(format) => {
                                if (format === 'pdf') {
                                    handleExportPDF();
                                } else if (format === 'json') {
                                    // Direct JSON export with full analysis results
                                    const data = convertToAnalysisResultsData(analysisResults, nodes, members);
                                    const jsonStr = JSON.stringify(data, null, 2);
                                    const blob = new Blob([jsonStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `BeamLab_Results_${new Date().toISOString().split('T')[0]}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                } else {
                                    handleExportCSV();
                                }
                                setShowDashboard(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* PDF Export Legal Consent Modal */}
            {showPDFConsentModal && (
                <CheckpointLegalModal
                    open={showPDFConsentModal}
                    checkpointType="pdf_export"
                    onAccept={() => {
                        setShowPDFConsentModal(false);
                        const userId = `user-${Date.now()}`;
                        consentService.recordConsent(userId, 'pdf_export');
                        executePDFExport();
                    }}
                    onDecline={() => {
                        setShowPDFConsentModal(false);
                    }}
                    canClose={true}
                />
            )}

            {/* Member Detail Panel Modal */}
            {showMemberDetail && selectedMemberId && selectedMemberForces && (() => {
                const memberModel = members.get(selectedMemberId);
                const actualLength = memberModel ? getMemberLength(memberModel, nodes) : 5;
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-[90vw] h-[85vh] max-w-[900px] bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                        <MemberDetailPanel
                            memberId={selectedMemberId}
                            memberForces={selectedMemberForces}
                            memberLength={actualLength}
                            sectionId={memberModel?.sectionId || 'Default'}
                            material="steel"
                            sectionProps={memberModel ? {
                                A: memberModel.A,
                                I: memberModel.I,
                                Iy: (memberModel as any).Iy,
                                width: memberModel.dimensions?.width ?? memberModel.dimensions?.rectWidth,
                                depth: memberModel.dimensions?.height ?? memberModel.dimensions?.rectHeight,
                                tf: memberModel.dimensions?.flangeThickness,
                                tw: memberModel.dimensions?.webThickness,
                                fy: (memberModel as any).fy,
                                sectionType: memberModel.sectionType,
                            } : undefined}
                            onClose={() => setShowMemberDetail(false)}
                            onNavigate={handleMemberNavigate}
                        />
                    </div>
                </div>
                );
            })()}
        </>
    );
};

export default ResultsToolbar;