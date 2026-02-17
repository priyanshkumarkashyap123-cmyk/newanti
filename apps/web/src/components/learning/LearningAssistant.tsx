import { FC, useEffect, useState } from 'react';
import { Lightbulb, BookOpen, TrendingUp, X, Check } from 'lucide-react';
import { sequentialLearning, AdaptiveRecommendation, SkillProgression } from '../../services/learning';

export const LearningAssistant: FC = () => {
    const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
    const [skills, setSkills] = useState<SkillProgression[]>([]);
    const [isOpen, setIsOpen] = useState(true);

    // Mock user ID for now
    const userId = 'current_user';

    useEffect(() => {
        // Poll for updates (in a real app this would be event-driven or reactive)
        const interval = setInterval(() => {
            const recs = sequentialLearning.getRecommendations(userId, 3);
            const progression = sequentialLearning.getSkillProgression(userId);

            setRecommendations(recs);
            setSkills(progression.slice(0, 3)); // Top 3 active skills
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-all"
            >
                <Lightbulb className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600/20 border-b border-indigo-500/20">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold text-white">AI Learning Assistant</span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-zinc-400 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">

                {/* Skill Progress */}
                {skills.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Recent Progress
                        </h4>
                        <div className="space-y-2">
                            {skills.map(skill => (
                                <div key={skill.skill} className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-zinc-300 capitalize">{skill.skill.replace('_', ' ')}</span>
                                        <span className="text-indigo-400">{skill.currentLevel.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Recommended for You
                    </h4>
                    {recommendations.length === 0 ? (
                        <div className="text-xs text-zinc-400 italic p-2 bg-zinc-800/50 rounded">
                            Interact with tools to get personalized suggestions...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="bg-zinc-800/50 p-3 rounded border border-zinc-700/50 hover:bg-zinc-800 transition-colors">
                                    <div className="flex items-start gap-2">
                                        <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${rec.type === 'review' ? 'bg-orange-500' :
                                                rec.type === 'topic' ? 'bg-green-500' : 'bg-blue-500'
                                            }`} />
                                        <div>
                                            <div className="text-xs font-bold text-zinc-200">{rec.title}</div>
                                            <div className="text-[10px] text-zinc-400 mt-0.5">{rec.description}</div>
                                            <div className="mt-2 flex gap-2">
                                                <button className="px-2 py-1 bg-indigo-600/20 text-indigo-400 text-[10px] rounded hover:bg-indigo-600/30">
                                                    Start Lesson
                                                </button>
                                                <button className="px-2 py-1 bg-zinc-700/50 text-zinc-400 text-[10px] rounded hover:bg-zinc-700">
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
