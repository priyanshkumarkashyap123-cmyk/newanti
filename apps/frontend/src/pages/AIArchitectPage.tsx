/**
 * AIArchitectPage.tsx — AI-Powered Website Design Agent
 *
 * Premium three-panel workspace:
 * - Left: Conversational chat interface
 * - Center: Live website preview renderer
 * - Right: Metrics sidebar (SEO, Accessibility, Performance gauges)
 *
 * Uses a simulated AI agent for demo; ready for real API integration.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Download,
  Share2,
  Wand2,
  Search,
  Shield,
  Gauge,
  Smartphone,
  Eye,
  FileCode2,
  ArrowLeft,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Accessibility,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AIArchitectChatPanel, ChatMessage } from '../components/ai-architect/AIArchitectChatPanel';
import { AIArchitectPreview } from '../components/ai-architect/AIArchitectPreview';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MetricGauge {
  label: string;
  score: number;
  maxScore: number;
  icon: typeof Search;
  color: string;
  status: 'pass' | 'warning' | 'fail';
}

interface ChecklistItem {
  label: string;
  checked: boolean;
  severity: 'info' | 'warning' | 'error';
}

// ─────────────────────────────────────────────
// Demo HTML Templates
// ─────────────────────────────────────────────

const DEMO_TEMPLATES: Record<string, string> = {
  'saas': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="AI-powered SaaS platform for modern teams">
  <title>CloudFlow — Workflow Automation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; }
    .hero { min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%); color: white; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
    .hero-content { max-width: 700px; }
    .badge { display: inline-block; background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.3); color: #a78bfa; padding: 4px 12px; border-radius: 999px; font-size: 12px; margin-bottom: 24px; font-weight: 600; }
    h1 { font-size: 3.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 16px; background: linear-gradient(to right, #fff, #c4b5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 1.1rem; color: rgba(255,255,255,0.7); margin-bottom: 32px; line-height: 1.6; }
    .cta-row { display: flex; gap: 12px; justify-content: center; }
    .btn-primary { padding: 12px 28px; border-radius: 12px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; font-weight: 600; border: none; font-size: 14px; cursor: pointer; box-shadow: 0 8px 24px rgba(124,58,237,0.3); }
    .btn-secondary { padding: 12px 28px; border-radius: 12px; background: rgba(255,255,255,0.1); color: white; font-weight: 600; border: 1px solid rgba(255,255,255,0.2); font-size: 14px; cursor: pointer; backdrop-filter: blur(4px); }
    .features { padding: 80px 24px; background: #f8fafc; }
    .features-grid { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .feature-card { background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; }
    .feature-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; font-size: 20px; }
    .feature-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 13px; color: #64748b; line-height: 1.5; }
    .section-title { text-align: center; margin-bottom: 48px; }
    .section-title h2 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .section-title p { color: #64748b; font-size: 14px; }
    @media (max-width: 768px) { h1 { font-size: 2rem; } .features-grid { grid-template-columns: 1fr; } .cta-row { flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <section class="hero" role="banner">
      <div class="hero-content">
        <span class="badge">✨ Now with AI Automation</span>
        <h1>Automate your workflow with intelligence</h1>
        <p class="subtitle">CloudFlow connects your tools, automates repetitive tasks, and gives your team superpowers. Built for modern teams who move fast.</p>
        <div class="cta-row">
          <button class="btn-primary">Start Free Trial</button>
          <button class="btn-secondary">Watch Demo</button>
        </div>
      </div>
    </section>
    <section class="features" aria-label="Features">
      <div class="section-title">
        <h2>Everything you need</h2>
        <p>Powerful features to transform your workflow</p>
      </div>
      <div class="features-grid">
        <div class="feature-card"><div class="feature-icon">⚡</div><h3>Lightning Fast</h3><p>Sub-second response times with our globally distributed edge network.</p></div>
        <div class="feature-card"><div class="feature-icon">🔒</div><h3>Enterprise Security</h3><p>SOC 2 Type II certified with end-to-end encryption for all data.</p></div>
        <div class="feature-card"><div class="feature-icon">🤖</div><h3>AI Automation</h3><p>Smart workflows that learn from your patterns and optimize automatically.</p></div>
      </div>
    </section>
  </main>
</body>
</html>`,
  'ecommerce': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Premium online store with curated collections">
  <title>Luxe Store — Premium Fashion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #1a1a2e; }
    nav { padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .nav-links a { margin-left: 24px; text-decoration: none; color: #555; font-size: 13px; font-weight: 500; }
    .hero { height: 80vh; background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #f5f3ff 100%); display: flex; align-items: center; padding: 0 64px; }
    .hero-text { max-width: 500px; }
    .hero-text h1 { font-size: 3rem; font-weight: 800; line-height: 1.1; margin-bottom: 16px; }
    .hero-text p { font-size: 15px; color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
    .btn { padding: 14px 32px; border-radius: 999px; font-weight: 600; font-size: 13px; border: none; cursor: pointer; }
    .btn-dark { background: #1a1a2e; color: white; }
    .products { padding: 64px 32px; max-width: 1100px; margin: 0 auto; }
    .products h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 32px; text-align: center; }
    .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .product-card { border-radius: 16px; overflow: hidden; border: 1px solid #f1f1f1; }
    .product-img { height: 200px; background: linear-gradient(135deg, #f0f0f0, #e8e8e8); display: flex; align-items: center; justify-content: center; font-size: 40px; }
    .product-info { padding: 16px; }
    .product-info h3 { font-size: 14px; font-weight: 600; }
    .product-info .price { font-size: 16px; font-weight: 800; color: #7c3aed; margin-top: 4px; }
    @media (max-width: 768px) { .product-grid { grid-template-columns: repeat(2, 1fr); } .hero { padding: 32px; } .hero-text h1 { font-size: 2rem; } }
  </style>
</head>
<body>
  <nav role="navigation"><span class="logo">LUXE</span><div class="nav-links"><a href="#shop">Shop</a><a href="#new">New In</a><a href="#about">About</a><a href="#cart">Cart (0)</a></div></nav>
  <main>
    <section class="hero" role="banner"><div class="hero-text"><h1>New Season. New Style.</h1><p>Discover our curated collection of premium fashion essentials, designed for the modern professional.</p><button class="btn btn-dark">Shop Now →</button></div></section>
    <section class="products" aria-label="Featured Products"><h2>Featured Collection</h2><div class="product-grid">
      <div class="product-card"><div class="product-img">👕</div><div class="product-info"><h3>Essential Tee</h3><p class="price">$49</p></div></div>
      <div class="product-card"><div class="product-img">👗</div><div class="product-info"><h3>Silk Midi Dress</h3><p class="price">$189</p></div></div>
      <div class="product-card"><div class="product-img">🧥</div><div class="product-info"><h3>Wool Blazer</h3><p class="price">$299</p></div></div>
      <div class="product-card"><div class="product-img">👜</div><div class="product-info"><h3>Leather Tote</h3><p class="price">$159</p></div></div>
    </div></section>
  </main>
</body>
</html>`,
  'portfolio': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Creative portfolio showcasing design work">
  <title>Alex Portfolio — Designer & Developer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #0f172a; color: white; }
    .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%); top: -200px; right: -200px; }
    .hero::after { content: ''; position: absolute; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(14,165,233,0.1), transparent 70%); bottom: -100px; left: -100px; }
    .hero-inner { position: relative; z-index: 1; }
    .avatar { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #0ea5e9); margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; font-size: 40px; border: 3px solid rgba(255,255,255,0.1); }
    .name { font-size: 2.5rem; font-weight: 800; margin-bottom: 8px; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .tagline { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 32px; }
    .work-grid { padding: 80px 32px; max-width: 1000px; margin: 0 auto; }
    .work-grid h2 { font-size: 1.5rem; margin-bottom: 32px; text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .work-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; backdrop-filter: blur(8px); }
    .work-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .work-card p { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 600; background: rgba(124,58,237,0.2); color: #a78bfa; margin-top: 12px; margin-right: 4px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } .name { font-size: 1.8rem; } }
  </style>
</head>
<body>
  <main>
    <section class="hero" role="banner"><div class="hero-inner"><div class="avatar">🎨</div><h1 class="name">Alex Chen</h1><p class="tagline">Designer & Developer crafting digital experiences</p></div></section>
    <section class="work-grid" aria-label="Portfolio"><h2>Selected Work</h2><div class="grid">
      <div class="work-card"><h3>Brand Identity — TechCorp</h3><p>Complete visual identity system including logo, typography, and brand guidelines.</p><span class="tag">Branding</span><span class="tag">Design System</span></div>
      <div class="work-card"><h3>E-Commerce Platform</h3><p>Full-stack e-commerce solution with real-time inventory and payment processing.</p><span class="tag">React</span><span class="tag">Node.js</span></div>
      <div class="work-card"><h3>Mobile Banking App</h3><p>Redesigned mobile banking experience increasing user engagement by 40%.</p><span class="tag">UX Design</span><span class="tag">Fintech</span></div>
      <div class="work-card"><h3>Dashboard Analytics</h3><p>Real-time analytics dashboard for monitoring business KPIs and metrics.</p><span class="tag">Data Viz</span><span class="tag">D3.js</span></div>
    </div></section>
  </main>
</body>
</html>`,
};

// ─────────────────────────────────────────────
// Agent Response Simulation
// ─────────────────────────────────────────────

function detectTemplate(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('saas') || lower.includes('landing') || lower.includes('startup')) return 'saas';
  if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('store') || lower.includes('shop')) return 'ecommerce';
  if (lower.includes('portfolio') || lower.includes('personal') || lower.includes('designer') || lower.includes('developer')) return 'portfolio';
  // Default to SaaS for any other description
  return 'saas';
}

function generateAgentResponse(userMessage: string): { reply: string; template: string | null } {
  const template = detectTemplate(userMessage);
  const templateNames: Record<string, string> = {
    saas: 'SaaS Landing Page',
    ecommerce: 'E-Commerce Storefront',
    portfolio: 'Creative Portfolio',
  };

  if (template) {
    return {
      reply: `I've designed a **${templateNames[template]}** based on your description. The preview is live on the right panel.\n\n✅ Semantic HTML5 structure\n✅ Responsive layout (try device toggles)\n✅ SEO meta tags included\n✅ WCAG-compliant color contrast\n✅ Performance-optimized CSS\n\nWant me to modify the hero section, add more features, or optimize for a specific goal?`,
      template,
    };
  }

  return {
    reply: "I'd be happy to help! Could you describe the type of website you'd like — for example, a SaaS landing page, an e-commerce store, or a portfolio site?",
    template: null,
  };
}

// ─────────────────────────────────────────────
// Circular Gauge Component
// ─────────────────────────────────────────────

function CircularGauge({ score, maxScore, label, color, size = 64 }: {
  score: number;
  maxScore: number;
  label: string;
  color: string;
  size?: number;
}) {
  const percentage = Math.round((score / maxScore) * 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const statusColor =
    percentage >= 90 ? '#10b981' :
    percentage >= 70 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="4"
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={statusColor}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: statusColor }}>
            {percentage}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────

export default function AIArchitectPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const msgIdRef = useRef(0);

  // Metrics state
  const [metrics, setMetrics] = useState<MetricGauge[]>([
    { label: 'SEO Score', score: 0, maxScore: 100, icon: Search, color: '#10b981', status: 'fail' as const },
    { label: 'Accessibility', score: 0, maxScore: 100, icon: Accessibility, color: '#7c3aed', status: 'fail' as const },
    { label: 'Performance', score: 0, maxScore: 100, icon: Gauge, color: '#0ea5e9', status: 'fail' as const },
    { label: 'Mobile First', score: 0, maxScore: 100, icon: Smartphone, color: '#f59e0b', status: 'fail' as const },
  ]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: 'Meta title & description', checked: false, severity: 'info' },
    { label: 'Open Graph tags', checked: false, severity: 'info' },
    { label: 'Semantic HTML5', checked: false, severity: 'info' },
    { label: 'Color contrast (WCAG AA)', checked: false, severity: 'warning' },
    { label: 'Alt text on images', checked: false, severity: 'warning' },
    { label: 'Keyboard navigation', checked: false, severity: 'warning' },
    { label: 'Responsive viewport', checked: false, severity: 'info' },
    { label: 'Touch-friendly targets', checked: false, severity: 'info' },
    { label: 'Core Web Vitals ready', checked: false, severity: 'error' },
  ]);

  useEffect(() => {
    document.title = 'AI Architect | BeamLab';
  }, []);

  const updateMetricsForTemplate = useCallback(() => {
    // Simulate metrics after generation
    setMetrics([
      { label: 'SEO Score', score: 92, maxScore: 100, icon: Search, color: '#10b981', status: 'pass' },
      { label: 'Accessibility', score: 88, maxScore: 100, icon: Accessibility, color: '#7c3aed', status: 'pass' },
      { label: 'Performance', score: 95, maxScore: 100, icon: Gauge, color: '#0ea5e9', status: 'pass' },
      { label: 'Mobile First', score: 85, maxScore: 100, icon: Smartphone, color: '#f59e0b', status: 'pass' },
    ]);
    setChecklist([
      { label: 'Meta title & description', checked: true, severity: 'info' },
      { label: 'Open Graph tags', checked: false, severity: 'info' },
      { label: 'Semantic HTML5', checked: true, severity: 'info' },
      { label: 'Color contrast (WCAG AA)', checked: true, severity: 'warning' },
      { label: 'Alt text on images', checked: true, severity: 'warning' },
      { label: 'Keyboard navigation', checked: true, severity: 'warning' },
      { label: 'Responsive viewport', checked: true, severity: 'info' },
      { label: 'Touch-friendly targets', checked: true, severity: 'info' },
      { label: 'Core Web Vitals ready', checked: true, severity: 'error' },
    ]);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: `msg-${++msgIdRef.current}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      // Simulate agent thinking
      await new Promise((r) => setTimeout(r, 1200));

      const { reply, template } = generateAgentResponse(content);

      if (template) {
        setIsGenerating(true);
        // Simulate generation delay
        await new Promise((r) => setTimeout(r, 800));
        setHtmlContent(DEMO_TEMPLATES[template] ?? null);
        setIsGenerating(false);
        updateMetricsForTemplate();
      }

      const agentMsg: ChatMessage = {
        id: `msg-${++msgIdRef.current}`,
        role: 'agent',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setIsTyping(false);
    },
    [updateMetricsForTemplate],
  );

  const handleExportHTML = useCallback(() => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-architect-export.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [htmlContent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200/50 dark:border-slate-700/30 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Wand2 className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">AI Architect</h1>
              <p className="text-[9px] text-slate-400 -mt-0.5">Website Design Agent</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {htmlContent && (
            <>
              <button
                type="button"
                onClick={handleExportHTML}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300 transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-500/30"
              >
                <Download className="w-3 h-3" />
                Export HTML
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-500/10 transition-all"
              >
                <Share2 className="w-3 h-3" />
                Share
              </button>
            </>
          )}
        </div>
      </header>

      {/* Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Chat */}
        <div className="w-[340px] min-w-[280px] border-r border-slate-200/50 dark:border-slate-700/30 p-3 flex flex-col">
          <AIArchitectChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
          />
        </div>

        {/* Center Panel — Preview */}
        <div className="flex-1 p-3 flex flex-col min-w-0">
          <AIArchitectPreview htmlContent={htmlContent} isGenerating={isGenerating} />
        </div>

        {/* Right Panel — Metrics Sidebar */}
        <div className="w-[260px] min-w-[220px] border-l border-slate-200/50 dark:border-slate-700/30 p-3 overflow-y-auto">
          <div className="space-y-4">
            {/* Gauges */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Quality Metrics</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((m) => (
                  <CircularGauge
                    key={m.label}
                    score={m.score}
                    maxScore={m.maxScore}
                    label={m.label}
                    color={m.color}
                  />
                ))}
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Compliance Checklist</h3>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    {item.checked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : item.severity === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <span
                      className={
                        item.checked
                          ? 'text-slate-500 dark:text-slate-400 line-through'
                          : 'text-slate-600 dark:text-slate-300'
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            {htmlContent && (
              <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Page Stats</h3>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">HTML Size</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {(htmlContent.length / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Est. Load Time</span>
                    <span className="font-medium text-emerald-600">0.4s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sections</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {(htmlContent.match(/<section/g) || []).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ARIA Roles</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {(htmlContent.match(/role="/g) || []).length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
