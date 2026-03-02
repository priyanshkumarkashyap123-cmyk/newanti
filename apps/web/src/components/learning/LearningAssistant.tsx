import { FC, useEffect, useState } from 'react';
import { Lightbulb, BookOpen, TrendingUp, X, Check } from 'lucide-react';
import { sequentialLearning, AdaptiveRecommendation, SkillProgression } from '../../services/learning';

export const LearningAssistant: FC = () => {
    const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
    const [skills, setSkills] = useState<SkillProgression[]>([]);
    const [isOpen, setIsOpen] = useState(false); // Start collapsed to reduce clutter

    // Mock user ID for now
    const userId = 'current_user';

    useEffect(() => {
        if (!isOpen) return; // Don't poll when collapsed
        // Poll for updates at a reasonable interval
        const interval = setInterval(() => {
            const recs = sequentialLearning.getRecommendations(userId, 3);
            const progression = sequentialLearning.getSkillProgression(userId);

            setRecommendations(recs);
            setSkills(progression.slice(0, 3));
        }, 30000); // 30s instead of 2s — reduces re-renders by 15x

        // Initial fetch
        const recs = sequentialLearning.getRecommendations(userId, 3);
        const progression = sequentialLearning.getSkillProgression(userId);
        setRecommendations(recs);
        setSkills(progression.slice(0, 3));

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) {
        return (
            <button type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-all"
            >
                <Lightbulb className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl shadow-2xl flex flex-col z-30 max-h-[70vh]">
            {/* Header — never clipped */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600/20 border-b border-indigo-500/20 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">AI Learning Assistant</span>
                </div>
                <button type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content — scrollable, fills remaining space */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">

                {/* Skill Progress */}
                {skills.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Recent Progress
                        </h4>
                        <div className="space-y-2">
                            {skills.map(skill => (
                                <div key={skill.skill} className="bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-700 dark:text-slate-200 capitalize truncate mr-2">{skill.skill.replace('_', ' ')}</span>
                                        <span className="text-indigo-400">{skill.currentLevel.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-500"
                                            style={{ width: `${skill.currentLevel}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommendations */}
                <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Recommended for You
                    </h4>
                    {recommendations.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic p-2 bg-slate-100/50 dark:bg-slate-800/50 rounded">
                            Interact with tools to get personalized suggestions...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="bg-slate-100/50 dark:bg-slate-800/50 p-3 rounded border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-start gap-2">
                                        <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${rec.type === 'review' ? 'bg-orange-500' :
                                                rec.type === 'topic' ? 'bg-green-500' : 'bg-blue-500'
                                            }`} />
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{rec.title}</div>
                                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{rec.description}</div>
                                            <div className="mt-2 flex gap-2">
                                                <button type="button" className="px-2 py-1 bg-indigo-600/20 text-indigo-400 text-[10px] rounded hover:bg-indigo-600/30">
                                                    Start Lesson
                                                </button>
                                                <button type="button" className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default LearningAssistant;
