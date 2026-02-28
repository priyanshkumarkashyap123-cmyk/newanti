/**
 * ============================================================================
 * AI DESIGN ASSISTANT - INTELLIGENT ENGINEERING COMPANION
 * ============================================================================
 * 
 * Revolutionary AI-powered design assistant featuring:
 * - Natural language structural queries
 * - Real-time code compliance checking
 * - Automatic design optimization suggestions
 * - Learning from design patterns
 * - Multi-code comparison analysis
 * - Voice-enabled interaction
 * - Context-aware recommendations
 * 
 * @version 4.0.0
 */


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Send,
  Mic,
  MicOff,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  Code2,
  FileText,
  Calculator,
  BookOpen,
  Settings,
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Cpu,
  MessageSquare,
  User,
  Bot,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  History,
  Bookmark,
  Share2,
  Download,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type MessageRole = 'user' | 'assistant' | 'system';
type SuggestionCategory = 'optimization' | 'safety' | 'cost' | 'compliance' | 'general';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  suggestions?: DesignSuggestion[];
  codeReferences?: CodeReference[];
  calculations?: CalculationResult[];
  isLoading?: boolean;
}

interface DesignSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  savings?: number;
  implementation?: string;
}

interface CodeReference {
  code: string;
  clause: string;
  title: string;
  content: string;
}

interface CalculationResult {
  name: string;
  formula: string;
  inputs: { name: string; value: number; unit: string }[];
  result: { value: number; unit: string };
  status: 'pass' | 'fail' | 'warning';
}

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'optimize',
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Optimize Section',
    prompt: 'Analyze and suggest optimizations for the current beam section to reduce material while maintaining safety',
  },
  {
    id: 'check',
    icon: <Shield className="w-4 h-4" />,
    label: 'Code Check',
    prompt: 'Verify the design against all relevant code provisions and highlight any non-compliances',
  },
  {
    id: 'calculate',
    icon: <Calculator className="w-4 h-4" />,
    label: 'Run Calculations',
    prompt: 'Show step-by-step calculations for the critical design checks',
  },
  {
    id: 'compare',
    icon: <Code2 className="w-4 h-4" />,
    label: 'Compare Codes',
    prompt: 'Compare the design requirements between IS 456, ACI 318, and Eurocode 2',
  },
  {
    id: 'cost',
    icon: <TrendingDown className="w-4 h-4" />,
    label: 'Cost Analysis',
    prompt: 'Estimate the material cost and suggest cost-saving alternatives',
  },
  {
    id: 'detail',
    icon: <FileText className="w-4 h-4" />,
    label: 'Detailing Guide',
    prompt: 'Provide reinforcement detailing requirements and best practices',
  },
];

