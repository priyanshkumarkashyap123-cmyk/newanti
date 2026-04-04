import { FC, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ExportToolbar } from './export/ExportToolbar';
import { useModelStore } from '../store/model';
import { ExportData } from '../services/ExportService';
import { useUIStore } from '../store/uiStore';
import { ReportingService } from '../services/ReportingService';
import { SteelDesignResults } from '../services/SteelDesignService';
import { FileText, TableProperties, Check, Loader2, AlertCircle } from 'lucide-react';
import { TierGate } from './TierGate';

/**
 * ExportDialog - Modal for exporting analysis results
 */
export const ExportDialog: FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    // Export feedback state
    const [exportStatus, setExportStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
    const showExportFeedback = (key: string, status: 'loading' | 'success' | 'error') => {
        setExportStatus(prev => ({ ...prev, [key]: status }));
        if (status === 'success' || status === 'error') {
            setTimeout(() => setExportStatus(prev => ({ ...prev, [key]: 'idle' })), 2500);
        }
    };

    // Get model data for export
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const projectInfo = useModelStore((state) => state.projectInfo);

    // Prepare export data
    const exportData: ExportData | null = analysisResults ? {
        projectName: projectInfo?.name || 'BeamLab Project',
        timestamp: new Date(),
        // Map nodes
        nodes: Array.from(nodes.values()).map(n => {
            const disp = analysisResults.displacements.get(n.id);
            return {
                id: n.id,
                x: n.x, y: n.y, z: n.z,
                dx: disp?.dx || 0,
                dy: disp?.dy || 0,
                dz: disp?.dz || 0,
                rx: disp?.rx || 0,
                ry: disp?.ry || 0,
                rz: disp?.rz || 0
            };
        }),
        // Map members
        members: Array.from(members.values()).map(m => {
            const forces = analysisResults.memberForces.get(m.id);
            return {
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                axialStart: forces?.axial || 0,
                axialEnd: forces?.axial || 0, // Simplified if constant
                shearYStart: forces?.shearY || 0,
                shearYEnd: forces?.shearY || 0,
                shearZStart: forces?.shearZ || 0,
                shearZEnd: forces?.shearZ || 0,
                momentYStart: forces?.momentY || 0,
                momentYEnd: forces?.momentY || 0,
                momentZStart: forces?.momentZ || 0,
                momentZEnd: forces?.momentZ || 0,
                torsionStart: forces?.torsion || 0,
                torsionEnd: forces?.torsion || 0,
                maxStress: 0, // Stress is computed during analysis — zero here as placeholder for export template
                utilization: 0
            };
        }),
        // Map reactions
        reactions: Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => ({
            nodeId,
            fx: r.fx, fy: r.fy, fz: r.fz,
            mx: r.mx, my: r.my, mz: r.mz
        })),
        designChecks: [] // Design checks are populated post-analysis when design module is active
    } : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Export Analysis Results</DialogTitle>
                    <DialogDescription>
                        Download reports, spreadsheets, and structured data.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {!analysisResults ? (
                        <div className="text-center p-8 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-[#1a2333] border-dashed">
                            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                            <p className="text-[#adc6ff] font-medium tracking-wide">No analysis results available</p>
                            <p className="text-sm text-[#869ab8] mt-1">
                                Run structural analysis first to generate exportable results.
                            </p>
                        </div>
                    ) : exportData ? (
                        <div className="space-y-6">
                            <div className="bg-[#0b1326] rounded-lg p-4 border border-[#1a2333]">
                                <h3 className="text-sm font-medium tracking-wide text-[#dae2fd] mb-2">Project Summary</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm text-[#869ab8]">
                                    <div>Nodes: {nodes.size}</div>
                                    <div>Members: {members.size}</div>
                                    <div>Results: Ready</div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h3 className="text-sm font-medium tracking-wide text-[#dae2fd]">Generate Reports</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <TierGate feature="pdfExport">
                                    <button type="button"
                                        onClick={() => {
                                            if (projectInfo && nodes && members) {
                                                showExportFeedback('calcBook', 'loading');
                                                try {
                                                    ReportingService.generateCalculationBook(
                                                        projectInfo, 
                                                        nodes, 
                                                        members, 
                                                        analysisResults, 
                                                        new Map()
                                                    );
                                                    showExportFeedback('calcBook', 'success');
                                                } catch {
                                                    showExportFeedback('calcBook', 'error');
                                                }
                                            }
                                        }}
                                        disabled={exportStatus['calcBook'] === 'loading'}
                                        className="flex flex-col items-center gap-2 p-4 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-[#1a2333] transition-colors disabled:opacity-50"
                                    >
                                        <div className="p-3 bg-blue-500/10 rounded-full">
                                            {exportStatus['calcBook'] === 'loading' ? (
                                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                            ) : exportStatus['calcBook'] === 'success' ? (
                                                <Check className="w-6 h-6 text-green-500" />
                                            ) : (
                                                <FileText className="w-6 h-6 text-blue-500" />
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium tracking-wide text-sm text-slate-700 dark:text-slate-200">
                                                {exportStatus['calcBook'] === 'success' ? 'Downloaded!' : 'Calculation Book'}
                                            </div>
                                            <div className="text-xs text-[#869ab8]">PDF Report</div>
                                        </div>
                                    </button>
                                    </TierGate>

                                    <button type="button"
                                        onClick={() => {
                                            if (projectInfo && nodes && members) {
                                                showExportFeedback('bom', 'loading');
                                                try {
                                                    const bom = ReportingService.generateBOM(Array.from(members.values()), nodes);
                                                    const csvContent = "data:text/csv;charset=utf-8," 
                                                        + "Section,Count,Total Length (m),Unit Wt (kg/m),Total Wt (kg)\n"
                                                        + bom.items.map(e => `${e.section},${e.count},${e.totalLength.toFixed(2)},${e.unitWeight.toFixed(2)},${e.totalWeight.toFixed(2)}`).join("\n")
                                                        + `\nTOTAL,,,${bom.items.length},${bom.totalWeight.toFixed(2)}`;
                                                    const encodedUri = encodeURI(csvContent);
                                                    const link = document.createElement("a");
                                                    link.setAttribute("href", encodedUri);
                                                    link.setAttribute("download", `BOM_${projectInfo.name}.csv`);
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    showExportFeedback('bom', 'success');
                                                } catch {
                                                    showExportFeedback('bom', 'error');
                                                }
                                            }
                                        }}
                                        disabled={exportStatus['bom'] === 'loading'}
                                        className="flex flex-col items-center gap-2 p-4 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-[#1a2333] transition-colors disabled:opacity-50"
                                    >
                                        <div className="p-3 bg-emerald-500/10 rounded-full">
                                            {exportStatus['bom'] === 'loading' ? (
                                                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                                            ) : exportStatus['bom'] === 'success' ? (
                                                <Check className="w-6 h-6 text-green-500" />
                                            ) : (
                                                <TableProperties className="w-6 h-6 text-emerald-500" />
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium tracking-wide text-sm text-slate-700 dark:text-slate-200">
                                                {exportStatus['bom'] === 'success' ? 'Downloaded!' : 'Bill of Materials'}
                                            </div>
                                            <div className="text-xs text-[#869ab8]">CSV Export</div>
                                        </div>
                                    </button>
                                </div>

                                <h3 className="text-sm font-medium tracking-wide text-[#dae2fd] mt-2">Export Data</h3>
                                <div className="p-4 bg-[#0b1326] rounded-lg border border-[#1a2333] flex justify-center">
                                    <ExportToolbar
                                        exportData={exportData}
                                        onExportComplete={() => {
                                            showExportFeedback('toolbar', 'success');
                                        }}
                                        className="w-full justify-center"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
            </div>
        </DialogContent>
        </Dialog >
    );
};
