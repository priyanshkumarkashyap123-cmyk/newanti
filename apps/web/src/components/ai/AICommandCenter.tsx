/**
 * AICommandCenter - Unified AI Model Generation Interface
 * 
 * Features:
 * - Template matching for known structures (fast, no API call)
 * - LLM fallback for custom geometry
 * - Auto-analysis after generation
 */

import { FC, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, Zap, CheckCircle, Lock } from 'lucide-react';
import { TEMPLATE_BANK } from '../../data/templates';
import { logger } from '../../lib/logging/logger';
import { useModelStore } from '../../store/model';
import { useSubscription } from '../../hooks/useSubscription';
import { useConfirm } from '../ui/ConfirmDialog';

// ============================================
// TYPES
// ============================================

interface GeneratedModel {
    nodes: Array<{
        id: string;
        x: number;
        y: number;
        z: number;
        isSupport?: boolean;
    }>;
    members: Array<{
        id: string;
        s?: string;
        e?: string;
        startNode?: string;
        endNode?: string;
        section: string;
    }>;
}

// ============================================
// API HELPER
// ============================================

const api = {
    post: async (endpoint: string, data: object): Promise<GeneratedModel> => {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'API call failed');
        }
        return result.model;
    }
};

// ============================================
// TEMPLATE ALIASES - Better keyword matching
// ============================================

const TEMPLATE_ALIASES: Record<string, string[]> = {
    'WAREHOUSE_SIMPLE': ['warehouse', 'portal', 'shed', 'portal frame', 'industrial'],
    'WAREHOUSE_MULTI_BAY': ['multi bay', 'multi-bay', 'large warehouse'],
    'SIMPLY_SUPPORTED_BEAM': ['beam', 'simple beam', 'ss beam', 'simply supported'],
    'CANTILEVER_BEAM': ['cantilever', 'cantilevered', 'fixed free'],
    'CONTINUOUS_BEAM': ['continuous', 'multi-span', 'continuous beam'],
    'OVERHANGING_BEAM': ['overhang', 'overhanging'],
    'PRATT_TRUSS_12M': ['truss', 'pratt', 'roof truss', 'pratt truss'],
    'HOWE_TRUSS': ['howe', 'howe truss'],
    'WARREN_TRUSS': ['warren', 'warren truss'],
    'FINK_TRUSS': ['fink', 'fink truss', 'roof'],
    'G_PLUS_1_FRAME': ['2-story', 'two story', 'g+1', '2 story', 'residential'],
    'G_PLUS_3_FRAME': ['4-story', 'four story', 'g+3', 'commercial'],
    'G_PLUS_5_FRAME': ['6-story', 'office', 'g+5', 'office tower'],
    'SIMPLE_BRIDGE': ['bridge', 'simple bridge', 'deck'],
    'TRANSMISSION_TOWER': ['tower', 'transmission', 'power tower', 'lattice'],
    'CIRCULAR_TANK_SUPPORT': ['tank', 'water tank', 'circular']
};

/**
 * Find matching template from user prompt
 */
const findMatchingTemplate = (prompt: string): string | null => {
    const lowerPrompt = prompt.toLowerCase();

    // First check aliases (most specific)
    for (const [templateKey, aliases] of Object.entries(TEMPLATE_ALIASES)) {
        for (const alias of aliases) {
            if (lowerPrompt.includes(alias)) {
                return templateKey;
            }
        }
    }

    // Fallback to original key matching
    const matchedKey = Object.keys(TEMPLATE_BANK).find(k =>
        lowerPrompt.includes(k.toLowerCase().replace(/_/g, ' '))
    );

    return matchedKey || null;
};

// ============================================
// TOAST HELPER (simple implementation)
// ============================================

const toast = {
    success: (message: string) => {
// logger.info('✅', message);
        // Could integrate with a toast library here
    },
    error: (message: string) => {
        logger.error('❌', { message });
    }
};

// ============================================
// AI COMMAND CENTER COMPONENT
// ============================================

