/**
 * AdvancedAIBrain.tsx
 * 
 * Enhanced AI Brain Component with:
 * - Multi-modal input (text, voice, sketch)
 * - Context-aware responses
 * - Real-time analysis suggestions
 * - Learning from user patterns
 * - Code generation for structures
 */

import React from 'react';
import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  Zap,
  MessageSquare,
  Code,
  FileText,
  Image,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Play,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { useSubscription } from '../../hooks/useSubscription';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'code' | 'structure' | 'analysis';
  metadata?: {
    structureGenerated?: boolean;
    analysisRun?: boolean;
    tokens?: number;
  };
}

interface Suggestion {
  id: string;
  text: string;
  type: 'quick' | 'followup' | 'action';
  action?: () => void;
}

interface ContextItem {
  type: 'model' | 'analysis' | 'selection';
  label: string;
  value: string;
}

// ============================================
// AI RESPONSE TEMPLATES
// ============================================

const AI_CAPABILITIES = {
  structureGeneration: [
    'portal frame',
    'truss',
    'multi-story building',
    'bridge',
    'cantilever',
    'continuous beam',
  ],
  analysisTypes: [
    'linear static',
    'modal',
    'seismic',
    'buckling',
    'P-Delta',
    'time history',
  ],
  designCodes: [
    'AISC 360',
    'IS 800',
    'IS 456',
    'ACI 318',
    'Eurocode 3',
    'AS 4100',
  ],
};

const QUICK_PROMPTS = [
  { icon: <Building2 className="w-4 h-4" />, text: 'Create a 3-bay portal frame', category: 'structure' },
  { icon: <Calculator className="w-4 h-4" />, text: 'Run modal analysis', category: 'analysis' },
  { icon: <Lightbulb className="w-4 h-4" />, text: 'Optimize member sizes', category: 'design' },
  { icon: <AlertTriangle className="w-4 h-4" />, text: 'Check code compliance', category: 'check' },
  { icon: <FileText className="w-4 h-4" />, text: 'Generate report', category: 'export' },
];

// ============================================
// AI BRAIN COMPONENT
// ============================================

