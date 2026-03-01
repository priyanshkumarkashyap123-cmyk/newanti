/**
 * PowerAIPanel.tsx
 * 
 * 🚀 NEXT-GENERATION AI INTERFACE
 * 
 * C-Suite Approved Features:
 * - Confidence scores with visual indicators
 * - Expert/Assistant/Mentor mode toggle
 * - Smart suggestions based on context
 * - Quick actions panel
 * - AI performance dashboard
 * - Enhanced reasoning visualization
 * 
 * This is the most powerful AI interface in structural engineering software
 */

import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  Settings,
  Zap,
  Target,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Code,
  BookOpen,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Shield,
  Award,
  Gauge,
  ArrowRight,
  Star,
  Building2,
  Calculator,
  Compass,
  Maximize2,
  Minimize2,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Mic,
  MicOff,
  X,
  Play,
  Layers,
  Grid3X3,
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { geminiAI } from '../../services/GeminiAIService';
import { 
  aiPowerEngine, 
  AIConfidenceScore, 
  SmartSuggestion, 
  ExpertModeSettings 
} from '../../services/AIPowerEngine';
import { getErrorMessage } from '../../lib/errorHandling';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: AIConfidenceScore;
  reasoning?: {
    steps: string[];
    codeReferences: string[];
    calculations?: string;
  };
  wasHelpful?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  command: string;
  category: 'create' | 'analyze' | 'optimize' | 'check';
  description: string;
}

// ============================================
// CONFIDENCE INDICATOR
// ============================================

const ConfidenceIndicator: FC<{ score: AIConfidenceScore; compact?: boolean }> = ({ 
  score, 
  compact = false 
}) => {
  const getConfidenceColor = (value: number) => {
    if (value >= 85) return 'text-green-400 bg-green-400/20';
    if (value >= 70) return 'text-blue-400 bg-blue-400/20';
    if (value >= 50) return 'text-amber-400 bg-amber-400/20';
    return 'text-red-400 bg-red-400/20';
  };

  const getConfidenceLabel = (value: number) => {
    if (value >= 85) return 'High Confidence';
    if (value >= 70) return 'Good Confidence';
    if (value >= 50) return 'Moderate';
    return 'Verify Recommended';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getConfidenceColor(score.overall)}`}>
        <Gauge className="w-3 h-3" />
        <span>{score.overall}%</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200/50 dark:border-slate-700/50"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${score.overall >= 70 ? 'text-green-400' : 'text-amber-400'}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {getConfidenceLabel(score.overall)}
          </span>
        </div>
        <div className={`text-lg font-bold ${getConfidenceColor(score.overall).split(' ')[0]}`}>
          {score.overall}%
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Code Compliance</span>
          <span className={score.codeCompliance >= 70 ? 'text-green-400' : 'text-amber-400'}>
            {score.codeCompliance}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Engineering Logic</span>
          <span className={score.engineeringLogic >= 70 ? 'text-green-400' : 'text-amber-400'}>
            {score.engineeringLogic}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Calculation Accuracy</span>
          <span className={score.calculationAccuracy >= 70 ? 'text-green-400' : 'text-amber-400'}>
            {score.calculationAccuracy}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Context Relevance</span>
          <span className={score.contextRelevance >= 70 ? 'text-green-400' : 'text-amber-400'}>
            {score.contextRelevance}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// SMART SUGGESTION CARD
// ============================================

const SmartSuggestionCard: FC<{
  suggestion: SmartSuggestion;
  onSelect: (command: string) => void;
}> = ({ suggestion, onSelect }) => {
  const priorityColors = {
    critical: 'border-red-500/50 bg-red-500/10',
    high: 'border-amber-500/50 bg-amber-500/10',
    medium: 'border-blue-500/50 bg-blue-500/10',
    low: 'border-slate-500/50 bg-slate-500/10',
  };

  const typeIcons = {
    quick_action: <Zap className="w-4 h-4 text-amber-400" />,
    optimization: <TrendingUp className="w-4 h-4 text-green-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-red-400" />,
    tip: <Lightbulb className="w-4 h-4 text-blue-400" />,
    next_step: <ArrowRight className="w-4 h-4 text-cyan-400" />,
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => suggestion.command && onSelect(suggestion.command)}
      className={`w-full p-3 rounded-lg border text-left transition-all ${priorityColors[suggestion.priority]} hover:bg-opacity-20`}
    >
      <div className="flex items-start gap-2">
        {typeIcons[suggestion.type]}
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{suggestion.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{suggestion.description}</div>
        </div>
        {suggestion.contextMatch > 80 && (
          <Star className="w-3 h-3 text-amber-400" />
        )}
      </div>
    </motion.button>
  );
};

// ============================================
// QUICK ACTIONS GRID
// ============================================

const QuickActionsGrid: FC<{
  actions: QuickAction[];
  onSelect: (command: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}> = ({ actions, onSelect, activeCategory, onCategoryChange }) => {
  const categories = [
    { id: 'all', label: 'All', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'create', label: 'Create', icon: <Building2 className="w-4 h-4" /> },
    { id: 'analyze', label: 'Analyze', icon: <Calculator className="w-4 h-4" /> },
    { id: 'optimize', label: 'Optimize', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'check', label: 'Check', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const filteredActions = activeCategory === 'all' 
    ? actions 
    : actions.filter(a => a.category === activeCategory);

  return (
    <div className="space-y-3">
      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-violet-600 text-white'
                : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredActions.map(action => (
          <motion.button
            key={action.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(action.command)}
            className="flex flex-col items-center p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
          >
            <span className="text-2xl mb-1">{action.icon}</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{action.label}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{action.description}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ============================================
// EXPERT MODE TOGGLE
// ============================================

const ExpertModeToggle: FC<{
  settings: ExpertModeSettings;
  onChange: (settings: Partial<ExpertModeSettings>) => void;
}> = ({ settings, onChange }) => {
  const modes = [
    { id: 'assistant', label: 'Assistant', description: 'Detailed explanations', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'expert', label: 'Expert', description: 'Concise responses', icon: <Zap className="w-4 h-4" /> },
    { id: 'mentor', label: 'Mentor', description: 'Educational mode', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onChange({ mode: mode.id as ExpertModeSettings['mode'] })}
            className={`flex-1 flex flex-col items-center p-2 rounded-lg transition-all ${
              settings.mode === mode.id
                ? 'bg-violet-600/20 border border-violet-500/50 text-violet-400'
                : 'bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {mode.icon}
            <span className="text-xs font-medium mt-1">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Show Calculations</span>
          <input
            type="checkbox"
            checked={settings.showCalculations}
            onChange={(e) => onChange({ showCalculations: e.target.checked })}
            className="rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-500"
          />
        </label>
        <label className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Show Code References</span>
          <input
            type="checkbox"
            checked={settings.showCodeReferences}
            onChange={(e) => onChange({ showCodeReferences: e.target.checked })}
            className="rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-500"
          />
        </label>
        <label className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Auto-Execute Actions</span>
          <input
            type="checkbox"
            checked={settings.autoExecute}
            onChange={(e) => onChange({ autoExecute: e.target.checked })}
            className="rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-500"
          />
        </label>
      </div>
    </div>
  );
};