export const AICommandCenter: FC = () => {
    const confirm = useConfirm();
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'generating' | 'analyzing' | 'done'>('idle');
    const [lastResult, setLastResult] = useState<string | null>(null);

    // Store actions
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const updateNode = useModelStore((state) => state.updateNode);

    // Subscription for feature gating
    const { subscription, canAccess } = useSubscription();

    // Free tier usage tracking (3 per day)
    const FREE_TIER_DAILY_LIMIT = 3;
    const [dailyUsageCount, setDailyUsageCount] = useState(0);

    useEffect(() => {
        // Check and reset daily usage counter
        const today = new Date().toDateString();
        const lastUsageDate = localStorage.getItem('beamlab_ai_usage_date');
        const savedCount = parseInt(localStorage.getItem('beamlab_ai_usage_count') || '0');

        if (lastUsageDate !== today) {
            localStorage.setItem('beamlab_ai_usage_date', today);
            localStorage.setItem('beamlab_ai_usage_count', '0');
            setDailyUsageCount(0);
        } else {
            setDailyUsageCount(savedCount);
        }
    }, []);

    const incrementUsage = () => {
        const newCount = dailyUsageCount + 1;
        setDailyUsageCount(newCount);
        localStorage.setItem('beamlab_ai_usage_count', String(newCount));
    };

    const canUseAI = canAccess('aiAssistant') || dailyUsageCount < FREE_TIER_DAILY_LIMIT;
    const remainingUses = FREE_TIER_DAILY_LIMIT - dailyUsageCount;

    /**
     * Import a model into the store
     */
    const importModel = async (model: GeneratedModel | typeof TEMPLATE_BANK[keyof typeof TEMPLATE_BANK]) => {
        // Clear existing model
        clearModel();

        // Handle template format vs API format
        const nodes = 'nodes' in model ? model.nodes : [];
        const members = 'members' in model ? model.members : [];

        // Add nodes with staggered animation
        for (const node of nodes) {
            addNode({
                id: node.id,
                x: node.x,
                y: node.y,
                z: node.z
            });

            // Set support if at ground level or marked as support
            const isSupport = 'isSupport' in node ? node.isSupport :
                'support' in node ? (node as any).support !== 'NONE' :
                    Math.abs(node.y) < 0.01;

            if (isSupport) {
                updateNode(node.id, {
                    restraints: {
                        fx: true, fy: true, fz: true,
                        mx: false, my: false, mz: false
                    }
                });
            }

            await new Promise(r => setTimeout(r, 50)); // Stagger
        }

        // Add members
        for (const member of members) {
            const startNode = 's' in member ? member.s : member.startNode;
            const endNode = 'e' in member ? member.e : member.endNode;

            addMember({
                id: member.id,
                startNodeId: startNode!,
                endNodeId: endNode!,
                sectionId: member.section || 'ISMB300'
            });

            await new Promise(r => setTimeout(r, 30)); // Stagger
        }

        return { nodeCount: nodes.length, memberCount: members.length };
    };

    /**
     * Run structural analysis (placeholder)
     */
    const runAnalysis = async () => {
        setStatus('analyzing');

        // Simulate analysis or call actual solver
        try {
            await fetch('/api/analysis/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options: { type: 'static' } })
            });
        } catch (e) {
            // Demo mode - just wait
            await new Promise(r => setTimeout(r, 1000));
        }

        setStatus('done');
    };

    /**
     * Main handler - Template matching + LLM fallback
     */
    const handleAIDesign = async () => {
        if (!prompt.trim()) return;

        // Feature gate: Check AI usage limits
        if (!canAccess('aiAssistant') && dailyUsageCount >= FREE_TIER_DAILY_LIMIT) {
            const shouldUpgrade = await confirm({
                title: 'AI Daily Limit Reached',
                message: 'Free tier users get 3 AI generations per day. Upgrade to Pro for unlimited AI access.',
                confirmText: 'View Pricing',
                cancelText: 'Cancel',
                variant: 'info',
            });
            if (shouldUpgrade) {
                window.location.href = '/pricing';
            }
            return;
        }

        // Increment usage for free tier users
        if (!canAccess('aiAssistant')) {
            incrementUsage();
        }

        setIsLoading(true);
        setStatus('generating');
        setLastResult(null);

        try {
            // 1. Check if prompt matches a template first (using aliases)
            const matchedKey = findMatchingTemplate(prompt);

            let model: GeneratedModel | typeof TEMPLATE_BANK[keyof typeof TEMPLATE_BANK];
            let source: string;

            if (matchedKey && TEMPLATE_BANK[matchedKey as keyof typeof TEMPLATE_BANK]) {
                // Use pre-defined template (instant, no API call)
                model = TEMPLATE_BANK[matchedKey as keyof typeof TEMPLATE_BANK];
                source = `Template: ${TEMPLATE_BANK[matchedKey as keyof typeof TEMPLATE_BANK].name}`;
// logger.info(`[AICommandCenter] ✓ Matched template: ${matchedKey}`);
            } else {
                // Fallback to LLM for custom geometry
// logger.info('[AICommandCenter] No template match, trying LLM...');
                try {
                    model = await api.post('/ai/generate', { prompt });
                    source = 'AI Generated';
// logger.info('[AICommandCenter] ✓ Generated via LLM');
                } catch (err) {
                    // If LLM fails, use a sensible default
                    logger.warn('[AICommandCenter] LLM failed, using default beam');
                    model = TEMPLATE_BANK['SIMPLY_SUPPORTED_BEAM'];
                    source = 'Default: Simply Supported Beam';
                }
            }

            // 2. Import the model
            const stats = await importModel(model);
            toast.success(`Structure Generated: ${stats.nodeCount} nodes, ${stats.memberCount} members`);

            // 3. Run analysis
            toast.success("Running Analysis...");
            await runAnalysis();

            setLastResult(`${source} • ${stats.nodeCount} nodes, ${stats.memberCount} members`);
            toast.success("Analysis Complete!");

        } catch (error) {
            logger.error('[AICommandCenter] Error', { error: error instanceof Error ? error.message : String(error) });
            toast.error(error instanceof Error ? error.message : 'Generation failed');
            setStatus('idle');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="p-1 rounded bg-gradient-to-br from-blue-500 to-purple-500">
                    <Sparkles className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                    AI Architect
                </h3>
            </div>

            {/* Code & Complexity Selection */}
            <div className="flex gap-2 mb-2">
                <select
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:border-blue-500 outline-none"
                    disabled={isLoading}
                >
                    <option value="IS800">IS 800:2007 (Steel)</option>
                    <option value="IS456">IS 456:2000 (Concrete)</option>
                    <option value="AISC360">AISC 360-16 (US)</option>
                </select>
                <div className="flex-1 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5" title="Predicted Model Complexity">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Standard</span>
                </div>
            </div>

            {/* Prompt Input */}
            <textarea
                className="
                    w-full h-24 bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white
                    rounded-lg border border-slate-200 dark:border-slate-700
                    placeholder-slate-400 dark:placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    resize-none mb-1
                "
                placeholder="Describe your structure (e.g. 'G+3 commercial building on 200m2 plot' or '30m steel truss bridge')..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
            />

            {/* Quick Templates */}
            <div className="flex flex-wrap gap-1 mt-2 mb-3">
                {['warehouse', 'truss', '2-story frame', 'cantilever'].map(template => (
                    <button type="button"
                        key={template}
                        onClick={() => setPrompt(template)}
                        className="px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                        {template}
                    </button>
                ))}
            </div>

            {/* Generate Button */}
            <motion.button
                onClick={handleAIDesign}
                disabled={isLoading || !prompt.trim()}
                whileTap={{ scale: 0.98 }}
                className="
                    w-full py-2.5 rounded-lg text-sm font-bold
                    flex items-center justify-center gap-2
                    bg-gradient-to-r from-blue-600 to-blue-500
                    hover:from-blue-500 hover:to-blue-400
                    disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed
                    text-slate-900 dark:text-white transition-all
                    shadow-lg shadow-blue-500/20
                "
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {status === 'analyzing' ? 'Analyzing...' : 'Generating...'}
                    </>
                ) : (
                    <>
                        <Zap className="w-4 h-4" />
                        Build & Analyze
                    </>
                )}
            </motion.button>

            {/* Status */}
            {lastResult && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mt-3 text-xs text-green-400"
                >
                    <CheckCircle className="w-3 h-3" />
                    {lastResult}
                </motion.div>
            )}
        </div>
    );
};

export default AICommandCenter;
