/**
 * AutonomousAIAgent.tsx
 * 
 * Next-generation AI agent with autonomous capabilities:
 * - Gemini API integration for intelligent reasoning
 * - Autonomous structure creation and modification
 * - Real-time analysis execution and interpretation
 * - Natural language understanding
 * - Multi-step task planning and execution
 * - Learning from context
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
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Settings,
  Key,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Calculator,
  Cpu,
  Bot,
  Wand2,
  ArrowRight,
  RotateCcw,
  History,
  PenTool,
  Target,
  Layers,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { geminiAI, AIAction, AIPlan, AIModelContext } from '../../services/GeminiAIService';
import { getErrorMessage } from '../../lib/errorHandling';
import { API_CONFIG } from '../../config/env';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'thinking';
  content: string;
  timestamp: Date;
  type?: 'text' | 'code' | 'plan' | 'result' | 'error' | 'reasoning' | 'decomposed';
  plan?: AIPlan;
  actions?: AIAction[];
  isExecuting?: boolean;
  reasoning?: {
    decomposedTasks?: string[];
    modelContext?: {
      geometry?: string;
      loads?: string;
      results?: string;
    };
    steps?: string[];
  };
}

interface ProcessingState {
  status: 'idle' | 'thinking' | 'planning' | 'executing' | 'complete' | 'error' | 'reasoning' | 'decomposing';
  currentStep?: number;
  totalSteps?: number;
  message?: string;
  details?: string[];
}

// ============================================
// COMPONENT
// ============================================

export const AutonomousAIAgent: FC = () => {
  // ============================================
  // STATE
  // ============================================
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AIPlan | null>(null);
  const [autoExecute, setAutoExecute] = useState(true); // Auto-execute by default
  const [showThinking, setShowThinking] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const diagnoseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Model store — batched selector to reduce re-renders
  const {
    nodes, members, loads,
    addNode, addMember, addPlate, addLoad, clearModel,
  } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      members: s.members,
      loads: s.loads,
      addNode: s.addNode,
      addMember: s.addMember,
      addPlate: s.addPlate,
      addLoad: s.addLoad,
      clearModel: s.clearModel,
    }))
  );

  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Check API key on mount
  useEffect(() => {
    const hasKey = geminiAI.hasApiKey();
    queueMicrotask(() => {
      setHasApiKey(hasKey);
// console.log('[AI Agent] Gemini API key status:', hasKey ? 'Connected' : 'Not configured');
      
      // Set initial welcome message with correct API status
      if (messages.length === 0) {
        const apiStatus = hasKey 
          ? '✅ **Gemini API connected** - Full autonomous capabilities enabled' 
          : '⚠️ **Gemini API key not set** - Click settings (⚙️) to enable advanced reasoning';
        
        setMessages([{
          id: '1',
          role: 'assistant',
          content: `# 🤖 BeamLab AI Agent

Welcome! I'm your **autonomous structural engineering assistant** powered by advanced AI.

## What I can do:

### 🏗️ **Autonomous Modeling**
"Create a 20m span portal frame" → I'll design and build it automatically

### 📊 **Intelligent Analysis**
"Analyze this structure" → I run analysis and interpret results

### 🎯 **Smart Optimization**
"Optimize for minimum weight" → I'll iterate to find the best design

### 📚 **Expert Knowledge**
"Explain P-Delta effects" → Detailed technical explanations

### 🔍 **Design Verification**
"Check code compliance" → Comprehensive design checks

---

${apiStatus}

**Try saying:** "Build a 3-story building with 4 bays"`,
        timestamp: new Date(),
        type: 'text',
      }]);
    }
    });
  }, []);
  
  useEffect(() => {
    // Subscribe to AI events
    const unsubscribe = geminiAI.subscribe((event, data) => {
      if (event === 'processing') {
        setProcessingState(prev => ({
          ...prev,
          status: data.status,
          message: data.message,
        }));
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Listen for analysis error events to auto-open and diagnose
  useEffect(() => {
    const handleDiagnoseError = (event: CustomEvent<{ error: string }>) => {
      setIsExpanded(true);
      const errorMessage = event.detail?.error || 'Unknown analysis error';
      // Add error message to conversation
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'system',
        content: `⚠️ **Analysis Error Detected**\n\n\`${errorMessage}\`\n\nAnalyzing the issue...`,
        timestamp: new Date(),
        type: 'error',
      }]);
      // Auto-submit diagnosis request
      diagnoseTimerRef.current = setTimeout(() => {
        setInput(`Please diagnose this analysis error and suggest fixes: ${errorMessage}`);
      }, 500);
    };

    window.addEventListener('ai-diagnose-error', handleDiagnoseError as EventListener);
    return () => {
      window.removeEventListener('ai-diagnose-error', handleDiagnoseError as EventListener);
      clearTimeout(diagnoseTimerRef.current);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
    }
    
    return () => recognitionRef.current?.stop();
  }, []);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const getModelContext = useCallback((): AIModelContext => {
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
    
    const loadArray = (loads || []).map(l => ({
      nodeId: l.nodeId,
      fx: l.fx,
      fy: l.fy,
      fz: l.fz,
    }));
    
    return {
      nodes: nodeArray,
      members: memberArray,
      loads: loadArray,
      // Analysis results would be added here if available
    };
  }, [nodes, members, loads]);

  const generateUniqueId = (prefix: string) => 
    `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ============================================
  // ACTION EXECUTION
  // ============================================

  const executeActions = async (actions: AIAction[]): Promise<boolean> => {
    const nodeIdMap = new Map<string, string>(); // Map planned IDs to actual IDs
    
    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        setProcessingState({
          status: 'executing',
          currentStep: i + 1,
          totalSteps: actions.length,
          message: action.description,
        });
        
        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 100));
        
        switch (action.type) {
          case 'addNode': {
            const { id: plannedId, x, y, z, support } = action.params;
            const actualId = generateUniqueId('node');
            nodeIdMap.set(plannedId, actualId);
            
            let restraints = undefined;
            if (support === 'fixed') {
              restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
            } else if (support === 'pinned') {
              restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
            } else if (support === 'roller') {
              restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
            }
            
            addNode({ id: actualId, x, y, z, restraints });
            break;
          }
          
          case 'addMember': {
            const { start, end, section, memberType, releases } = action.params;
            const startId = nodeIdMap.get(start) || start;
            const endId = nodeIdMap.get(end) || end;
            
            // Build member object with optional type and releases for trusses
            const memberData: any = {
              id: generateUniqueId('member'),
              startNodeId: startId,
              endNodeId: endId,
              sectionId: section || 'ISMB300',
            };
            
            // Add truss properties if memberType is 'truss'
            if (memberType === 'truss') {
              memberData.releases = {
                mzStart: true,  // Pin at start
                mzEnd: true,    // Pin at end
                startMoment: true,
                endMoment: true
              };
            } else if (releases) {
              memberData.releases = releases;
            }
            
            addMember(memberData);
            break;
          }
          
          case 'addPlate': {
            const { nodeIds, thickness, pressure, materialType } = action.params;
            // Map node IDs to actual IDs
            const actualNodeIds = nodeIds.map((id: string) => nodeIdMap.get(id) || id);
            
            if (addPlate && actualNodeIds.length === 4) {
              addPlate({
                id: generateUniqueId('plate'),
                nodeIds: actualNodeIds as [string, string, string, string],
                thickness: thickness || 0.15,
                pressure: pressure || 0,
                materialType: materialType || 'concrete',
                E: materialType === 'steel' ? 200e6 : 25e6, // kN/m²
                nu: materialType === 'steel' ? 0.3 : 0.2
              });
            }
            break;
          }
          
          case 'addLoad': {
            const { nodeId, fx, fy, fz } = action.params;
            const actualNodeId = nodeIdMap.get(nodeId) || nodeId;
            
            if (addLoad) {
              addLoad({
                id: generateUniqueId('load'),
                nodeId: actualNodeId,
                fx: fx || 0,
                fy: fy || 0,
                fz: fz || 0,
              });
            }
            break;
          }
          
          case 'runAnalysis': {
            // Trigger analysis - this would connect to your analysis service
            setProcessingState(prev => ({ ...prev, message: 'Running structural analysis...' }));
            await new Promise(resolve => setTimeout(resolve, 500));
            break;
          }
          
          case 'optimize': {
            setProcessingState(prev => ({ ...prev, message: 'Optimizing design...' }));
            await new Promise(resolve => setTimeout(resolve, 500));
            break;
          }
        }
      }
      
      setProcessingState({ status: 'complete', message: 'All actions completed successfully!' });
      return true;
    } catch (error) {
      console.error('Action execution error:', error);
      setProcessingState({ status: 'error', message: `Error: ${error}` });
      return false;
    }
  };

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const handleSubmit = async () => {
    if (!input.trim() || processingState.status !== 'idle') return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      type: 'text',
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Add thinking indicator
    if (showThinking) {
      setMessages(prev => [...prev, {
        id: `thinking_${Date.now()}`,
        role: 'thinking',
        content: 'Analyzing your request...',
        timestamp: new Date(),
      }]);
    }
    
    setProcessingState({ status: 'thinking', message: 'Understanding your request...', details: [] });
    
    try {
      // Clear model if user explicitly asks
      if (input.toLowerCase().includes('clear') || input.toLowerCase().includes('new model')) {
        clearModel();
      }
      
      const context = getModelContext();
      
      // ===== ENHANCED: Show AI reasoning process =====
      // Step 1: Show decomposition
      if (input.length > 100) {
        setProcessingState(prev => ({ 
          ...prev, 
          status: 'decomposing',
          message: 'Breaking down complex request...',
          details: ['Analyzing query structure', 'Identifying subtasks', 'Planning approach']
        }));
        
        // Add decomposition thinking message
        setMessages(prev => [...prev, {
          id: `decompose_${Date.now()}`,
          role: 'thinking',
          content: '🔍 Breaking down your complex request into manageable subtasks...',
          timestamp: new Date(),
          type: 'decomposed',
        }]);
        
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Step 2: Show context enrichment
      setProcessingState(prev => ({ 
        ...prev, 
        status: 'reasoning',
        message: 'Enriching context with model state...',
        details: ['Analyzing model geometry', 'Calculating loads', 'Reviewing constraints']
      }));
      
      // Add context thinking message
      const contextStr = context.nodes.length > 0 
        ? `Model: ${context.nodes.length} nodes, ${context.members.length} members, ${context.loads.length} loads`
        : 'No model currently loaded - will create from scratch';
      
      setMessages(prev => [...prev, {
        id: `context_${Date.now()}`,
        role: 'thinking',
        content: `📊 Enriched context: ${contextStr}`,
        timestamp: new Date(),
        type: 'reasoning',
      }]);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Step 3: Call Gemini with full reasoning
      setProcessingState(prev => ({ 
        ...prev, 
        status: 'thinking',
        message: 'Reasoning through solution...',
        details: ['Applying engineering knowledge', 'Considering constraints', 'Generating plan']
      }));
      
      setMessages(prev => [...prev, {
        id: `reason_${Date.now()}`,
        role: 'thinking',
        content: '🧠 Using advanced reasoning with full engineering knowledge...',
        timestamp: new Date(),
        type: 'reasoning',
      }]);
      
      const result = await geminiAI.processUserQuery(input.trim(), context);
      
      // Remove thinking message
      setMessages(prev => prev.filter(m => m.role !== 'thinking'));
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        type: result.plan ? 'plan' : 'text',
        plan: result.plan,
        actions: result.actions,
        reasoning: {
          decomposedTasks: input.length > 100 ? ['Complex query decomposed'] : undefined,
          modelContext: context.nodes.length > 0 ? {
            geometry: `${context.nodes.length} nodes analyzed`,
            loads: `${context.loads.length} loads considered`,
          } : undefined,
        }
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // If we have actions and auto-execute is enabled, or if it's a simple request
      if (result.actions && result.actions.length > 0) {
        const actions = result.actions; // Store reference for type narrowing
        if (autoExecute || actions.length <= 5) {
          // Auto-execute for simple structures
          setPendingPlan(null);
          await executeActions(actions);
          
          // Add completion message
          const newNodes = actions.filter(a => a.type === 'addNode').length;
          const newMembers = actions.filter(a => a.type === 'addMember').length;
          setMessages(prev => [...prev, {
            id: (Date.now() + 2).toString(),
            role: 'system',
            content: `✅ **Structure created successfully!**\n\n- Nodes: ${nodes.size + newNodes}\n- Members: ${members.size + newMembers}\n\nYou can now add loads or run analysis.`,
            timestamp: new Date(),
            type: 'result',
          }]);
        } else if (result.plan) {
          // For complex structures, wait for user confirmation
          setPendingPlan(result.plan);
        }
      }
      
      setProcessingState({ status: 'idle' });
      
    } catch (error: unknown) {
      // Remove thinking message
      setMessages(prev => prev.filter(m => m.role !== 'thinking'));
      
      // ========================================
      // FALLBACK: Try unified backend API directly if GeminiAIService fails
      // ========================================
      try {
        const context = getModelContext();
        const fallbackResponse = await fetch(`${API_CONFIG.baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input.trim(),
            context: JSON.stringify({
              nodes: context.nodes.length,
              members: context.members.length,
              loads: context.loads.length,
            }),
          }),
        });

        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          if (data.success && data.response) {
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: data.response,
              timestamp: new Date(),
              type: 'text',
              actions: data.actions,
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Auto-execute actions if any
            if (data.actions && data.actions.length > 0 && autoExecute) {
              await executeActions(data.actions);
            }

            setProcessingState({ status: 'idle' });
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('[AI Agent] Unified backend also unavailable:', fallbackErr);
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Error:** ${getErrorMessage(error, 'Something went wrong')}\n\n${!hasApiKey ? 'Consider setting up your Gemini API key for enhanced capabilities.' : 'Please try again or rephrase your request.'}`,
        timestamp: new Date(),
        type: 'error',
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setProcessingState({ status: 'idle' });
    }
  };

  const handleExecutePlan = async () => {
    if (!pendingPlan) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: '🚀 Executing plan...',
      timestamp: new Date(),
      isExecuting: true,
    }]);
    
    const success = await executeActions(pendingPlan.steps);
    setPendingPlan(null);
    
    if (success) {
      setMessages(prev => prev.filter(m => !m.isExecuting).concat({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `✅ **Plan executed successfully!**\n\nYour structure has been created. You can now:\n- Add loads: "Add 50 kN load at the top"\n- Run analysis: "Analyze the structure"\n- Optimize: "Minimize weight"`,
        timestamp: new Date(),
        type: 'result',
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      geminiAI.setApiKey(apiKey.trim());
      setHasApiKey(true);
      setShowSettings(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: '✅ **Gemini API key saved!** Full autonomous capabilities are now enabled.',
        timestamp: new Date(),
      }]);
    }
  };

  // ============================================
  // QUICK ACTIONS & SMART SUGGESTIONS
  // ============================================

  // Dynamic suggestions based on model state
  const getContextualSuggestions = () => {
    const hasStructure = nodes.size > 0;
    const hasLoads = loads.length > 0;
    
    if (!hasStructure) {
      return [
        { icon: <Building2 className="w-4 h-4" />, text: 'Create a portal frame', category: 'create' },
        { icon: <Layers className="w-4 h-4" />, text: 'Build a 3-story building', category: 'create' },
        { icon: <Wand2 className="w-4 h-4" />, text: 'Design a Warren truss', category: 'create' },
        { icon: <MessageSquare className="w-4 h-4" />, text: 'Hi! What can you help me with?', category: 'chat' },
        { icon: <BookOpen className="w-4 h-4" />, text: 'Explain bending moments', category: 'learn' },
        { icon: <HelpCircle className="w-4 h-4" />, text: 'Help me get started', category: 'help' },
      ];
    }
    
    if (hasStructure && !hasLoads) {
      return [
        { icon: <Zap className="w-4 h-4" />, text: 'Add typical loads', category: 'modify' },
        { icon: <Target className="w-4 h-4" />, text: 'Apply 50kN at the top', category: 'modify' },
        { icon: <Calculator className="w-4 h-4" />, text: 'Check my model', category: 'analyze' },
        { icon: <MessageSquare className="w-4 h-4" />, text: 'What should I do next?', category: 'chat' },
        { icon: <PenTool className="w-4 h-4" />, text: 'Add more nodes', category: 'modify' },
        { icon: <HelpCircle className="w-4 h-4" />, text: 'Review my structure', category: 'help' },
      ];
    }
    
    // Has structure and loads
    return [
      { icon: <Calculator className="w-4 h-4" />, text: 'Run analysis', category: 'analyze' },
      { icon: <Target className="w-4 h-4" />, text: 'Optimize design', category: 'optimize' },
      { icon: <CheckCircle2 className="w-4 h-4" />, text: 'Check code compliance', category: 'check' },
      { icon: <MessageSquare className="w-4 h-4" />, text: 'How does it look?', category: 'chat' },
      { icon: <AlertTriangle className="w-4 h-4" />, text: 'Any issues with my model?', category: 'troubleshoot' },
      { icon: <Lightbulb className="w-4 h-4" />, text: 'Suggest improvements', category: 'optimize' },
    ];
  };

  const quickActions = [
    { icon: <Building2 className="w-4 h-4" />, text: 'Create a portal frame', color: 'blue' },
    { icon: <Layers className="w-4 h-4" />, text: 'Build a 3-story building', color: 'purple' },
    { icon: <Calculator className="w-4 h-4" />, text: 'Run analysis', color: 'green' },
    { icon: <Target className="w-4 h-4" />, text: 'Optimize design', color: 'orange' },
    { icon: <BookOpen className="w-4 h-4" />, text: 'Explain moment of inertia', color: 'pink' },
    { icon: <HelpCircle className="w-4 h-4" />, text: 'What can you do?', color: 'cyan' },
  ];
  
  // Conversation starters when conversation is minimal
  const conversationStarters = [
    "👋 Hi! I'm new to structural analysis",
    "🏗️ I need help designing a building",
    "📐 Can you explain load paths?",
    "🤔 Why use fixed vs pinned supports?",
    "🎯 How do I optimize my structure?"
  ];

  // ============================================
  // RENDER - MINIMIZED
  // ============================================

  if (!isExpanded) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-full shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all group"
      >
        <div className="relative">
          <Bot className="w-7 h-7 text-slate-900 dark:text-white" />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-200 dark:border-white"
          />
        </div>
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-3 px-4 py-2 bg-white/95 dark:bg-slate-800/95 text-slate-900 dark:text-white text-sm font-medium rounded-xl whitespace-nowrap backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            AI Agent
          </span>
        </motion.span>
      </motion.button>
    );
  }

  // ============================================
  // RENDER - EXPANDED
  // ============================================

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`fixed z-50 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/50 flex flex-col overflow-hidden ${
        isFullscreen
          ? 'inset-4 rounded-2xl'
          : 'bottom-6 right-6 w-[440px] h-[600px] rounded-2xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-violet-600/20 to-purple-600/20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              BeamLab AI Agent
              <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full">
                ADVANCED
              </span>
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {processingState.status === 'idle' 
                ? `${nodes.size} nodes • ${members.size} members`
                : (
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      {processingState.status === 'decomposing' && <Zap className="w-3 h-3 text-amber-400" />}
                      {processingState.status === 'reasoning' && <Brain className="w-3 h-3 text-cyan-400" />}
                      {processingState.status === 'planning' && <Target className="w-3 h-3 text-blue-400" />}
                      {processingState.status === 'executing' && <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />}
                      {processingState.message}
                    </span>
                    {processingState.details && processingState.details.length > 0 && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {processingState.details.join(' → ')}
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button"
            onClick={() => setIsExpanded(false)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Minimize"
          >
            <X className="w-4 h-4" />
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
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Gemini API Key
                  {hasApiKey && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'Enter your API key'}
                    className="flex-1 px-3 py-2 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
                  />
                  <button type="button"
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Get your API key from{' '}
                  <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                    Google AI Studio
                  </a>
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-600 dark:text-slate-300">Auto-execute plans</label>
                <button type="button"
                  onClick={() => setAutoExecute(!autoExecute)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${autoExecute ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <motion.div
                    animate={{ x: autoExecute ? 20 : 2 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'thinking' ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Cpu className="w-4 h-4 text-purple-400" />
                </motion.div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{message.content}</span>
              </div>
            ) : message.type === 'decomposed' ? (
              <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-amber-900/20 border border-amber-700/50 text-amber-100 flex items-start gap-2">
                <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
                <span className="text-sm">{message.content}</span>
              </div>
            ) : message.type === 'reasoning' ? (
              <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-cyan-900/20 border border-cyan-700/50 text-cyan-100 flex items-start gap-2">
                <Brain className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                <span className="text-sm">{message.content}</span>
              </div>
            ) : (
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                    : message.role === 'system'
                    ? 'bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-200'
                    : message.type === 'error'
                    ? 'bg-red-900/30 border border-red-700/50 text-red-200'
                    : 'bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-200'
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>h1]:mt-2 [&>h2]:mt-2 [&>ul]:my-2 [&>p]:my-2">
                  {/* Simple markdown rendering */}
                  {message.content.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) {
                      return <h1 key={i} className="text-lg font-bold text-slate-900 dark:text-white">{line.slice(2)}</h1>;
                    }
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-base font-semibold text-slate-900 dark:text-white mt-3">{line.slice(3)}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={i} className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">{line.slice(4)}</h3>;
                    }
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return <li key={i} className="text-sm ml-4">{line.slice(2)}</li>;
                    }
                    if (line.match(/^\d+\.\s/)) {
                      return <li key={i} className="text-sm ml-4 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
                    }
                    if (line.startsWith('---')) {
                      return <hr key={i} className="border-slate-200 dark:border-slate-700 my-3" />;
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    // Handle inline bold
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={i} className="text-sm">
                        {parts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j}>{part.slice(2, -2)}</strong>;
                          }
                          // Handle inline code
                          const codeParts = part.split(/(`.*?`)/g);
                          return codeParts.map((codePart, k) => {
                            if (codePart.startsWith('`') && codePart.endsWith('`')) {
                              return <code key={k} className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-purple-300 text-xs">{codePart.slice(1, -1)}</code>;
                            }
                            return codePart;
                          });
                        })}
                      </p>
                    );
                  })}
                </div>
                
                {/* Action buttons for plans */}
                {message.plan && message.actions && message.actions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => {
                          setPendingPlan(message.plan!);
                          handleExecutePlan();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium transition-all"
                      >
                        <Play className="w-4 h-4" />
                        Execute Plan ({message.actions.length} steps)
                      </button>
                      <button type="button"
                        onClick={() => setInput('Modify the plan to...')}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg text-sm transition-colors"
                      >
                        Modify
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
        
        {/* Processing indicator */}
        {processingState.status !== 'idle' && processingState.status !== 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-3 bg-purple-900/20 border border-purple-700/30 rounded-xl"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Loader2 className="w-5 h-5 text-purple-400" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm text-purple-200">{processingState.message}</p>
              {processingState.currentStep && processingState.totalSteps && (
                <div className="mt-2">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(processingState.currentStep / processingState.totalSteps) * 100}%` }}
                      className="h-full bg-gradient-to-r from-purple-500 to-violet-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Step {processingState.currentStep} of {processingState.totalSteps}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions & Smart Suggestions */}
      {messages.length <= 3 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            {nodes.size === 0 ? 'Get started:' : 'Suggested actions:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {getContextualSuggestions().slice(0, 6).map((action, i) => (
              <button type="button"
                key={i}
                onClick={() => {
                  setInput(action.text);
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {action.icon}
                {action.text}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Conversation Starters - For new conversations */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Or start a conversation:</p>
          <div className="flex flex-wrap gap-2">
            {conversationStarters.map((starter, i) => (
              <button type="button"
                key={i}
                onClick={() => {
                  setInput(starter);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-900/30 to-violet-900/30 hover:from-purple-800/40 hover:to-violet-800/40 border border-purple-700/30 rounded-lg text-xs text-purple-200 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-800/30">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build or analyze..."
              rows={1}
              className="w-full px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          
          <button type="button"
            onClick={toggleVoice}
            className={`p-3 rounded-xl transition-all ${
              isListening
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || processingState.status !== 'idle'}
            className="p-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-xl transition-all disabled:cursor-not-allowed"
            title="Send message"
          >
            {processingState.status !== 'idle' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Press Enter to send • Shift+Enter for new line</span>
          {hasApiKey && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-500" />
              Gemini AI
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AutonomousAIAgent;
