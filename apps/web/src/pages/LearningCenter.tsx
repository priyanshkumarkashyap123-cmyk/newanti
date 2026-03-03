/**
 * LearningCenter.tsx - Comprehensive Learning Hub
 * 
 * 4-level progressive learning paths:
 * 1. FUNDAMENTALS (10 hours) - Loads, supports, basic analysis
 * 2. INTERMEDIATE (20 hours) - 3D analysis, codes, design
 * 3. ADVANCED (40 hours) - Nonlinear, optimization, research
 * 4. EXPERT - Contribute, research, certification
 * 
 * Each with templates, tutorials, code references, and projects
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Play,
  BookOpen,
  Code2,
  Zap,
  Trophy,
  Lock,
  CheckCircle2,
  ArrowLeft,
  Search,
  Filter,
  Clock,
  Users,
  Star,
  Target,
} from 'lucide-react';
// Import educational templates library
import { ALL_EDUCATIONAL_TEMPLATES } from '../data/educationalTemplates';
import { CODE_REFERENCE_SUMMARY } from '../data/codeReferences';
import {
  getLearningProgress,
  getModuleProgressPercent,
  isModuleCompleted,
  markLessonCompletion,
  saveLearningProgress,
  setModuleCompleted,
  type LearningProgressState,
} from '../services/learning/progressTracker';

// ============================================
// TYPES
// ============================================

// ============================================
// TYPES
// ============================================

type LearningLevel = 'FUNDAMENTALS' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
type ModuleStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  videoUrl: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  objectives: string[];
  resources?: string[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  duration: number; // hours
  difficulty: LearningLevel;
  status: ModuleStatus;
  progress: number; // 0-100
  lessons: Lesson[];
  quiz?: {
    title: string;
    questions: number;
    passingScore: number;
  };
  certificate?: boolean;
}

interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'interactive' | 'project' | 'quiz';
  duration: number;
}

interface LearningPath {
  id: string;
  level: LearningLevel;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  totalHours: number;
  modules: Module[];
  prerequisite?: string;
  targetAudience: string;
  outcomes: string[];
  locked: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  difficulty: LearningLevel;
  category: string;
  timeToComplete: number; // minutes
  learningObjectives: string[];
  codeReference?: string;
}

// ============================================
// DATA
// ============================================

const FUNDAMENTALS_PATH: LearningPath = {
  id: 'fundamentals',
  level: 'FUNDAMENTALS',
  title: 'Structural Analysis Fundamentals',
  description: 'Master the basics: loads, supports, equilibrium, and how to read analysis diagrams.',
  icon: <BookOpen className="w-6 h-6" />,
  color: 'from-blue-600 to-cyan-600',
  totalHours: 10,
  prerequisite: undefined,
  targetAudience: 'Students, junior engineers, newcomers to structural design',
  locked: false,
  outcomes: [
    'Understand load types and their behavior',
    'Apply support conditions correctly',
    'Interpret SFD/BMD diagrams',
    'Calculate reactions and internal forces',
    'Recognize structural system types',
  ],
  modules: [
    {
      id: 'mod-load-types',
      title: 'Load Types & Classifications',
      description: 'Point loads, distributed loads, environmental loads, and load combinations',
      duration: 2,
      difficulty: 'FUNDAMENTALS',
      status: 'AVAILABLE',
      progress: 0,
      certificate: false,
      lessons: [
        { id: 'les-1', title: 'Introduction to Loads', type: 'video', duration: 12 },
        { id: 'les-2', title: 'Point Loads vs Distributed', type: 'interactive', duration: 15 },
        { id: 'les-3', title: 'Environmental Loads (Wind, Seismic)', type: 'video', duration: 18 },
        { id: 'les-4', title: 'Load Combinations Quiz', type: 'quiz', duration: 10 },
      ],
      quiz: { title: 'Load Types Quiz', questions: 10, passingScore: 80 },
    },
    {
      id: 'mod-supports',
      title: 'Support Conditions & Reactions',
      description: 'Pin, fixed, roller supports and force equilibrium',
      duration: 1.5,
      difficulty: 'FUNDAMENTALS',
      status: 'LOCKED',
      progress: 0,
      certificate: false,
      lessons: [
        { id: 'les-5', title: 'Types of Supports', type: 'video', duration: 15 },
        { id: 'les-6', title: 'Reaction Calculation Interactive', type: 'interactive', duration: 20 },
        { id: 'les-7', title: 'Support Quiz', type: 'quiz', duration: 10 },
      ],
      quiz: { title: 'Support Conditions', questions: 8, passingScore: 80 },
    },
    {
      id: 'mod-equilibrium',
      title: 'Equilibrium & Free Body Diagrams',
      description: 'ΣFx=0, ΣFy=0, ΣM=0 and how to verify solutions',
      duration: 2,
      difficulty: 'FUNDAMENTALS',
      status: 'LOCKED',
      progress: 0,
      certificate: false,
      lessons: [
        { id: 'les-8', title: 'Equilibrium Equations Explained', type: 'video', duration: 18 },
        { id: 'les-9', title: 'Free Body Diagram Practice', type: 'interactive', duration: 25 },
        { id: 'les-10', title: 'Equilibrium Quiz', type: 'quiz', duration: 10 },
      ],
      quiz: { title: 'Equilibrium Verification', questions: 12, passingScore: 80 },
    },
    {
      id: 'mod-diagrams',
      title: 'Reading SFD, BMD, and AFD',
      description: 'Shear force, bending moment, and axial force diagrams explained',
      duration: 2,
      difficulty: 'FUNDAMENTALS',
      status: 'LOCKED',
      progress: 0,
      certificate: false,
      lessons: [
        { id: 'les-11', title: 'Understanding SFD/BMD', type: 'video', duration: 20 },
        { id: 'les-12', title: 'Diagram Interpretation Interactive', type: 'interactive', duration: 25 },
        { id: 'les-13', title: 'Diagram Analysis Project', type: 'project', duration: 30 },
      ],
      quiz: { title: 'SFD/BMD Analysis', questions: 15, passingScore: 85 },
    },
    {
      id: 'mod-codes-intro',
      title: 'Introduction to Design Codes',
      description: 'IS 800, IS 456, IS 1893, IS 875 - when to use what?',
      duration: 2.5,
      difficulty: 'FUNDAMENTALS',
      status: 'LOCKED',
      progress: 0,
      certificate: true,
      lessons: [
        { id: 'les-14', title: 'Indian Design Codes Overview', type: 'video', duration: 15 },
        { id: 'les-15', title: 'IS 800 for Steel Design', type: 'video', duration: 18 },
        { id: 'les-16', title: 'IS 456 for Concrete Design', type: 'video', duration: 18 },
        { id: 'les-17', title: 'Wind & Seismic Codes (IS 875, 1893)', type: 'video', duration: 20 },
        { id: 'les-18', title: 'Codes Review Quiz', type: 'quiz', duration: 15 },
      ],
      quiz: { title: 'Design Codes Mastery', questions: 20, passingScore: 85 },
    },
  ],
};

const INTERMEDIATE_PATH: LearningPath = {
  id: 'intermediate',
  level: 'INTERMEDIATE',
  title: 'Intermediate Structural Design',
  description: 'Apply codes to real problems: 3D analysis, material design, and optimization.',
  icon: <Zap className="w-6 h-6" />,
  color: 'from-purple-600 to-pink-600',
  totalHours: 20,
  prerequisite: 'fundamentals',
  targetAudience: 'Professional engineers, design consultants, advanced students',
  locked: true,
  outcomes: [
    'Design members per Indian design codes',
    'Handle 3D structural systems',
    'Optimize member sizes',
    'Create professional design reports',
  ],
  modules: [],
};

const ADVANCED_PATH: LearningPath = {
  id: 'advanced',
  level: 'ADVANCED',
  title: 'Advanced Structural Analysis',
  description: 'Nonlinear analysis, dynamic behavior, and research-level FEA.',
  icon: <Code2 className="w-6 h-6" />,
  color: 'from-red-600 to-orange-600',
  totalHours: 40,
  prerequisite: 'intermediate',
  targetAudience: 'Senior engineers, researchers, specialists',
  locked: true,
  outcomes: [
    'Perform P-Delta and nonlinear analysis',
    'Modal and response spectrum analysis',
    'Finite element theory and applications',
  ],
  modules: [],
};

const EXPERT_PATH: LearningPath = {
  id: 'expert',
  level: 'EXPERT',
  title: 'Expert & Contribution',
  description: 'Research, contribute elements, and lead industry discussions.',
  icon: <Trophy className="w-6 h-6" />,
  color: 'from-yellow-600 to-amber-600',
  totalHours: 0,
  prerequisite: 'advanced',
  targetAudience: 'PhD candidates, research engineers, industry leaders',
  locked: true,
  outcomes: [
    'Contribute custom elements to BeamLab',
    'Lead research initiatives',
    'Earn expert certification',
  ],
  modules: [],
};

// Use comprehensive educational templates from library
const TEMPLATES = ALL_EDUCATIONAL_TEMPLATES.map(template => ({
  id: template.id,
  name: template.title,
  description: template.description,
  difficulty: template.difficulty,
  category: template.category,
  timeToComplete: Math.round(template.duration * 60),
  learningObjectives: template.learningObjectives.slice(0, 3),
  codeReference: template.applicableCodes.join(', '),
}));

const LEARNING_PATHS = [FUNDAMENTALS_PATH, INTERMEDIATE_PATH, ADVANCED_PATH, EXPERT_PATH];

// ============================================
// MAIN COMPONENT
// ============================================

export function LearningCenter() {
  const navigate = useNavigate();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [progressState, setProgressState] = useState<LearningProgressState>(() => getLearningProgress());

  useEffect(() => {
    document.title = 'Learning Center | BeamLab';
  }, []);

  useEffect(() => {
    saveLearningProgress(progressState);
  }, [progressState]);

  const activePathProgress = useMemo(() => {
    if (!selectedPath) return 0;
    const path = LEARNING_PATHS.find((p) => p.id === selectedPath);
    if (!path || path.modules.length === 0) return 0;

    const total = path.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const done = path.modules.reduce(
      (sum, m) => sum + (progressState.modules[m.id]?.completedLessons?.length || 0),
      0,
    );
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }, [progressState.modules, selectedPath]);

  const filteredPaths = useMemo(() => {
    return LEARNING_PATHS.filter(path =>
      path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      path.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/stream')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Learning Center</h1>
              <p className="text-sm text-slate-400">From fundamentals to advanced structural engineering</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-48"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {selectedPath === null ? (
          <PathOverview
            paths={filteredPaths}
            onSelectPath={setSelectedPath}
          />
        ) : (
          <PathDetail
            path={LEARNING_PATHS.find(p => p.id === selectedPath)!}
            expandedModule={expandedModule}
            onExpandModule={setExpandedModule}
            progressState={progressState}
            pathProgress={activePathProgress}
            onToggleLesson={(moduleId, lessonId, done) =>
              setProgressState((prev) => markLessonCompletion(prev, moduleId, lessonId, done))
            }
            onCompleteModule={(moduleId) =>
              setProgressState((prev) => setModuleCompleted(prev, moduleId))
            }
            onBack={() => setSelectedPath(null)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/50 mt-24 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-white mb-3">Learning Paths</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button onClick={() => setSelectedPath('fundamentals')} className="hover:text-white">Fundamentals</button></li>
              <li><button className="hover:text-white opacity-50 cursor-not-allowed">Intermediate</button></li>
              <li><button className="hover:text-white opacity-50 cursor-not-allowed">Advanced</button></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3">Templates</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {TEMPLATES.slice(0, 3).map(t => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3">Resources</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white">Code References</a></li>
              <li><a href="#" className="hover:text-white">Video Library</a></li>
              <li><a href="/help" className="hover:text-white">FAQs</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3">Community</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white">Forum</a></li>
              <li><a href="#" className="hover:text-white">Discussion</a></li>
              <li><a href="#" className="hover:text-white">Newsletter</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

const PathOverview: React.FC<{
  paths: LearningPath[];
  onSelectPath: (id: string) => void;
}> = ({ paths, onSelectPath }) => (
  <div>
    {/* Welcome Section */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12 text-center"
    >
      <h2 className="text-4xl font-bold text-white mb-4">Structural Engineering Learning Paths</h2>
      <p className="text-lg text-slate-400 max-w-2xl mx-auto">
        Choose your learning level and progress through structured modules. Each path includes videos, interactive lessons, templates, and real projects.
      </p>
    </motion.div>

    {/* Paths Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      {paths.map((path, idx) => (
        <motion.div
          key={path.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          onClick={() => !path.locked && onSelectPath(path.id)}
          className={`rounded-xl border transition-all cursor-pointer ${
            path.locked
              ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
              : 'border-white/20 bg-gradient-to-br from-white/10 to-white/5 hover:border-white/30 hover:bg-white/[0.08]'
          }`}
        >
          <div className={`h-1 bg-gradient-to-r ${path.color}`} />
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${path.color}`}>
                  {path.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{path.title}</h3>
                  <p className="text-sm text-slate-400">{path.totalHours}h total time</p>
                </div>
              </div>
              {path.locked ? (
                <Lock className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
              )}
            </div>
            <p className="text-sm text-slate-300 mb-4">{path.description}</p>
            <div className="mb-4">
              <p className="text-xs text-slate-500 font-semibold mb-2">FOR: {path.targetAudience}</p>
              <div className="flex flex-wrap gap-1">
                {path.outcomes.slice(0, 2).map((outcome, i) => (
                  <span key={i} className="text-xs bg-white/10 text-slate-300 px-2 py-1 rounded">
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
            {path.locked && path.prerequisite && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Complete {LEARNING_PATHS.find(p => p.id === path.prerequisite)?.title} first
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>

    {/* Templates Showcase */}
    <div className="mt-16">
      <h3 className="text-2xl font-bold text-white mb-6">Educational Templates</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-white">{template.name}</h4>
              <span className={`text-xs px-2 py-1 rounded ${
                  template.difficulty === 'BEGINNER' ? 'bg-blue-500/30 text-blue-300' :
                template.difficulty === 'INTERMEDIATE' ? 'bg-purple-500/30 text-purple-300' :
                'bg-red-500/30 text-red-300'
              }`}>
                {template.difficulty}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{template.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{template.codeReference}</span>
              <button className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Play className="w-3 h-3" /> Start
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PathDetail: React.FC<{
  path: LearningPath;
  expandedModule: string | null;
  onExpandModule: (id: string | null) => void;
  progressState: LearningProgressState;
  pathProgress: number;
  onToggleLesson: (moduleId: string, lessonId: string, done: boolean) => void;
  onCompleteModule: (moduleId: string) => void;
  onBack: () => void;
}> = ({
  path,
  expandedModule,
  onExpandModule,
  progressState,
  pathProgress,
  onToggleLesson,
  onCompleteModule,
  onBack,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    {/* Path Header */}
    <div className="mb-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Paths
      </button>
      <div className={`h-2 bg-gradient-to-r ${path.color} rounded mb-4`} />
      <h2 className="text-3xl font-bold text-white mb-2">{path.title}</h2>
      <p className="text-slate-400 mb-6 max-w-2xl">{path.description}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500">Total Duration</p>
          <p className="text-lg font-bold text-white">{path.totalHours}h</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500">Modules</p>
          <p className="text-lg font-bold text-white">{path.modules.length}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500">Difficulty</p>
          <p className="text-lg font-bold text-white capitalize flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" /> {path.level}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500">Progress</p>
          <p className="text-lg font-bold text-white">{pathProgress}%</p>
        </div>
      </div>
    </div>

    <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="font-bold text-white mb-3">Contextual Code Help</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {Object.entries(CODE_REFERENCE_SUMMARY)
          .slice(0, 4)
          .map(([code, details]) => (
            <div key={code} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="font-semibold text-slate-100">{code}</div>
              <div className="text-slate-400 text-xs mt-1">{details.subject}</div>
              <div className="text-slate-500 text-xs mt-1">
                Safety factor: {details.safetyFactor} · Deflection: {details.deflectionLimit}
              </div>
            </div>
          ))}
      </div>
    </div>

    {/* Learning Outcomes */}
    <div className="mb-10 p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" /> Learning Outcomes
      </h3>
      <ul className="space-y-2">
        {path.outcomes.map((outcome, i) => (
          <li key={i} className="flex items-start gap-3 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
            {outcome}
          </li>
        ))}
      </ul>
    </div>

    {/* Modules */}
    <div>
      <h3 className="text-2xl font-bold text-white mb-6">Module Curriculum</h3>
      <div className="space-y-3">
        {path.modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            completedLessonIds={progressState.modules[module.id]?.completedLessons || []}
            progress={getModuleProgressPercent(progressState, module.id, module.lessons.length)}
            completed={isModuleCompleted(progressState, module.id, module.lessons.length)}
            onToggleLesson={(lessonId, done) => onToggleLesson(module.id, lessonId, done)}
            onCompleteModule={() => onCompleteModule(module.id)}
            isExpanded={expandedModule === module.id}
            onToggle={() => onExpandModule(expandedModule === module.id ? null : module.id)}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

const ModuleCard: React.FC<{
  module: Module;
  completedLessonIds: string[];
  progress: number;
  completed: boolean;
  onToggleLesson: (lessonId: string, done: boolean) => void;
  onCompleteModule: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({
  module,
  completedLessonIds,
  progress,
  completed,
  onToggleLesson,
  onCompleteModule,
  isExpanded,
  onToggle,
}) => (
  <div
    onClick={onToggle}
    className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors cursor-pointer overflow-hidden"
  >
    <div className="p-6 flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-bold text-white">{module.title}</h4>
          {module.status === 'LOCKED' && <Lock className="w-4 h-4 text-slate-500" />}
          {(module.status === 'COMPLETED' || completed) && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        <p className="text-sm text-slate-400 mb-3">{module.description}</p>
        <div className="mb-3">
          <div className="h-1.5 w-full rounded bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Progress: {progress}%</div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {module.duration}h
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {module.lessons.length} lessons
          </span>
          {module.quiz && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Quiz included</span>}
          {module.certificate && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> Certificate</span>}
        </div>
      </div>
      <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
    </div>

    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-white/10 bg-white/[0.03] px-6 py-4"
        >
          <ul className="space-y-2">
            {module.lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center gap-3 text-sm text-slate-300">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLesson(lesson.id, !completedLessonIds.includes(lesson.id));
                  }}
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    completedLessonIds.includes(lesson.id)
                      ? 'bg-green-500 border-green-400'
                      : 'bg-transparent border-slate-500'
                  }`}
                  aria-label={`Toggle lesson completion: ${lesson.title}`}
                >
                  {completedLessonIds.includes(lesson.id) ? '✓' : ''}
                </button>
                <span>{lesson.title}</span>
                <span className="text-xs text-slate-500 ml-auto">{lesson.duration}m</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCompleteModule();
            }}
            className="mt-4 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Mark Module Complete
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default LearningCenter;