// ============================================
// MESSAGE COMPONENT
// ============================================

const MessageBubble: FC<{
  message: Message;
  onFeedback: (messageId: string, helpful: boolean) => void;
}> = ({ message, onFeedback }) => {
  const isUser = message.role === 'user';
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`p-3 rounded-2xl ${
            isUser
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-200/50 dark:border-slate-700/50'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* AI Response Extras */}
        {!isUser && (
          <div className="mt-2 space-y-2">
            {/* Confidence Score */}
            {message.confidence && (
              <ConfidenceIndicator score={message.confidence} compact />
            )}

            {/* Reasoning Steps */}
            {message.reasoning && message.reasoning.steps.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>View reasoning ({message.reasoning.steps.length} steps)</span>
                </button>
                
                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 space-y-1"
                    >
                      {message.reasoning.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-violet-400 font-mono">{idx + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                      
                      {message.reasoning.codeReferences.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <span className="text-xs text-slate-500 dark:text-slate-400">📚 Code References:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {message.reasoning.codeReferences.map((ref, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-200/50 dark:bg-slate-700/50 rounded text-xs text-cyan-400">
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Feedback Buttons */}
            {message.wasHelpful === undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Was this helpful?</span>
                <button
                  onClick={() => onFeedback(message.id, true)}
                  className="p-1 rounded hover:bg-green-500/20 text-slate-500 dark:text-slate-400 hover:text-green-400"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, false)}
                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-400"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] text-slate-500 dark:text-slate-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN POWER AI PANEL
// ============================================

export const PowerAIPanel: FC = () => {
  // State
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [expertSettings, setExpertSettings] = useState<ExpertModeSettings>(aiPowerEngine.getExpertSettings());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Model store
  const nodes = useModelStore(s => s.nodes);
  const members = useModelStore(s => s.members);
  const loads = useModelStore(s => s.loads);

  // Effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Get smart suggestions based on model state
    const newSuggestions = aiPowerEngine.getSmartSuggestions({
      nodeCount: nodes.size,
      memberCount: members.size,
      loadCount: loads?.length || 0,
      hasAnalysisResults: false,
    });
    setSuggestions(newSuggestions);
  }, [nodes.size, members.size, loads?.length]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `# 🚀 BeamLab Power AI

Welcome to the **most powerful AI** in structural engineering!

## Features:
- 🎯 **Confidence Scores** - Know how reliable each response is
- 🧠 **Expert Mode** - Toggle between Assistant/Expert/Mentor
- ⚡ **Quick Actions** - One-click common operations
- 💡 **Smart Suggestions** - Context-aware recommendations

**Ready to build something amazing?**`,
        timestamp: new Date(),
        confidence: {
          overall: 100,
          codeCompliance: 100,
          engineeringLogic: 100,
          calculationAccuracy: 100,
          contextRelevance: 100,
          breakdown: [],
        },
      }]);
    }
  }, []);

  // Handlers
  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const startTime = Date.now();

    try {
      // Get model context
      const nodeArray = Array.from(nodes.values()).map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        hasSupport: !!n.restraints && Object.values(n.restraints).some(v => v),
      }));
      
      const memberArray = Array.from(members.values()).map(m => ({
        id: m.id,
        startNode: m.startNodeId,
        endNode: m.endNodeId,
        section: m.sectionId,
      }));

      const context = {
        nodes: nodeArray,
        members: memberArray,
        loads: loads || [],
      };

      // Call AI
      const result = await geminiAI.processUserQuery(input.trim(), context);

      // Calculate confidence
      const confidence = aiPowerEngine.calculateConfidence(
        input.trim(),
        result.response,
        {
          hasModel: nodeArray.length > 0,
          hasAnalysisResults: false,
          structureType: undefined,
        }
      );

      // Extract reasoning from response
      const reasoning = {
        steps: extractReasoningSteps(result.response),
        codeReferences: extractCodeReferences(result.response),
      };

      // Format response based on expert mode
      const formattedResponse = aiPowerEngine.formatResponseForExpertMode(
        result.response,
        reasoning.steps.join('\n'),
        reasoning.codeReferences,
        []
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formattedResponse,
        timestamp: new Date(),
        confidence,
        reasoning,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Record for analytics
      const responseTime = Date.now() - startTime;
      aiPowerEngine.recordQuery(
        input.trim(),
        result.response,
        confidence.overall >= 70,
        responseTime,
        confidence.overall
      );

    } catch (error: unknown) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Error:** ${getErrorMessage(error, 'Something went wrong')}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionSelect = (command: string) => {
    setInput(command);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleFeedback = (messageId: string, helpful: boolean) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, wasHelpful: helpful } : m
      )
    );
    // Could also send to analytics here
  };

  const handleExpertSettingsChange = (settings: Partial<ExpertModeSettings>) => {
    const newSettings = { ...expertSettings, ...settings };
    setExpertSettings(newSettings);
    aiPowerEngine.setExpertMode(newSettings);
  };

  // Quick actions
  const quickActions = aiPowerEngine.getQuickActions();

  // Panel size classes
  const panelClasses = isFullscreen
    ? 'fixed inset-4 z-50'
    : 'w-96';

  return (
    <motion.div
      layout
      className={`bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl overflow-hidden flex flex-col ${panelClasses}`}
      style={{ maxHeight: isFullscreen ? 'calc(100vh - 32px)' : '700px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-violet-600/20 to-cyan-600/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Power AI
              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded text-[10px] font-bold">
                PRO
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {expertSettings.mode === 'expert' ? 'Expert Mode' : 
               expertSettings.mode === 'mentor' ? 'Mentor Mode' : 'Assistant Mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-all ${
              showSettings ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-800/50 overflow-hidden"
          >
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">AI Mode</h3>
              <ExpertModeToggle
                settings={expertSettings}
                onChange={handleExpertSettingsChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="p-3 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Smart Suggestions</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {suggestions.slice(0, 3).map(suggestion => (
              <SmartSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onSelect={handleSuggestionSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            onFeedback={handleFeedback}
          />
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl rounded-bl-sm border border-slate-200/50 dark:border-slate-700/50 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                <span className="text-sm">Thinking with engineering precision...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions Toggle */}
      {showQuickActions && messages.length <= 2 && (
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Quick Actions</span>
            </div>
            <button
              onClick={() => setShowQuickActions(false)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <QuickActionsGrid
            actions={quickActions}
            onSelect={handleSuggestionSelect}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask anything about structural engineering..."
              rows={1}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className="p-3 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Performance indicator */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>AI Ready</span>
            </div>
            <span>•</span>
            <span>Powered by Gemini</span>
          </div>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="text-violet-400 hover:text-violet-300"
          >
            {showQuickActions ? 'Hide' : 'Show'} Quick Actions
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractReasoningSteps(response: string): string[] {
  const steps: string[] = [];
  
  // Look for numbered steps
  const numberedMatches = response.match(/\d+\.\s+[^\n]+/g);
  if (numberedMatches) {
    steps.push(...numberedMatches.slice(0, 5));
  }

  // Look for bullet points
  const bulletMatches = response.match(/[-•]\s+[^\n]+/g);
  if (bulletMatches && steps.length < 3) {
    steps.push(...bulletMatches.slice(0, 3));
  }

  return steps;
}

function extractCodeReferences(response: string): string[] {
  const refs: string[] = [];
  
  // IS codes
  const isMatches = response.match(/IS\s*\d+(?::\d+)?/gi);
  if (isMatches) refs.push(...[...new Set(isMatches)]);

  // AISC/ACI
  const aiscMatches = response.match(/AISC\s*\d+|ACI\s*\d+/gi);
  if (aiscMatches) refs.push(...[...new Set(aiscMatches)]);

  // Eurocode
  const euroMatches = response.match(/EN\s*\d+|Eurocode\s*\d+/gi);
  if (euroMatches) refs.push(...[...new Set(euroMatches)]);

  return refs.slice(0, 5);
}

export default PowerAIPanel;
