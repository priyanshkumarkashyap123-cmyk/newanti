/**
 * OnboardingFlow.tsx
 * 
 * First-time user onboarding experience
 * Guided tour + preference collection
 */

import React from 'react';
import { FC, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Building2, 
  GraduationCap, 
  Briefcase,
  Users,
  Sparkles,
  Zap,
  Target,
  Layers,
  Play,
  X
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

interface UserPreferences {
  role: 'student' | 'professional' | 'enterprise' | null;
  experience: 'beginner' | 'intermediate' | 'expert' | null;
  primaryUse: string[];
  designCodes: string[];
}

interface OnboardingFlowProps {
  onComplete: (preferences: UserPreferences) => void;
  onSkip?: () => void;
}

// ============================================
// ONBOARDING FLOW COMPONENT
// ============================================

export const OnboardingFlow: FC<OnboardingFlowProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences>({
    role: null,
    experience: null,
    primaryUse: [],
    designCodes: []
  });

  // Memoize steps to avoid creating components during every render
  const steps: OnboardingStep[] = useMemo(() => [
    {
      id: 'welcome',
      title: 'Welcome to BeamLab Ultimate',
      subtitle: 'The most advanced structural analysis platform on the web',
      content: <WelcomeStep />
    },
    {
      id: 'role',
      title: 'Tell us about yourself',
      subtitle: 'We\'ll personalize your experience',
      content: <RoleStep preferences={preferences} setPreferences={setPreferences} />
    },
    {
      id: 'experience',
      title: 'Your experience level',
      subtitle: 'We\'ll adjust the interface complexity',
      content: <ExperienceStep preferences={preferences} setPreferences={setPreferences} />
    },
    {
      id: 'use-case',
      title: 'What will you analyze?',
      subtitle: 'Select all that apply',
      content: <UseCaseStep preferences={preferences} setPreferences={setPreferences} />
    },
    {
      id: 'codes',
      title: 'Design codes you use',
      subtitle: 'We\'ll pre-configure your workspace',
      content: <DesignCodesStep preferences={preferences} setPreferences={setPreferences} />
    },
    {
      id: 'ready',
      title: 'You\'re all set!',
      subtitle: 'Let\'s start analyzing structures',
      content: <ReadyStep />
    }
  ], [preferences]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // Save preferences to localStorage
    localStorage.setItem('beamlab_onboarding_complete', 'true');
    localStorage.setItem('beamlab_user_preferences', JSON.stringify(preferences));
    onComplete(preferences);
  };

  const handleSkip = () => {
    localStorage.setItem('beamlab_onboarding_complete', 'true');
    onSkip?.();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Escape key to skip onboarding
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-2 text-sm"
      >
        Skip for now <X className="w-4 h-4" />
      </button>

      {/* Main Content */}
      <div className="relative w-full max-w-2xl mx-auto px-6">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center gap-2 mt-8 mb-12">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-8 bg-blue-500' 
                  : index < currentStep 
                    ? 'bg-blue-500/50' 
                    : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-3">
              {steps[currentStep].title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-10">
              {steps[currentStep].subtitle}
            </p>
            
            <div className="min-h-[300px] flex items-center justify-center">
              {steps[currentStep].content}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-12">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
              currentStep === 0
                ? 'text-slate-500 cursor-not-allowed'
                : 'text-slate-600 dark:text-slate-300 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/25"
          >
            {currentStep === steps.length - 1 ? (
              <>Open Dashboard <Sparkles className="w-4 h-4" /></>
            ) : (
              <>Continue <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STEP COMPONENTS
// ============================================

const WelcomeStep: FC = () => (
  <div className="space-y-8">
    <div className="flex justify-center gap-6">
      {[
        { icon: <Zap className="w-8 h-8" />, label: 'Ultra-Fast Analysis', color: 'blue' },
        { icon: <Target className="w-8 h-8" />, label: 'Professional Accuracy', color: 'purple' },
        { icon: <Layers className="w-8 h-8" />, label: '3D Visualization', color: 'cyan' }
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800`}
        >
          <div className={`p-4 rounded-xl bg-${item.color}-500/20 text-${item.color}-400`}>
            {item.icon}
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
        </motion.div>
      ))}
    </div>
    
    <div className="flex items-center justify-center gap-4 pt-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Play className="w-4 h-4" /> Watch 2-min intro
      </motion.button>
    </div>
  </div>
);

const RoleStep: FC<{
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}> = ({ preferences, setPreferences }) => {
  const roles = [
    { id: 'student', icon: <GraduationCap className="w-6 h-6" />, label: 'Student / Learning', desc: 'Academic use or learning structural analysis' },
    { id: 'professional', icon: <Briefcase className="w-6 h-6" />, label: 'Professional Engineer', desc: 'Working on real-world projects' },
    { id: 'enterprise', icon: <Users className="w-6 h-6" />, label: 'Team / Enterprise', desc: 'Organization with multiple users' }
  ];

  return (
    <div className="grid gap-4 w-full max-w-md">
      {roles.map((role) => (
        <motion.button
          key={role.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setPreferences(prev => ({ ...prev, role: role.id as any }))}
          className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
            preferences.role === role.id
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-700'
          }`}
        >
          <div className={`p-3 rounded-lg ${
            preferences.role === role.id ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            {role.icon}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-900 dark:text-white">{role.label}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{role.desc}</p>
          </div>
          {preferences.role === role.id && (
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
          )}
        </motion.button>
      ))}
    </div>
  );
};

const ExperienceStep: FC<{
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}> = ({ preferences, setPreferences }) => {
  const levels = [
    { id: 'beginner', label: 'Beginner', desc: 'New to structural analysis', features: 'Guided mode, tutorials, simplified UI' },
    { id: 'intermediate', label: 'Intermediate', desc: '1-5 years of experience', features: 'Standard interface, common workflows' },
    { id: 'expert', label: 'Expert', desc: '5+ years, advanced user', features: 'Power user features, keyboard shortcuts, custom workflows' }
  ];

  return (
    <div className="grid gap-4 w-full max-w-md">
      {levels.map((level) => (
        <motion.button
          key={level.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setPreferences(prev => ({ ...prev, experience: level.id as any }))}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            preferences.experience === level.id
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <p className="font-semibold text-zinc-900 dark:text-white">{level.label}</p>
            {preferences.experience === level.id && (
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{level.desc}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{level.features}</p>
        </motion.button>
      ))}
    </div>
  );
};

const UseCaseStep: FC<{
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}> = ({ preferences, setPreferences }) => {
  const useCases = [
    'Buildings & Frames', 'Bridges', 'Trusses', 'Industrial Structures',
    'Residential', 'Foundations', 'Steel Structures', 'RC Structures'
  ];

  const toggleUseCase = (useCase: string) => {
    setPreferences(prev => ({
      ...prev,
      primaryUse: prev.primaryUse.includes(useCase)
        ? prev.primaryUse.filter(u => u !== useCase)
        : [...prev.primaryUse, useCase]
    }));
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-lg">
      {useCases.map((useCase) => (
        <motion.button
          key={useCase}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => toggleUseCase(useCase)}
          className={`px-5 py-3 rounded-full border-2 font-medium transition-all ${
            preferences.primaryUse.includes(useCase)
              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          {useCase}
        </motion.button>
      ))}
    </div>
  );
};

const DesignCodesStep: FC<{
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}> = ({ preferences, setPreferences }) => {
  const codes = [
    { id: 'IS', label: 'IS (Indian)', codes: 'IS 456, IS 800, IS 1893' },
    { id: 'AISC', label: 'AISC (USA)', codes: 'AISC 360, ACI 318' },
    { id: 'EC', label: 'Eurocode (EU)', codes: 'EC2, EC3, EC8' },
    { id: 'AS', label: 'AS (Australian)', codes: 'AS 4100, AS 3600' },
    { id: 'CSA', label: 'CSA (Canadian)', codes: 'CSA S16, CSA A23.3' },
    { id: 'BS', label: 'BS (British)', codes: 'BS 5950, BS 8110' }
  ];

  const toggleCode = (code: string) => {
    setPreferences(prev => ({
      ...prev,
      designCodes: prev.designCodes.includes(code)
        ? prev.designCodes.filter(c => c !== code)
        : [...prev.designCodes, code]
    }));
  };

  return (
    <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
      {codes.map((code) => (
        <motion.button
          key={code.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toggleCode(code.id)}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            preferences.designCodes.includes(code.id)
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-start">
            <p className="font-semibold text-zinc-900 dark:text-white text-sm">{code.label}</p>
            {preferences.designCodes.includes(code.id) && (
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{code.codes}</p>
        </motion.button>
      ))}
    </div>
  );
};

const ReadyStep: FC = () => (
  <div className="text-center space-y-6">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', duration: 0.5 }}
      className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center"
    >
      <CheckCircle2 className="w-12 h-12 text-white" />
    </motion.div>
    
    <div className="space-y-2">
      <p className="text-slate-600 dark:text-slate-300">Your dashboard is configured and ready.</p>
      <p className="text-slate-500 dark:text-slate-400 text-sm">You can always change these settings later.</p>
    </div>

    <div className="flex flex-wrap justify-center gap-3 pt-4">
      <div className="px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-400">
        🎯 Personalized dashboard
      </div>
      <div className="px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-400">
        📚 Relevant tutorials
      </div>
      <div className="px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-400">
        ⚙️ Pre-configured codes
      </div>
    </div>
  </div>
);

// ============================================
// HOOK FOR ONBOARDING CHECK
// ============================================

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem('beamlab_onboarding_complete');
    const savedPrefs = localStorage.getItem('beamlab_user_preferences');
    
    queueMicrotask(() => {
      if (!completed) {
        setShowOnboarding(true);
      }
      
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    });
  }, []);

  const completeOnboarding = (prefs: UserPreferences) => {
    setPreferences(prefs);
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('beamlab_onboarding_complete');
    localStorage.removeItem('beamlab_user_preferences');
    setShowOnboarding(true);
    setPreferences(null);
  };

  return {
    showOnboarding,
    preferences,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
};

export default OnboardingFlow;
