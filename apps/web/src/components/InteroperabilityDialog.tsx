/**
 * InteroperabilityDialog.tsx - Import/Export Interface
 * 
 * Features:
 * - DXF Import (LINES → Members)
 * - IFC/JSON Export
 * - Preview of imported structure
 */

import { FC, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Upload, Download, FileText, FileCode,
    Check, AlertCircle, Loader2, Eye, Box
} from 'lucide-react';
import { useModelStore, Node, Member } from '../store/model';
import { DXFImporter, IFCExporter, PhysicalMember, PhysicalMemberSection } from '../modules/modeling/physical_modeler';

// ============================================
// TYPES
// ============================================

type ImportExportMode = 'import' | 'export';
type FileFormat = 'dxf' | 'ifc' | 'json';

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
    const handleExport = () => {
        setIsProcessing(true);
        setError(null);

        try {
            let content: string;
            let filename: string;
            let mimeType: string;

            if (format === 'ifc') {
                // Convert members to physical members for IFC export
                const physicalMembers: PhysicalMember[] = [];
                members.forEach((member, id) => {
                    const startNode = nodes.get(member.startNodeId);
                    const endNode = nodes.get(member.endNodeId);
                    if (startNode && endNode) {
                        const section: PhysicalMemberSection = {
                            id: member.sectionId,
                            name: member.sectionId,
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                                <FileCode className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Import / Export</h2>
                                <p className="text-sm text-zinc-400">DXF, IFC, JSON formats</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setMode('import')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${mode === 'import'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Upload className="w-4 h-4" />
                                Import
                            </button>
                            <button
                                onClick={() => setMode('export')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${mode === 'export'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>

                        {/* Format Selection */}
                        <div className="mb-6">
                            <label className="text-sm text-zinc-400 block mb-2">Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                {mode === 'import' ? (
                                    <>
                                        <button
                                            onClick={() => setFormat('dxf')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'dxf'
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : 'border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <FileText className="w-5 h-5 text-zinc-400" />
                                            <span className="text-xs">DXF</span>
                                        </button>
                                        <button
                                            onClick={() => setFormat('json')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'json'
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : 'border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <FileCode className="w-5 h-5 text-zinc-400" />
                                            <span className="text-xs">JSON</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setFormat('ifc')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'ifc'
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : 'border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <Box className="w-5 h-5 text-zinc-400" />
                                            <span className="text-xs">IFC JSON</span>
                                        </button>
                                        <button
                                            onClick={() => setFormat('json')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${format === 'json'
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : 'border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <FileCode className="w-5 h-5 text-zinc-400" />
                                            <span className="text-xs">JSON</span>
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
                                    className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                                    <p className="text-zinc-400">
                                        Click to select a <span className="text-white font-medium">.{format}</span> file
                                    </p>
                                    <p className="text-sm text-zinc-500 mt-1">or drag and drop</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={format === 'dxf' ? '.dxf' : '.json'}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                {/* Preview */}
                                {importedNodes.length > 0 && (
                                    <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Eye className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm text-white font-medium">Preview</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-zinc-400">Nodes:</span>
                                                <span className="text-white ml-2">{importedNodes.length}</span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-400">Members:</span>
                                                <span className="text-white ml-2">{importedMembers.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Export Section */}
                        {mode === 'export' && (
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Box className="w-4 h-4 text-emerald-400" />
                                    <span className="text-sm text-white font-medium">Current Model</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-zinc-400">Nodes:</span>
                                        <span className="text-white ml-2">{nodes.size}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-400">Members:</span>
                                        <span className="text-white ml-2">{members.size}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Messages */}
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm text-red-300">{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-300">{success}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </button>

                        {mode === 'import' && importedNodes.length > 0 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleMerge}
                                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
                                >
                                    Merge
                                </button>
                                <button
                                    onClick={handleReplace}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
                                >
                                    {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Replace
                                </button>
                            </div>
                        )}

                        {mode === 'export' && (
                            <button
                                onClick={handleExport}
                                disabled={members.size === 0}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
                            >
                                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default InteroperabilityDialog;
