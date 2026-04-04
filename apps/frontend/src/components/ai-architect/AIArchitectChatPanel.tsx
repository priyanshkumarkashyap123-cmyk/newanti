/**
 * AIArchitectChatPanel.tsx — Conversational AI interface for website design agent
 *
 * Features:
 * - Message bubbles (user / agent) with typing indicator
 * - Suggested action chips
 * - Auto-scroll to latest message
 * - Prompt input with send button
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, Bot, User, Lightbulb } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface AIArchitectChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isTyping: boolean;
  onSuggestionClick?: (suggestion: string) => void;
}

const SUGGESTIONS = [
  'Build a SaaS landing page',
  'Create an e-commerce storefront',
  'Design a portfolio website',
  'Generate a blog layout',
  'Build a restaurant website',
  'Design a dashboard UI',
];

export function AIArchitectChatPanel({
  messages,
  onSendMessage,
  isTyping,
  onSuggestionClick,
}: AIArchitectChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  }, [input, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    } else {
      onSendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-r from-violet-500/5 to-blue-500/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">AI Architect</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isTyping ? 'Designing...' : 'Ready to create'}
            </p>
          </div>
          <div className={`ml-auto w-2 h-2 rounded-full ${isTyping ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Describe your dream website
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
                I'll generate the design, layout, SEO tags, and accessibility audit in seconds.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all duration-200 hover:shadow-sm"
                >
                  <Lightbulb className="w-3 h-3 inline mr-1" />
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'agent' && (
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-md shadow-lg shadow-blue-500/10'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-bl-md border border-slate-200/50 dark:border-slate-700/30'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl rounded-bl-md border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Suggestion chips when conversation is active */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200/30 dark:border-slate-700/20">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {['Add hero section', 'Optimize for mobile', 'Generate SEO tags', 'Add dark mode', 'Improve accessibility'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSuggestionClick(chip)}
                className="whitespace-nowrap px-2.5 py-1 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300 transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-500/30"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-200/50 dark:border-slate-700/30 bg-white/30 dark:bg-slate-900/30">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your website…"
            rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/30 outline-none focus:ring-2 focus:ring-violet-500/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 disabled:opacity-40 disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Send message"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
