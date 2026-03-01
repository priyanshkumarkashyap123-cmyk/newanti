/**
 * InteroperabilityDialog.tsx - Import/Export Interface
 * 
 * Features:
 * - DXF Import (LINES → Members)
 * - IFC/JSON Export
 * - Preview of imported structure
 */

import React from 'react';
import { FC, useState, useRef } from 'react';
import {
    Upload, Download, FileText, FileCode,
    Check, AlertCircle, Loader2, Eye, Box
} from 'lucide-react';
import { useModelStore, Node, Member } from '../store/model';
import { DXFImporter, IFCExporter, PhysicalMember, PhysicalMemberSection } from '../modules/modeling/physical_modeler';
import { importSTAAD, exportSTAAD, downloadSTAAD } from '../api/interop';
import type { StructuralModel } from '../api/interop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';

// ============================================
// TYPES
// ============================================

type ImportExportMode = 'import' | 'export';
type FileFormat = 'dxf' | 'staad' | 'ifc' | 'json';

interface InteroperabilityDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const InteroperabilityDialog: FC<InteroperabilityDialogProps> = ({ isOpen, onClose }) => {
    // Store
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const addNodes = useModelStore((s) => s.addNodes);
    const addMembers = useModelStore((s) => s.addMembers);
    const loadStructure = useModelStore((s) => s.loadStructure);

    // State
    const [mode, setMode] = useState<ImportExportMode>('import');
    const [format, setFormat] = useState<FileFormat>('dxf');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Import state
    const [importedNodes, setImportedNodes] = useState<Node[]>([]);
    const [importedMembers, setImportedMembers] = useState<Member[]>([]);
    const [dxfContent, setDxfContent] = useState<string>('');

    // File input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);
        setIsProcessing(true);

        try {
            const content = await file.text();
            setDxfContent(content);

            if (format === 'dxf') {
                const entities = DXFImporter.parse(content);
                const { nodes, members } = DXFImporter.toStructuralModel(entities);

                setImportedNodes(nodes);
                setImportedMembers(members);
                setSuccess(`Found ${nodes.length} nodes and ${members.length} members`);
            } else if (format === 'staad') {
                // Send to backend for STAAD.Pro parsing
                const result = await importSTAAD(content);
                if (result.success && result.model) {
                    const parsedNodes: Node[] = result.model.nodes.map(n => ({
                        id: n.id || `N${n.x}`,
                        x: n.x,
                        y: n.y,
                        z: n.z,
                    }));
                    const parsedMembers: Member[] = result.model.members.map((m: any) => ({
                        id: m.id || `M${m.startNode}`,
                        startNodeId: m.startNode || m.start_node,
                        endNodeId: m.endNode || m.end_node,
                        section: { type: 'RECTANGLE' as const, dimensions: { width: 0.2, height: 0.3 } },
                    }));
                    setImportedNodes(parsedNodes);
                    setImportedMembers(parsedMembers);
                    const { stats } = result;
                    setSuccess(`STAAD import: ${stats.nodesCount} nodes, ${stats.membersCount} members, ${stats.loadCasesCount} load cases`);
                    if (result.warnings?.length) {
                        setError(`Warnings: ${result.warnings.join('; ')}`);
                    }
                } else {
                    throw new Error(result.errors?.join(', ') || 'STAAD import failed');
                }
            } else if (format === 'json') {
                const data = JSON.parse(content);
                if (data.nodes && data.members) {
                    setImportedNodes(data.nodes);
                    setImportedMembers(data.members);
                    setSuccess(`Loaded ${data.nodes.length} nodes and ${data.members.length} members`);
                } else {
                    throw new Error('Invalid JSON format');
                }
            }
        } catch (err) {
            setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Merge imported structure into model
    const handleMerge = () => {
        if (importedNodes.length === 0 && importedMembers.length === 0) {
            setError('No data to import');
            return;
        }

        addNodes(importedNodes);
        addMembers(importedMembers);
        setSuccess(`Merged ${importedNodes.length} nodes and ${importedMembers.length} members`);

        // Clear import data
        setImportedNodes([]);
        setImportedMembers([]);
        setDxfContent('');
    };

    // Replace model with imported structure
    const handleReplace = () => {
        if (importedNodes.length === 0) {
            setError('No data to import');
            return;
        }

        loadStructure(importedNodes, importedMembers);
        setSuccess(`Loaded ${importedNodes.length} nodes and ${importedMembers.length} members`);

        // Clear import data
        setImportedNodes([]);
        setImportedMembers([]);
        setDxfContent('');
        onClose();
    };

    // Handle export
    const handleExport = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            let content: string;
            let filename: string;
            let mimeType: string;

            if (format === 'staad') {
                // Export via backend API
                const model: StructuralModel = {
                    nodes: Array.from(nodes.values()).map(n => ({
                        id: n.id, x: n.x, y: n.y, z: n.z,
                    })),
                    members: Array.from(members.values()).map(m => ({
                        id: m.id, startNodeId: m.startNodeId, endNodeId: m.endNodeId,
                    })),
                    supports: [],
                };
                content = await exportSTAAD(model);
                filename = 'beamlab_export.std';
                mimeType = 'text/plain';
            } else if (format === 'ifc') {
                // Convert members to physical members for IFC export
                const physicalMembers: PhysicalMember[] = [];
                members.forEach((member, id) => {
                    const startNode = nodes.get(member.startNodeId);
                    const endNode = nodes.get(member.endNodeId);
                    if (startNode && endNode) {
                        const section: PhysicalMemberSection = {
                            id: member.sectionId || 'Default',
                            name: member.sectionId || 'Default',
                            width: 0.2,
                            height: 0.3,
                            area: member.A || 0.01,
                            Ix: member.I || 1e-4,
                            Iy: member.I || 1e-4,
                            material: 'Steel'
                        };

                        physicalMembers.push({
                            id: member.id,
                            name: member.id,
                            startPoint: { x: startNode.x, y: startNode.y, z: startNode.z },
                            endPoint: { x: endNode.x, y: endNode.y, z: endNode.z },
                            section,
                            analyticalMemberIds: [member.id],
                            analyticalNodeIds: []
                        });
                    }
                });

                const ifcModel = IFCExporter.exportToIFC(physicalMembers, 'BeamLab Export');
                content = IFCExporter.toJSON(ifcModel);
                filename = 'beamlab_export.ifc.json';
                mimeType = 'application/json';
            } else {
                // JSON export
                const exportData = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    nodes: Array.from(nodes.values()),
                    members: Array.from(members.values())
                };
                content = JSON.stringify(exportData, null, 2);
                filename = 'beamlab_export.json';
                mimeType = 'application/json';
            }

