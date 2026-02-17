import { FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ExportToolbar } from './export/ExportToolbar';
import { useModelStore } from '../store/model';
import { ExportData } from '../services/ExportService';
import { useUIStore } from '../store/uiStore';
import { ReportingService } from '../services/ReportingService';
import { SteelDesignResults } from '../services/SteelDesignService';
import { FileText, TableProperties } from 'lucide-react';

/**
 * ExportDialog - Modal for exporting analysis results
 */
export const ExportDialog: FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
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
                maxStress: 0, // TODO: Calculate stress
                utilization: 0
            };
        }),
        // Map reactions
        reactions: Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => ({
            nodeId,
            fx: r.fx, fy: r.fy, fz: r.fz,
            mx: r.mx, my: r.my, mz: r.mz
        })),
        designChecks: [] // TODO: Add if available
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
                        <div className="text-center p-8 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                            <span className="text-zinc-400">
                                No analysis results available. Run visualization first.
                            </span>
                        </div>
                    ) : exportData ? (
                        <div className="space-y-6">
                            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                                <h3 className="text-sm font-medium text-white mb-2">Project Summary</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm text-zinc-400">
                                    <div>Nodes: {nodes.size}</div>
                                    <div>Members: {members.size}</div>
                                    <div>Results: Ready</div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h3 className="text-sm font-medium text-white">Generate Reports</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => {
                                            if (projectInfo && nodes && members) {
                                                ReportingService.generateCalculationBook(
                                                    projectInfo, 
                                                    nodes, 
                                                    members, 
                                                    analysisResults, 
                                                    new Map() // TODO: Pass actual design results if available from store
                                                );
                                            }
                                        }}
                                        className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
                                    >
                                        <div className="p-3 bg-blue-500/10 rounded-full">
                                            <FileText className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium text-sm text-zinc-200">Calculation Book</div>
                                            <div className="text-xs text-zinc-400">PDF Report</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (projectInfo && nodes && members) {
                                                const bom = ReportingService.generateBOM(Array.from(members.values()), nodes);
                                                // Create a mini report just for BOM or CSV
                                                // For now, let's trigger the full BOM report via the service method we can add, 
                                                // or just reuse the main one. Let's start with basic BOM CSV download for this specific button.
                                                
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
                                            }
                                        }}
                                        className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
                                    >
                                        <div className="p-3 bg-emerald-500/10 rounded-full">
                                            <TableProperties className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium text-sm text-zinc-200">Bill of Materials</div>
                                            <div className="text-xs text-zinc-400">CSV Export</div>
                                        </div>
                                    </button>
                                </div>

                                <h3 className="text-sm font-medium text-white mt-2">Export Data</h3>
                                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 flex justify-center">
                                    <ExportToolbar
                                        exportData={exportData}
                                        onExportComplete={() => {
                                            // Optional: close dialog or show toast
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
