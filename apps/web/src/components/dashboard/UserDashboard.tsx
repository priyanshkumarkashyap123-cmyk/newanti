/**
 * UserDashboard.tsx - User Activity Dashboard
 * 
 * Shows:
 * - Tier status with upgrade CTA
 * - Activity statistics (analyses, exports)
 * - Recent activity timeline
 * - Usage limits (for free tier)
 */

import { FC, useState, useEffect } from 'react';
import {
    BarChart3,
    Download,
    Clock,
    Crown,
    Zap,
    ChevronRight,
    Loader2,
    TrendingUp,
    FileText,
    Cloud,
    BookOpen,
    Layout
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { API_CONFIG } from '../../config/env';

// ============================================
// TYPES
// ============================================

interface UserStats {
    tier: 'free' | 'pro' | 'enterprise';
    lastLogin: string | null;
    totalAnalysisRuns: number;
    totalExports: number;
    dailyAnalysisRemaining: number;
    projectCount: number;
}

interface ActivityItem {
    action: string;
    timestamp: string;
}

interface TierLimits {
    maxNodes: number;
    maxMembers: number;
    maxProjects: number;
    maxAnalysisPerDay: number;
    canSaveProjects: boolean;
    canExportCleanPDF: boolean;
    hasDesignCodes: boolean;
    templates: string[];
}

interface DashboardData {
    tier: string;
    limits: TierLimits;
    stats: UserStats;
    recentActivity: ActivityItem[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getActionIcon = (action: string) => {
    switch (action) {
        case 'login': return <Clock className="w-4 h-4 text-blue-400" />;
        case 'analysis_run': return <BarChart3 className="w-4 h-4 text-green-400" />;
        case 'export_pdf': return <FileText className="w-4 h-4 text-purple-400" />;
        case 'project_create': return <TrendingUp className="w-4 h-4 text-yellow-400" />;
        default: return <Zap className="w-4 h-4 text-[#869ab8]" />;
    }
};

const getActionLabel = (action: string): string => {
    switch (action) {
        case 'login': return 'Logged in';
        case 'analysis_run': return 'Ran analysis';
        case 'export_pdf': return 'Exported PDF';
        case 'project_create': return 'Created project';
        case 'project_save': return 'Saved project';
        case 'template_use': return 'Used template';
        default: return action;
    }
};

// ============================================
// COMPONENT
// ============================================

export const UserDashboard: FC = () => {
    const { isSignedIn, getToken } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch user data
    useEffect(() => {
        const fetchData = async () => {
            if (!isSignedIn) {
                setLoading(false);
                return;
            }

            try {
                const token = await getToken();
                const response = await fetch(`${API_CONFIG.baseUrl}/api/user/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user data');
                }

                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                } else {
                    // Handle envelope error: { error: { code, message } }
                    const errMsg = typeof result.error === 'object' ? result.error?.message : result.error;
                    setError(errMsg || 'Unknown error');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isSignedIn, getToken]);

    if (!isSignedIn) {
        return (
            <div className="p-6 bg-[#0b1326] rounded-xl">
                <p className="text-[#869ab8] text-center">Sign in to view your dashboard</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 bg-[#0b1326] rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-[#0b1326] rounded-xl">
                <p className="text-red-400 text-center">{error || 'Failed to load dashboard'}</p>
            </div>
        );
    }

    const isPro = data.tier === 'pro' || data.tier === 'enterprise';

    return (
        <div className="space-y-6">
            {/* Tier Status Card */}
            <div className={`p-6 rounded-xl border ${isPro
                ? 'bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30'
                : 'bg-[#0b1326] border-[#1a2333]'
                }`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isPro ? 'bg-purple-500/20' : 'bg-[#131b2e]'}`}>
                            <Crown className={`w-6 h-6 ${isPro ? 'text-purple-400' : 'text-[#869ab8]'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#dae2fd]">
                                {isPro ? 'Pro Plan' : 'Free Plan'}
                            </h2>
                            <p className="text-sm text-[#869ab8]">
                                {isPro
                                    ? 'Unlimited access to all features'
                                    : 'Upgrade for unlimited analyses'
                                }
                            </p>
                        </div>
                    </div>
                    {!isPro && (
                        <button type="button" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-medium tracking-wide transition-all">
                            <Zap className="w-4 h-4" />
                            Upgrade to Pro
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Usage Limits for Free Tier */}
                {!isPro && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#1a2333]">
                        <div>
                            <div className="text-xs text-[#869ab8] mb-1">Daily Analyses</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-[#dae2fd]">
                                    {data.stats.dailyAnalysisRemaining}
                                </span>
                                <span className="text-[#869ab8]">/ {data.limits.maxAnalysisPerDay}</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-[#869ab8] mb-1">Max Nodes</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-[#dae2fd]">
                                    {data.limits.maxNodes}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-[#869ab8] mb-1">Projects</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-[#dae2fd]">
                                    {data.stats.projectCount}
                                </span>
                                <span className="text-[#869ab8]">/ {data.limits.maxProjects}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-[#0b1326] rounded-xl border border-[#1a2333]">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-[#869ab8]">Total Analyses</span>
                    </div>
                    <div className="text-2xl font-bold text-[#dae2fd]">
                        {data.stats.totalAnalysisRuns}
                    </div>
                </div>

                <div className="p-4 bg-[#0b1326] rounded-xl border border-[#1a2333]">
                    <div className="flex items-center gap-2 mb-2">
                        <Download className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-[#869ab8]">PDF Exports</span>
                    </div>
                    <div className="text-2xl font-bold text-[#dae2fd]">
                        {data.stats.totalExports}
                    </div>
                </div>

                <div className="p-4 bg-[#0b1326] rounded-xl border border-[#1a2333]">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-[#869ab8]">Last Login</span>
                    </div>
                    <div className="text-sm font-medium tracking-wide text-[#dae2fd]">
                        {formatDate(data.stats.lastLogin)}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="p-4 bg-[#0b1326] rounded-xl border border-[#1a2333]">
                <h3 className="text-sm font-bold text-[#869ab8] uppercase mb-4">Recent Activity</h3>

                {data.recentActivity.length === 0 ? (
                    <p className="text-[#869ab8] text-sm">No activity yet</p>
                ) : (
                    <div className="space-y-3">
                        {data.recentActivity.slice(0, 5).map((activity, index) => (
                            <div key={index} className="flex items-center gap-3">
                                {getActionIcon(activity.action)}
                                <div className="flex-1">
                                    <span className="text-sm text-[#dae2fd]">
                                        {getActionLabel(activity.action)}
                                    </span>
                                </div>
                                <span className="text-xs text-[#869ab8]">
                                    {formatDate(activity.timestamp)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pro Features Preview */}
            {!isPro && (
                <div className="p-4 bg-[#0b1326] rounded-xl border border-[#1a2333]">
                    <h3 className="text-sm font-bold text-[#869ab8] uppercase mb-4">
                        Pro Features
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { icon: <BarChart3 className="w-4 h-4 text-blue-400" />, label: 'Unlimited Analyses' },
                            { icon: <Cloud className="w-4 h-4 text-purple-400" />, label: 'Cloud Project Save' },
                            { icon: <FileText className="w-4 h-4 text-green-400" />, label: 'Clean PDF Reports' },
                            { icon: <BookOpen className="w-4 h-4 text-yellow-400" />, label: 'IS 456 Design Codes' },
                            { icon: <Layout className="w-4 h-4 text-pink-400" />, label: '30+ Templates' },
                            { icon: <Zap className="w-4 h-4 text-orange-400" />, label: 'Priority Solver' }
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                {feature.icon}
                                <span className="text-[#869ab8]">{feature.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
