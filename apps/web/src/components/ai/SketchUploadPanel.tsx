/**
 * SketchUploadPanel.tsx
 * 
 * UI component for uploading sketches and converting to structural models
 */

import React, { useState, useRef, useCallback } from 'react';
import { sketchRecognition, SketchRecognitionResult } from '../../services/vision/SketchRecognitionService';
import { feedbackService } from '../../services/FeedbackService';

interface SketchUploadPanelProps {
    onModelGenerated?: (model: {
        nodes: Array<{ id: string; x: number; y: number; z: number }>;
        members: Array<{ id: string; startNodeId: string; endNodeId: string }>;
        supports: Array<{ nodeId: string; type: string }>;
        loads: Array<{ nodeId: string; fy: number }>;
    }) => void;
}

export const SketchUploadPanel: React.FC<SketchUploadPanelProps> = ({
    onModelGenerated
}) => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
    const [result, setResult] = useState<SketchRecognitionResult | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            setPreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);

        setStatus('processing');

        try {
            const recognition = await sketchRecognition.recognizeSketch(file, {
                useAI: true,
                minConfidence: 0.6
            });

            setResult(recognition);
            setStatus(recognition.success ? 'complete' : 'error');

            if (recognition.success) {
                const model = sketchRecognition.toBeamLabModel(recognition, 10);
                onModelGenerated?.(model);
            }

        } catch (error) {
            console.error('Recognition failed:', error);
            setStatus('error');
        }
    }, [onModelGenerated]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const input = fileInputRef.current;
            if (input) {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }, []);

    return (
        <div className="bg-[#0b1326] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-[#131b2e] border-b border-slate-700 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                <h3 className="font-semibold text-[#dae2fd]">Sketch to Model</h3>
            </div>

            <div className="p-4">
                {status === 'idle' && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
                    >
                        <svg className="w-12 h-12 mx-auto mb-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        <p className="text-[#869ab8] mb-2">Drop a sketch image or click to upload</p>
                        <p className="text-slate-500 text-sm">PNG, JPG, or photo of hand-drawn sketch</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                )}

                {status === 'processing' && (
                    <div className="text-center py-8">
                        {preview && (
                            <img src={preview} alt="Preview" className="max-h-40 mx-auto mb-4 rounded-lg opacity-50" />
                        )}
                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-[#869ab8]">Analyzing sketch with AI...</p>
                        <p className="text-violet-400 text-sm mt-2">Detecting nodes, members, supports, and loads</p>
                    </div>
                )}

                {status === 'complete' && result && (
                    <div>
                        {preview && (
                            <img src={preview} alt="Recognized" className="max-h-48 mx-auto mb-4 rounded-lg" />
                        )}

                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-[#131b2e] rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-[#dae2fd]">{result.nodes.length}</div>
                                <div className="text-[#869ab8] text-sm">Nodes</div>
                            </div>
                            <div className="bg-[#131b2e] rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-[#dae2fd]">{result.members.length}</div>
                                <div className="text-[#869ab8] text-sm">Members</div>
                            </div>
                            <div className="bg-[#131b2e] rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-[#dae2fd]">{result.nodes.filter(n => n.isSupport).length}</div>
                                <div className="text-[#869ab8] text-sm">Supports</div>
                            </div>
                            <div className="bg-[#131b2e] rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-[#dae2fd]">{result.loads.length}</div>
                                <div className="text-[#869ab8] text-sm">Loads</div>
                            </div>
                        </div>

                        <div className="bg-[#131b2e] rounded-lg p-3 mb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[#869ab8]">Detected Structure</span>
                                <span className="text-[#dae2fd] font-medium tracking-wide capitalize">{result.structureType}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[#869ab8]">Confidence</span>
                                <span className={`font-medium tracking-wide ${result.confidence > 0.8 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {(result.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        {result.warnings.length > 0 && (
                            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mb-4">
                                {result.warnings.map((w, i) => (
                                    <div key={i} className="text-yellow-400 text-sm">{w}</div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button type="button"
                                onClick={() => {
                                    if (result) {
                                        const model = sketchRecognition.toBeamLabModel(result, 10);
                                        onModelGenerated?.(model);
                                    }
                                }}
                                className="flex-1 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 font-medium tracking-wide"
                            >
                                Create Model
                            </button>
                            <button type="button"
                                onClick={() => {
                                    setStatus('idle');
                                    setResult(null);
                                    setPreview(null);
                                }}
                                className="flex-1 py-2 bg-slate-700 text-[#dae2fd] rounded-lg hover:bg-slate-600 font-medium tracking-wide"
                            >
                                Upload Another
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-8">
                        {preview && (
                            <img src={preview} alt="Failed" className="max-h-40 mx-auto mb-4 rounded-lg opacity-50" />
                        )}
                        <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p className="text-red-400 mb-2">Could not recognize structural elements</p>
                        <p className="text-slate-500 text-sm mb-4">Try a clearer sketch or draw elements more distinctly</p>
                        <button type="button"
                            onClick={() => {
                                setStatus('idle');
                                setPreview(null);
                                feedbackService.logError('model_generation', 'sketch_upload', 'Recognition failed');
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SketchUploadPanel;
