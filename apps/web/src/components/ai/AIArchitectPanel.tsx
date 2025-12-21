/**
 * AIArchitectPanel.tsx - AI-Powered Structure Generation
 * 
 * Allows users to describe a structure in natural language
 * and generates it using the Python AI backend.
 */

import { FC, useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { useModelStore } from '../../store/model';

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || "http://localhost:8080";

// ============================================
// TYPES
// ============================================

interface GenerateResponse {
    success: boolean;
    model?: {
        nodes: Array<{
            id: string;
            x: number;
            y: number;
            z: number;
            support?: string;
        }>;
        members: Array<{
            id: string;
            start_node: string;
            end_node: string;
            section_profile: string;
        }>;
        metadata?: Record<string, string>;
    };
    error?: string;
    details?: string;
    hint?: string;
}

// ============================================
// EXAMPLE PROMPTS
// ============================================

const EXAMPLE_PROMPTS = [
    "Create a 12m span bridge truss with 6 panels",
    "Design a 3-story building frame, 5m bays",
    "Generate a 20m warehouse portal frame",
    "Make a simple beam, 8m span with fixed supports"
];

// ============================================
// MAIN COMPONENT
// ============================================

export const AIArchitectPanel: FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Store actions
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);

    // ========================================
    // GENERATE HANDLER
    // ========================================
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) {
            setError('Please enter a description');
            return;
        }

        // Clear previous states
        setError(null);
        setSuccess(null);
        setIsGenerating(true);

        console.log("[AIArchitect] Sending prompt:", prompt);

        try {
            const response = await fetch(`${PYTHON_API}/generate/ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            console.log("[AIArchitect] Response status:", response.status);

            const data: GenerateResponse = await response.json();
            console.log("[AIArchitect] Response data:", data);

            if (!data.success) {
                // Handle backend error with details
                const errorMsg = data.error || 'Generation failed';
                const details = data.details ? ` - ${data.details}` : '';
                const hint = data.hint ? ` (${data.hint})` : '';
                throw new Error(`${errorMsg}${details}${hint}`);
            }

            if (!data.model) {
                throw new Error('No model data returned');
            }

            // Success! Populate the model
            clearModel();

            // Add nodes
            for (const node of data.model.nodes) {
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z || 0
                });
            }

            // Add members
            for (const member of data.model.members) {
                addMember({
                    id: member.id,
                    startNodeId: member.start_node,
                    endNodeId: member.end_node,
                    sectionId: member.section_profile || 'ISMB300'
                });
            }

            const modelName = data.model.metadata?.['name'] || 'AI Generated';
            setSuccess(`✓ Generated "${modelName}" (${data.model.nodes.length} nodes, ${data.model.members.length} members)`);
            setPrompt('');

        } catch (err) {
            console.error("[AIArchitect] Error:", err);

            // Check for network/connection errors
            if (err instanceof TypeError && err.message.includes('fetch')) {
                setError('Cannot connect to Python Server. Is it running on port 8080?');
            } else {
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            }
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, clearModel, addNode, addMember]);

    // ========================================
    // HANDLE EXAMPLE CLICK
    // ========================================
    const handleExampleClick = (example: string) => {
        setPrompt(example);
        setError(null);
        setSuccess(null);
    };

    return (
        <div className="h-full flex flex-col bg-zinc-900">
            {/* Header */}
            <div className="px-3 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">AI Architect</h3>
                        <p className="text-[10px] text-zinc-500">Text-to-Structure</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {/* Prompt Input */}
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                        Describe your structure
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Create a 15m span Pratt truss..."
                        disabled={isGenerating}
                        className="
                            w-full h-24 px-3 py-2
                            bg-zinc-800 border border-zinc-700 rounded-lg
                            text-sm text-zinc-200 placeholder-zinc-600
                            focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500
                            resize-none
                            disabled:opacity-50 disabled:cursor-not-allowed
                        "
                    />
                </div>

                {/* Example Prompts */}
                <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">
                        Try an example
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {EXAMPLE_PROMPTS.slice(0, 3).map((example, i) => (
                            <button
                                key={i}
                                onClick={() => handleExampleClick(example)}
                                disabled={isGenerating}
                                className="
                                    px-2 py-1 text-[10px]
                                    bg-zinc-800/50 border border-zinc-700
                                    text-zinc-400 rounded
                                    hover:bg-zinc-700/50 hover:text-white
                                    transition-colors
                                    disabled:opacity-50
                                "
                            >
                                {example.slice(0, 25)}...
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className={`
                        w-full flex items-center justify-center gap-2
                        py-3 rounded-lg font-medium text-sm
                        transition-all duration-200
                        ${isGenerating
                            ? 'bg-purple-600/20 text-purple-300 cursor-wait'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/20'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                    `}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Architect is thinking...
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4" />
                            Generate Structure
                        </>
                    )}
                </button>

                {/* Error Message */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400">{error}</p>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-green-400">{success}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-600 text-center">
                    Powered by AI · Mock mode for testing
                </p>
            </div>
        </div>
    );
};

export default AIArchitectPanel;
