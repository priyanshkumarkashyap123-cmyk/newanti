import type { Intent } from './intents.js';

export type SectionKey =
  | 'context'
  | 'analysis'
  | 'actions'
  | 'summary'
  | 'model_changes'
  | 'code'
  | 'validation'
  | 'next_steps'
  | 'risks'
  | 'safety'
  | 'assumptions'
  | 'loads'
  | 'supports'
  | 'geometry'
  | 'materials'
  | 'design_checks'
  | 'warnings';

export type SectionContent = Record<SectionKey, string>;

export const DEFAULT_SECTIONS: SectionContent = {
  context: '',
  analysis: '',
  actions: '',
  summary: '',
  model_changes: '',
  code: '',
  validation: '',
  next_steps: '',
  risks: '',
  safety: '',
  assumptions: '',
  loads: '',
  supports: '',
  geometry: '',
  materials: '',
  design_checks: '',
  warnings: '',
};

export function sectionOrderForIntent(intent: Intent): SectionKey[] {
  switch (intent) {
    case 'create_structure':
      return ['context', 'geometry', 'materials', 'supports', 'loads', 'actions', 'model_changes', 'warnings', 'next_steps'];
    case 'modify_model':
      return ['context', 'model_changes', 'actions', 'warnings', 'next_steps'];
    case 'add_load':
      return ['context', 'loads', 'actions', 'warnings', 'next_steps'];
    case 'add_support':
      return ['context', 'supports', 'actions', 'warnings', 'next_steps'];
    case 'change_section':
      return ['context', 'materials', 'actions', 'design_checks', 'warnings', 'next_steps'];
    case 'run_analysis':
      return ['context', 'analysis', 'validation', 'actions', 'summary', 'warnings', 'next_steps'];
    case 'diagnose':
    case 'troubleshoot':
      return ['context', 'analysis', 'actions', 'risks', 'warnings', 'next_steps'];
    case 'optimize':
      return ['context', 'analysis', 'actions', 'design_checks', 'warnings', 'next_steps'];
    case 'code_check':
      return ['context', 'design_checks', 'safety', 'validation', 'actions', 'warnings', 'next_steps'];
    case 'review_model':
      return ['context', 'analysis', 'summary', 'warnings', 'next_steps'];
    case 'explain':
    case 'conversation':
    case 'greeting':
    case 'thanks':
    case 'help':
    case 'about_model':
    case 'clear_model':
    default:
      return ['context', 'analysis', 'actions', 'summary', 'warnings', 'next_steps'];
  }
}