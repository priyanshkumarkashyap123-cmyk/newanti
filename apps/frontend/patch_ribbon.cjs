const fs = require('fs');

let content = fs.readFileSync('src/components/layout/EngineeringRibbon.tsx', 'utf8');

// 1. Add imports
const importAdd = `import { useComputePreference } from "../../hooks/useComputePreference";
import { ComputeModeIndicator } from "./ComputeModeIndicator";
`;
content = content.replace('import { Link, useNavigate }', importAdd + 'import { Link, useNavigate }');

// 2. Add hook inside the component
content = content.replace(
  'const isAnalyzing = useModelStore((s) => s.isAnalyzing);',
  'const isAnalyzing = useModelStore((s) => s.isAnalyzing);\n  const computePreference = useComputePreference();'
);

// 3. Update the renderAnalysisTab
const runGroupStr = `<ToolGroup label="Run">
        <ToolButton
          icon={Play}
          label="RUN ANALYSIS"
          onClick={() => executeSharedAction("run-analysis")}
          isActive={isAnalyzing}
          tooltip="Run Linear Static Analysis"
          shortcut="F5"
          size="large"
          accent={isAnalyzing ? "text-yellow-400 animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40 animate-[pulse-glow_2s_ease-in-out_infinite]"}
        />`;

const replaceRunGroup = `<ToolGroup label="Run">
        <div className="flex flex-col gap-1.5 items-center justify-center mr-1">
          <ToolButton
            icon={Play}
            label="RUN ANALYSIS"
            onClick={() => executeSharedAction("run-analysis")}
            isActive={isAnalyzing}
            tooltip="Run Linear Static Analysis"
            shortcut="F5"
            size="large"
            accent={isAnalyzing ? "text-yellow-400 animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40 animate-[pulse-glow_2s_ease-in-out_infinite]"}
          />
          <ComputeModeIndicator mode={computePreference} />
        </div>`;

content = content.replace(runGroupStr, replaceRunGroup);

// 4. Update the useMemo dependencies
content = content.replace(
  '  ), [isAnalyzing, executeSharedAction, openModal, hasResults]);',
  '  ), [isAnalyzing, executeSharedAction, openModal, hasResults, computePreference]);'
);

fs.writeFileSync('src/components/layout/EngineeringRibbon.tsx', content);
console.log('Patched EngineeringRibbon.tsx');
