import { useMemo, useState } from 'react';
import { BookOpen, Building2, Clock3, Filter, Layers, PlayCircle } from 'lucide-react';
import { ALL_EDUCATIONAL_TEMPLATES, type EducationalTemplate } from '../../data/educationalTemplates';

type DifficultyFilter = 'ALL' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

interface TemplateExplorerProps {
  onStartTemplate: (templateId: string) => void;
  className?: string;
}

const DIFFICULTY_STYLES: Record<Exclude<DifficultyFilter, 'ALL'>, string> = {
  BEGINNER: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  INTERMEDIATE: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ADVANCED: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

function TemplateCard({
  template,
  onStart,
}: {
  template: EducationalTemplate;
  onStart: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 hover:border-white/[0.14] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-100 leading-tight">{template.title}</h4>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${DIFFICULTY_STYLES[template.difficulty]}`}
        >
          {template.difficulty}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Building2 className="w-3 h-3" />
          {template.category}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="w-3 h-3" />
          {Math.round(template.duration * 60)} min
        </span>
      </div>

      <p className="mt-2 text-[10px] text-slate-400 line-clamp-2">{template.description}</p>

      <div className="mt-2 text-[10px] text-slate-500">
        {template.learningObjectives.slice(0, 2).map((objective) => (
          <div key={objective} className="truncate">• {objective}</div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onStart(template.id)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors"
      >
        <PlayCircle className="w-3.5 h-3.5" />
        Start Template
      </button>
    </div>
  );
}

export function TemplateExplorer({ onStartTemplate, className = '' }: TemplateExplorerProps) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('ALL');

  const templates = useMemo(() => {
    if (difficulty === 'ALL') return ALL_EDUCATIONAL_TEMPLATES;
    return ALL_EDUCATIONAL_TEMPLATES.filter((t) => t.difficulty === difficulty);
  }, [difficulty]);

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Template Explorer
        </h3>
        <span className="text-[10px] text-slate-500">{templates.length} templates</span>
      </div>

      <div className="mb-3 flex items-center gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mr-1">
          <Filter className="w-3 h-3" /> Difficulty
        </span>
        {(['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setDifficulty(level)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              difficulty === level
                ? 'bg-blue-600 text-white'
                : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-[10px] text-blue-300">
        <div className="font-semibold flex items-center gap-1.5 mb-1">
          <Layers className="w-3 h-3" />
          Guided Quick Start
        </div>
        Launches Space Planning with smart defaults based on selected learning template.
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} onStart={onStartTemplate} />
        ))}
      </div>
    </div>
  );
}

export default TemplateExplorer;