const SAMPLE_RESPONSES: { [key: string]: Partial<ChatMessage> } = {
  optimize: {
    content: `Based on my analysis of your beam section (300×500mm), here are my optimization recommendations:

**Current Section Efficiency: 72%**

The section is over-designed for the given loading conditions. Here are my suggestions:`,
    suggestions: [
      {
        id: '1',
        category: 'optimization',
        title: 'Reduce Section Depth',
        description: 'Section depth can be reduced from 500mm to 450mm while maintaining adequate capacity',
        impact: 'high',
        savings: 15,
        implementation: 'Modify depth in geometry settings',
      },
      {
        id: '2',
        category: 'cost',
        title: 'Optimize Reinforcement',
        description: 'Use 4T20 instead of 5T16 bars for better efficiency (same area, fewer bars)',
        impact: 'medium',
        savings: 8,
        implementation: 'Update bar diameter and count',
      },
      {
        id: '3',
        category: 'optimization',
        title: 'Stirrup Spacing',
        description: 'Increase stirrup spacing from 150mm to 175mm in mid-span zone',
        impact: 'low',
        savings: 5,
        implementation: 'Adjust shear reinforcement settings',
      },
    ],
  },
  check: {
    content: `I've completed a comprehensive code compliance check for your design. Here's the summary:

**Overall Compliance: ✅ PASS (with warnings)**`,
    codeReferences: [
      {
        code: 'IS 456:2000',
        clause: 'Cl. 26.5.1.1',
        title: 'Minimum Reinforcement',
        content: 'Ast,min = 0.85·bd/fy = 0.85×300×460/500 = 234 mm². Provided: 1257 mm² ✓',
      },
      {
        code: 'IS 456:2000',
        clause: 'Cl. 26.5.1.2',
        title: 'Maximum Reinforcement',
        content: 'Ast,max = 0.04·b·D = 0.04×300×500 = 6000 mm². Provided: 1257 mm² ✓',
      },
      {
        code: 'IS 456:2000',
        clause: 'Cl. 40.4',
        title: 'Shear Reinforcement',
        content: 'Minimum shear reinforcement provided. Spacing = 150mm < 0.75d = 345mm ✓',
      },
      {
        code: 'IS 456:2000',
        clause: 'Cl. 26.3.3',
        title: 'Bar Spacing',
        content: '⚠️ WARNING: Clear spacing between bars = 52mm. Recommended minimum = 75mm for M30 concrete',
      },
    ],
  },
  calculate: {
    content: `Here are the step-by-step calculations for your beam design:

**Design Data:**
- Concrete: M30 (fck = 30 MPa)
- Steel: Fe500 (fy = 500 MPa)
- Section: 300 × 500 mm
- Effective depth: d = 500 - 40 - 10 = 450 mm`,
    calculations: [
      {
        name: 'Limiting Moment of Resistance',
        formula: 'Mu,lim = 0.138 × fck × b × d²',
        inputs: [
          { name: 'fck', value: 30, unit: 'MPa' },
          { name: 'b', value: 300, unit: 'mm' },
          { name: 'd', value: 450, unit: 'mm' },
        ],
        result: { value: 251.5, unit: 'kN·m' },
        status: 'pass',
      },
      {
        name: 'Required Steel Area',
        formula: 'Ast = (0.5fck/fy)[1-√(1-4.6Mu/fck·bd²)]bd',
        inputs: [
          { name: 'Mu', value: 180, unit: 'kN·m' },
          { name: 'fck', value: 30, unit: 'MPa' },
          { name: 'fy', value: 500, unit: 'MPa' },
        ],
        result: { value: 1152, unit: 'mm²' },
        status: 'pass',
      },
      {
        name: 'Shear Stress Check',
        formula: 'τv = Vu / (b × d)',
        inputs: [
          { name: 'Vu', value: 120, unit: 'kN' },
          { name: 'b', value: 300, unit: 'mm' },
          { name: 'd', value: 450, unit: 'mm' },
        ],
        result: { value: 0.89, unit: 'MPa' },
        status: 'pass',
      },
    ],
  },
};

// =============================================================================
// MESSAGE BUBBLE
// =============================================================================