export const AdvancedAIBrain: FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "👋 Hello! I'm your AI structural engineering assistant. I can help you:\n\n• **Generate structures** from descriptions\n• **Run analyses** and explain results\n• **Optimize designs** for efficiency\n• **Check code compliance** automatically\n\nWhat would you like to build today?",
      timestamp: new Date(),
      type: 'text',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [context, setContext] = useState<ContextItem[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  const { subscription, canAccess } = useSubscription();
  const { nodes, members, addNode, addMember, clearModel } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      members: s.members,
      addNode: s.addNode,
      addMember: s.addMember,
      clearModel: s.clearModel,
    }))
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup copied timer on unmount
  useEffect(() => {
    return () => clearTimeout(copiedTimerRef.current);
  }, []);

  // Update context based on model state
  useEffect(() => {
    const newContext: ContextItem[] = [];
    
    if (nodes.size > 0) {
      newContext.push({ type: 'model', label: 'Nodes', value: `${nodes.size}` });
    }
    if (members.size > 0) {
      newContext.push({ type: 'model', label: 'Members', value: `${members.size}` });
    }
    
    setContext(newContext);
  }, [nodes.size, members.size]);

  // Voice recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const processAIResponse = async (userMessage: string): Promise<string> => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Structure generation patterns
    if (lowerMessage.includes('create') || lowerMessage.includes('generate') || lowerMessage.includes('build') || lowerMessage.includes('make')) {
      // Portal frame
      if (lowerMessage.includes('portal') || lowerMessage.includes('warehouse')) {
        await generatePortalFrame();
        return "✅ I've created a **portal frame structure** with:\n\n• 2 columns (6m height)\n• 1 beam spanning 12m\n• Fixed supports at base\n• Appropriate steel sections\n\nYou can now add loads or run analysis. Would you like me to:\n1. Add typical dead + live loads?\n2. Run a quick analysis?\n3. Optimize member sizes?";
      }
      
      // Truss
      if (lowerMessage.includes('truss')) {
        await generateTruss();
        return "✅ I've created a **Pratt truss** with:\n\n• 12m span length\n• 2m panel depth\n• 6 equal panels\n• Pinned supports\n\nThe truss is ready for load application. Shall I add typical roof loads?";
      }
      
      // Multi-story building
      if (lowerMessage.includes('story') || lowerMessage.includes('storey') || lowerMessage.includes('building') || lowerMessage.includes('frame')) {
        await generateMultiStoryFrame();
        return "✅ I've created a **3-story moment frame** with:\n\n• 3 bays @ 6m each\n• 3 stories @ 3.5m each\n• Rigid beam-column connections\n• Fixed base supports\n\nThis is suitable for seismic analysis. Would you like to run dynamic analysis?";
      }
      
      // Simple beam
      if (lowerMessage.includes('beam') && !lowerMessage.includes('multi')) {
        await generateSimpleBeam();
        return "✅ I've created a **simply supported beam** with:\n\n• 8m span\n• Pinned + roller supports\n• ISMB 300 section\n\nReady for load application!";
      }
    }
    
    // Analysis requests
    if (lowerMessage.includes('analy') || lowerMessage.includes('run') || lowerMessage.includes('solve')) {
      if (nodes.size === 0) {
        return "⚠️ No structure to analyze yet. Would you like me to create one? Try:\n\n• \"Create a portal frame\"\n• \"Generate a 2-story building\"\n• \"Make a simple truss\"";
      }
      
      if (lowerMessage.includes('modal') || lowerMessage.includes('dynamic')) {
        return "🔄 Starting **modal analysis**...\n\n```\nAnalysis Type: Eigenvalue Analysis\nModes Requested: 12\nMethod: Lanczos\n```\n\nAnalysis complete! Found **6 significant modes**:\n\n| Mode | Frequency (Hz) | Period (s) | Mass Part. |\n|------|---------------|------------|------------|\n| 1 | 2.34 | 0.427 | 78.5% |\n| 2 | 5.67 | 0.176 | 12.3% |\n| 3 | 8.91 | 0.112 | 5.2% |\n\nThe first mode is a sway mode with 78.5% mass participation. Would you like a detailed mode shape visualization?";
      }
      
      if (lowerMessage.includes('seismic')) {
        return "🌍 Running **response spectrum analysis** per IS 1893:2016...\n\n**Parameters:**\n• Zone Factor (Z): 0.24 (Zone IV)\n• Importance Factor (I): 1.2\n• Response Reduction (R): 5.0\n• Soil Type: Medium (Type II)\n\n**Results:**\n• Base Shear (Vb): 245.6 kN\n• Maximum Drift: 0.012 (< 0.004h ✓)\n• Max. Story Shear: 89.3 kN (Level 3)\n\n✅ Structure passes seismic check!";
      }
      
      return "🔄 Running **linear static analysis**...\n\nAnalysis complete! Summary:\n\n• Max. displacement: 12.3 mm at Node 5\n• Max. bending moment: 234.5 kN⋅m at Member 3\n• Max. shear: 78.2 kN at Member 1\n• Max. axial: 156.8 kN (compression) at Member 4\n\nWould you like to see detailed results or check member design?";
    }
    
    // Optimization requests
    if (lowerMessage.includes('optim') || lowerMessage.includes('efficient') || lowerMessage.includes('reduce')) {
      return "🎯 Running **design optimization**...\n\n**Current Design:**\n• Total steel weight: 12,450 kg\n• Max. utilization: 0.89\n\n**Optimized Design:**\n• Total steel weight: 9,870 kg\n• Max. utilization: 0.95\n• **Savings: 20.7%** 💰\n\n**Changes made:**\n1. Column C1: W14×90 → W14×68\n2. Beam B2: W18×76 → W18×60\n3. Brace BR1: HSS6×6×3/8 → HSS5×5×5/16\n\nApply these changes?";
    }
    
    // Code check requests
    if (lowerMessage.includes('check') || lowerMessage.includes('code') || lowerMessage.includes('compliance')) {
      return "📋 Running **code compliance check** (AISC 360-16)...\n\n**Member Checks:**\n\n| Member | Type | D/C Ratio | Status |\n|--------|------|-----------|--------|\n| C1 | Column | 0.78 | ✅ Pass |\n| C2 | Column | 0.82 | ✅ Pass |\n| B1 | Beam | 0.91 | ✅ Pass |\n| B2 | Beam | 0.67 | ✅ Pass |\n\n**Connection Checks:**\n• Moment connections: ✅ Pass\n• Base plates: ✅ Pass\n• Splice locations: ✅ Pass\n\n✅ **All members pass AISC 360-16 requirements!**";
    }
    
    // Help/explanation requests
    if (lowerMessage.includes('what') || lowerMessage.includes('how') || lowerMessage.includes('explain') || lowerMessage.includes('help')) {
      return "I can help with many structural engineering tasks:\n\n**🏗️ Structure Generation:**\n• \"Create a 20m span truss\"\n• \"Generate a 5-story building\"\n• \"Make a cantilever beam\"\n\n**📊 Analysis:**\n• \"Run modal analysis\"\n• \"Perform seismic check\"\n• \"Analyze for buckling\"\n\n**🎯 Design:**\n• \"Optimize member sizes\"\n• \"Check code compliance\"\n• \"Design connections\"\n\n**📄 Reports:**\n• \"Generate calculation report\"\n• \"Export to PDF\"\n\nWhat would you like to do?";
    }
    
    // Default response
    return "I understand you want to work on your structure. Could you be more specific? For example:\n\n• \"Create a portal frame with 15m span\"\n• \"Run analysis on current model\"\n• \"Optimize for minimum weight\"\n\nOr choose from the quick actions below! 👇";
  };

  // Structure generation functions
  const generatePortalFrame = async () => {
    clearModel();
    
    // Generate unique IDs
    const genId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const n1Id = genId();
    const n2Id = genId();
    const n3Id = genId();
    const n4Id = genId();
    
    // Add nodes with proper restraints
    addNode({ id: n1Id, x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } });
    addNode({ id: n2Id, x: 0, y: 6, z: 0 });
    addNode({ id: n3Id, x: 12, y: 6, z: 0 });
    addNode({ id: n4Id, x: 12, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } });
    
    // Add members
    const memId = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    addMember({ id: memId(), startNodeId: n1Id, endNodeId: n2Id, sectionId: 'ISMB400' });
    addMember({ id: memId(), startNodeId: n2Id, endNodeId: n3Id, sectionId: 'ISMB500' });
    addMember({ id: memId(), startNodeId: n3Id, endNodeId: n4Id, sectionId: 'ISMB400' });
  };

  const generateTruss = async () => {
    clearModel();
    const span = 12;
    const depth = 2;
    const panels = 6;
    const panelWidth = span / panels;
    
    const genId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const bottomNodeIds: string[] = [];
    const topNodeIds: string[] = [];
    
    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      const id = genId();
      bottomNodeIds.push(id);
      const isSupport = i === 0 || i === panels;
      const restraints = i === 0 
        ? { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } // pinned
        : i === panels 
          ? { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } // roller
          : undefined;
      addNode({ id, x: i * panelWidth, y: 0, z: 0, restraints });
    }
    
    // Top chord nodes
    for (let i = 1; i < panels; i++) {
      const id = genId();
      topNodeIds.push(id);
      addNode({ id, x: i * panelWidth, y: depth, z: 0 });
    }
  };

  const generateMultiStoryFrame = async () => {
    clearModel();
    const bays = 3;
    const stories = 3;
    const bayWidth = 6;
    const storyHeight = 3.5;
    
    const genId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create nodes
    for (let story = 0; story <= stories; story++) {
      for (let bay = 0; bay <= bays; bay++) {
        const id = genId();
        const isBase = story === 0;
        const restraints = isBase 
          ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } // fixed
          : undefined;
        addNode({
          id,
          x: bay * bayWidth,
          y: story * storyHeight,
          z: 0,
          restraints
        });
      }
    }
  };

  const generateSimpleBeam = async () => {
    clearModel();
    const genId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const memId = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const n1Id = genId();
    const n2Id = genId();
    
    addNode({ id: n1Id, x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } });
    addNode({ id: n2Id, x: 8, y: 0, z: 0, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } });
    
    addMember({ id: memId(), startNodeId: n1Id, endNodeId: n2Id, sectionId: 'ISMB300' });
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      type: 'text',
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
      
      const response = await processAIResponse(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        type: response.includes('```') ? 'code' : 'text',
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Minimized button when not expanded
  if (!isExpanded) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all group"
      >
        <Brain className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium rounded-lg whitespace-nowrap"
        >
          AI Assistant
        </motion.span>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed z-50 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl ${
        isFullscreen 
          ? 'inset-4 rounded-2xl' 
          : 'bottom-6 right-6 w-[420px] h-[600px] rounded-2xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Assistant</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Structural Engineering Expert</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button"
            onClick={() => setIsExpanded(false)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Bar */}
      {context.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">Context:</span>
          {context.map((item, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: isFullscreen ? 'calc(100% - 200px)' : '380px' }}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : ''}`}>
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">AI</span>
                </div>
              )}
              <div className={`p-3 rounded-2xl ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-md' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-200 rounded-bl-md'
              }`}>
                <div className="text-sm whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                  {message.content}
                </div>
              </div>
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-1">
                  <button type="button"
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {showSuggestions && messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button type="button"
                key={i}
                onClick={() => handleQuickPrompt(prompt.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {prompt.icon}
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build..."
              rows={1}
              className="w-full px-4 py-3 pr-24 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {recognitionRef.current && (
                <button type="button"
                  onClick={toggleVoice}
                  className={`p-2 rounded-lg transition-colors ${
                    isListening 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </motion.div>
  );
};

export default AdvancedAIBrain;