            // Trigger download
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setSuccess(`Exported ${members.size} members to ${filename}`);
        } catch (err) {
            setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                            <FileCode className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle>Import / Export</DialogTitle>
                            <DialogDescription>DXF, STAAD, IFC, JSON formats</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex gap-2">
                        <Button
                            variant={mode === 'import' ? 'default' : 'outline'}
                            className={`flex-1 ${mode === 'import' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            onClick={() => setMode('import')}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Import
                        </Button>
                        <Button
                            variant={mode === 'export' ? 'default' : 'outline'}
                            className={`flex-1 ${mode === 'export' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            onClick={() => setMode('export')}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {mode === 'import' ? (
                                <>
                                    <button
                                        onClick={() => setFormat('dxf')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'dxf'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">DXF</span>
                                    </button>
                                    <button
                                        onClick={() => setFormat('staad')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'staad'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <FileCode className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">STAAD .std</span>
                                    </button>
                                    <button
                                        onClick={() => setFormat('json')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'json'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <FileCode className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">JSON</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setFormat('staad')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'staad'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <FileCode className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">STAAD .std</span>
                                    </button>
                                    <button
                                        onClick={() => setFormat('ifc')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'ifc'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <Box className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">IFC JSON</span>
                                    </button>
                                    <button
                                        onClick={() => setFormat('json')}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'json'
                                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <FileCode className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">JSON</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Import Section */}
                    {mode === 'import' && (
                        <>
                            {/* File Drop Zone */}
                            <div
                                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors cursor-pointer bg-slate-50 dark:bg-transparent"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-10 h-10 text-slate-500 dark:text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-600 dark:text-slate-400">
                                    Click to select a <span className="font-medium text-slate-900 dark:text-white">.{format}</span> file
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">or drag and drop</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={format === 'dxf' ? '.dxf' : format === 'staad' ? '.std,.txt' : '.json'}
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {/* Preview */}
                            {importedNodes.length > 0 && (
                                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Eye className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Preview</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Nodes:</span>
                                            <span className="text-slate-900 dark:text-white ml-2">{importedNodes.length}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Members:</span>
                                            <span className="text-slate-900 dark:text-white ml-2">{importedMembers.length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Export Section */}
                    {mode === 'export' && (
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Box className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                <span className="text-sm font-medium text-slate-900 dark:text-white">Current Model</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Nodes:</span>
                                    <span className="text-slate-900 dark:text-white ml-2">{nodes.size}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Members:</span>
                                    <span className="text-slate-900 dark:text-white ml-2">{members.size}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                            <span className="text-sm text-emerald-700 dark:text-emerald-300">{success}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>

                    {mode === 'import' && importedNodes.length > 0 && (
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={handleMerge}>
                                Merge
                            </Button>
                            <Button
                                onClick={handleReplace}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Replace
                            </Button>
                        </div>
                    )}

                    {mode === 'export' && (
                        <Button
                            onClick={handleExport}
                            disabled={members.size === 0}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InteroperabilityDialog;