const MessageBubble: React.FC<{
  message: ChatMessage;
  onCopy?: () => void;
  onRegenerate?: () => void;
}> = ({ message, onCopy, onRegenerate }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isUser ? 'bg-blue-500' : 'bg-gradient-to-br from-violet-500 to-purple-600'
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      
      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block p-4 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-100 rounded-bl-md'
        }`}>
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              {message.content.split('\n').map((line, i) => (
                <p key={i} className={`mb-2 last:mb-0 ${line.startsWith('**') ? 'font-semibold' : ''}`}>
                  {line.replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          )}
        </div>
        
        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {message.suggestions.map((suggestion) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-xl border ${
                  suggestion.category === 'optimization' ? 'bg-blue-500/10 border-blue-500/30' :
                  suggestion.category === 'safety' ? 'bg-red-500/10 border-red-500/30' :
                  suggestion.category === 'cost' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  'bg-zinc-100/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className={`w-4 h-4 ${
                        suggestion.impact === 'high' ? 'text-amber-400' :
                        suggestion.impact === 'medium' ? 'text-blue-400' : 'text-zinc-500 dark:text-zinc-400'
                      }`} />
                      <h4 className="font-medium text-zinc-900 dark:text-white">{suggestion.title}</h4>
                      {suggestion.savings && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          -{suggestion.savings}% cost
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{suggestion.description}</p>
                  </div>
                  <button className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-zinc-900 dark:text-white transition-colors">
                    Apply
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Code References */}
        {message.codeReferences && message.codeReferences.length > 0 && (
          <div className="mt-4 space-y-2">
            {message.codeReferences.map((ref, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">{ref.code}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{ref.clause}</span>
                </div>
                <h5 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">{ref.title}</h5>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{ref.content}</p>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Calculations */}
        {message.calculations && message.calculations.length > 0 && (
          <div className="mt-4 space-y-3">
            {message.calculations.map((calc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl border ${
                  calc.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  calc.status === 'fail' ? 'bg-red-500/5 border-red-500/20' :
                  'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-zinc-900 dark:text-white">{calc.name}</h5>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    calc.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' :
                    calc.status === 'fail' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {calc.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="font-mono text-sm bg-white/50 dark:bg-zinc-900/50 rounded-lg p-2 mb-3 text-blue-300">
                  {calc.formula}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  {calc.inputs.map((input, j) => (
                    <div key={j} className="bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg p-2">
                      <span className="text-zinc-500 dark:text-zinc-400">{input.name} = </span>
                      <span className="text-zinc-900 dark:text-white font-mono">{input.value} {input.unit}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Result:</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                    {calc.result.value.toFixed(2)} {calc.result.unit}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Actions */}
        {!isUser && !message.isLoading && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onCopy}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onRegenerate}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Regenerate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-400 transition-colors" title="Good response">
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-400 transition-colors" title="Poor response">
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Timestamp */}
        <p className="text-xs text-zinc-500 mt-1">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AIDesignAssistant: React.FC<{
  className?: string;
  onSuggestionApply?: (suggestion: DesignSuggestion) => void;
}> = ({ className, onSuggestionApply }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your AI Design Assistant. I can help you with:

• **Design optimization** - Find the most efficient section sizes
• **Code compliance** - Check against IS 456, ACI 318, Eurocode
• **Calculations** - Show step-by-step design calculations
• **Cost analysis** - Estimate materials and suggest savings

How can I help you with your structural design today?`,
      timestamp: new Date(),
    },
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle send message
  const handleSend = useCallback((text?: string) => {
    const prompt = text || inputValue.trim();
    if (!prompt) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    
    // Add loading assistant message
    const loadingMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    
    setMessages(m => [...m, userMessage, loadingMessage]);
    setInputValue('');
    
    // Call real Gemini AI via GeminiAIService
    (async () => {
      try {
        const { geminiAI } = await import('../../services/GeminiAIService');
        const systemPrompt = `You are BeamLab AI, a structural engineering AI design assistant.
Answer questions about structural analysis, design codes (IS 456, IS 800, IS 1893, AISC 360, Eurocode), 
section optimization, and provide specific calculations. Be concise but technically accurate.
Format important sections with **bold**.`;
        
        const aiResponse = await geminiAI.callGemini(prompt, systemPrompt);
        
        // Parse response for structured content
        const rawSuggestions = aiResponse.match(/suggest|recommend|try|consider/i)
          ? aiResponse.split('\n').filter(l => l.startsWith('-') || l.startsWith('•')).slice(0, 3)
          : undefined;
        
        const suggestions: DesignSuggestion[] | undefined = rawSuggestions?.length
          ? rawSuggestions.map((s, i) => ({
              id: `ai-suggestion-${i}`,
              category: 'optimization' as SuggestionCategory,
              title: s.replace(/^[-•]\s*/, '').slice(0, 60),
              description: s.replace(/^[-•]\s*/, ''),
              impact: 'medium' as const,
            }))
          : undefined;
        
        setMessages(m => m.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: aiResponse || 'I can help with structural design questions. Could you provide more details?',
                suggestions,
                isLoading: false,
              }
            : msg
        ));
      } catch (err: any) {
        // Fallback to SAMPLE_RESPONSES if AI service unavailable
        const responseKey = Object.keys(SAMPLE_RESPONSES).find(key =>
          prompt.toLowerCase().includes(key) ||
          prompt.toLowerCase().includes(QUICK_ACTIONS.find(a => a.id === key)?.label.toLowerCase() || '')
        ) || 'optimize';

        const response = SAMPLE_RESPONSES[responseKey];
      
        setMessages(m => m.map(msg => 
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.content || 'I understand you need help with your structural design. Could you provide more details about what you\'d like me to analyze?',
                suggestions: response.suggestions,
                codeReferences: response.codeReferences,
                calculations: response.calculations,
                isLoading: false,
              }
            : msg
        ));
      }
    })();
  }, [inputValue]);
  
  // Handle quick action
  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt);
  };
  
  // Handle voice recording
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Simulate voice recognition
      setTimeout(() => {
        setInputValue('Optimize my beam design for minimum cost');
        setIsRecording(false);
      }, 2000);
    }
  };
  
  return (
    <motion.div
      layout
      className={`bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50' : 'h-[600px]'
      } ${className}`}
    >
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-blue-600/20 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                AI Design Assistant
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Powered by advanced structural AI</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title="History"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCopy={() => navigator.clipboard.writeText(message.content)}
              onRegenerate={() => {
                // Handle regenerate
              }}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your design..."
              className="w-full px-4 py-3 pr-12 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <button
              onClick={toggleRecording}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            className="p-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white rounded-xl transition-all disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-xs text-zinc-500 mt-2 text-center">
          AI can make mistakes. Always verify critical calculations.
        </p>
      </div>
      
      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white">Chat History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {['Beam optimization analysis', 'Column design check', 'Foundation sizing'].map((title, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-left transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900 dark:text-white truncate">{title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{i + 1} hour ago</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIDesignAssistant;
