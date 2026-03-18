import React, { useState } from 'react';
import { Cpu, Server, Globe } from 'lucide-react';
import type { ComputePreference } from '../../utils/computePreference';
import { useNavigate } from 'react-router-dom';

interface Props {
  mode: ComputePreference;
}

export const ComputeModeIndicator: React.FC<Props> = ({ mode }) => {
  const navigate = useNavigate();
  
  let Icon = Server;
  let label = 'Cloud GPU';
  let colorClass = 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';

  if (mode === 'local') {
    Icon = Cpu;
    label = 'My Device';
    colorClass = 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800';
  } else if (mode === 'auto') {
    Icon = Globe;
    label = 'Auto Mode';
    colorClass = 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  }

  return (
    <button 
      onClick={() => navigate('/settings')}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide uppercase transition-all hover:brightness-110 ${colorClass}`}
      title="Click to change compute mode in Settings"
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
};
