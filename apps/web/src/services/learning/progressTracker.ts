export interface Certificate {
  id: string;
  type: 'module' | 'path' | 'milestone';
  title: string;
  issuedTo: string;
  issuedDate: string;
  moduleId?: string;
  pathId?: string;
  milestoneId?: string;
  verificationCode: string;
  signatureImage?: string;
}

export interface AchievementBadge {
  id: string;
  milestoneId: string;
  earnedDate: string;
  title: string;
  icon: string;
}

export interface ModuleProgress {
  completedLessons: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface LearningProgressState {
  modules: Record<string, ModuleProgress>;
  templatesStarted: string[];
  templatesCompleted: string[];
  certificates: Certificate[];
  badges: AchievementBadge[];
  lastActivePath?: string;
}

const STORAGE_KEY = 'beamlab_learning_progress_v1';

const DEFAULT_PROGRESS: LearningProgressState = {
  modules: {},
  templatesStarted: [],
  templatesCompleted: [],
  certificates: [],
  badges: [],
};

export function getLearningProgress(): LearningProgressState {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as LearningProgressState;
    return {
      modules: parsed.modules || {},
      templatesStarted: parsed.templatesStarted || [],
      templatesCompleted: parsed.templatesCompleted || [],
      certificates: parsed.certificates || [],
      badges: parsed.badges || [],
      lastActivePath: parsed.lastActivePath,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveLearningProgress(state: LearningProgressState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markLessonCompletion(
  state: LearningProgressState,
  moduleId: string,
  lessonId: string,
  completed: boolean,
): LearningProgressState {
  const existingModule = state.modules[moduleId] || { completedLessons: [], startedAt: new Date().toISOString() };
  const completedSet = new Set(existingModule.completedLessons);

  if (completed) completedSet.add(lessonId);
  else completedSet.delete(lessonId);

  return {
    ...state,
    modules: {
      ...state.modules,
      [moduleId]: {
        ...existingModule,
        completedLessons: Array.from(completedSet),
      },
    },
  };
}

export function setModuleCompleted(
  state: LearningProgressState,
  moduleId: string,
): LearningProgressState {
  const existingModule = state.modules[moduleId] || { completedLessons: [] };
  return {
    ...state,
    modules: {
      ...state.modules,
      [moduleId]: {
        ...existingModule,
        startedAt: existingModule.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    },
  };
}

export function getModuleProgressPercent(
  state: LearningProgressState,
  moduleId: string,
  totalLessons: number,
): number {
  if (totalLessons <= 0) return 0;
  const completed = state.modules[moduleId]?.completedLessons?.length || 0;
  return Math.min(100, Math.round((completed / totalLessons) * 100));
}

export function isModuleCompleted(
  state: LearningProgressState,
  moduleId: string,
  totalLessons: number,
): boolean {
  if (totalLessons <= 0) return false;
  const completed = state.modules[moduleId]?.completedLessons?.length || 0;
  return completed >= totalLessons;
}

export function startTemplate(state: LearningProgressState, templateId: string): LearningProgressState {
  const started = new Set(state.templatesStarted);
  started.add(templateId);
  return { ...state, templatesStarted: Array.from(started) };
}

export function completeTemplate(
  state: LearningProgressState,
  templateId: string,
): LearningProgressState {
  const completed = new Set(state.templatesCompleted);
  completed.add(templateId);
  const started = new Set(state.templatesStarted);
  started.add(templateId);
  return {
    ...state,
    templatesCompleted: Array.from(completed),
    templatesStarted: Array.from(started),
  };
}

export function addCertificate(state: LearningProgressState, certificate: Certificate): LearningProgressState {
  return {
    ...state,
    certificates: [...state.certificates, certificate],
  };
}

export function addBadge(state: LearningProgressState, badge: AchievementBadge): LearningProgressState {
  const exists = state.badges.some((b) => b.id === badge.id);
  if (exists) return state;
  return {
    ...state,
    badges: [...state.badges, badge],
  };
}

export function getTemplatesCompletedCount(state: LearningProgressState): number {
  return state.templatesCompleted.length;
}

export function getTemplatesStartedCount(state: LearningProgressState): number {
  return state.templatesStarted.length;
}
