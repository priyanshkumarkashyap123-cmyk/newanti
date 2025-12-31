import { FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ExportToolbar } from './export/ExportToolbar';
import { useModelStore } from '../store/model';
import { ExportData } from '../services/ExportService';
import { useUIStore } from '../store/uiStore';

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
                            <span className="text-zinc-500">
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
                                <h3 className="text-sm font-medium text-white">Select Format</h3>
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
        </Dialog>
    );
};
