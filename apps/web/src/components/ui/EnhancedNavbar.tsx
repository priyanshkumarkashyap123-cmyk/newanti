/**
 * EnhancedNavbar.tsx
 * 
 * Professional navigation with:
 * - Mega menus for complex navigation
 * - Search with AI-powered suggestions
 * - Notification center
 * - Quick actions
 */

import { FC, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserButton } from '@clerk/clerk-react';
import {
  Search,
  Bell,
  Command,
  ChevronDown,
  Zap,
  Layers,
  BarChart3,
  FileText,
  Settings,
  HelpCircle,
  Sparkles,
  ArrowRight,
  X,
  Box,
  Grid3X3,
  Calculator,
  Building2,
  Ruler,
  FlaskConical,
  BookOpen,
  Users,
  MessageSquare,
  Shield,
  Cpu,
  Globe,
  Clock
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import beamLabLogo from '../../assets/beamlab_logo.png';

// ============================================
// MEGA MENU DATA
// ============================================

const MEGA_MENU_ITEMS = {
  products: {
    title: 'Products',
    sections: [
      {
        title: 'Analysis Tools',
        items: [
          { icon: <Box className="w-5 h-5" />, label: '3D Frame Analysis', desc: 'Full structural modeling', href: '/app' },
          { icon: <Layers className="w-5 h-5" />, label: 'Plate & Shell', desc: 'FEM analysis for plates', href: '/app?mode=plate' },
          { icon: <BarChart3 className="w-5 h-5" />, label: 'Dynamic Analysis', desc: 'Modal & seismic', href: '/app?mode=dynamic' },
          { icon: <Zap className="w-5 h-5" />, label: 'Non-Linear', desc: 'P-Delta & buckling', href: '/app?mode=nonlinear' },
        ]
      },
      {
        title: 'Design Modules',
        items: [
          { icon: <Building2 className="w-5 h-5" />, label: 'Steel Design', desc: 'AISC/IS 800', href: '/design/steel' },
          { icon: <Grid3X3 className="w-5 h-5" />, label: 'Concrete Design', desc: 'ACI/IS 456', href: '/design/concrete' },
          { icon: <Ruler className="w-5 h-5" />, label: 'Connection Design', desc: 'Bolted & welded', href: '/design/connections' },
          { icon: <FlaskConical className="w-5 h-5" />, label: 'Foundation Design', desc: 'Isolated & combined', href: '/design/foundation' },
        ]
      },
      {
        title: 'AI Features',
        items: [
          { icon: <Sparkles className="w-5 h-5" />, label: 'AI Architect', desc: 'Generate from text', href: '/app', badge: 'NEW' },
          { icon: <MessageSquare className="w-5 h-5" />, label: 'AI Assistant', desc: 'Get help instantly', href: '/app' },
          { icon: <Calculator className="w-5 h-5" />, label: 'Smart Optimization', desc: 'Auto-optimize designs', href: '/app' },
        ]
      }
    ]
  },
  resources: {
    title: 'Resources',
    sections: [
      {
        title: 'Learn',
        items: [
          { icon: <BookOpen className="w-5 h-5" />, label: 'Documentation', desc: 'Guides & tutorials', href: '/help' },
          { icon: <FileText className="w-5 h-5" />, label: 'API Reference', desc: 'For developers', href: '/docs/api' },
          { icon: <Users className="w-5 h-5" />, label: 'Community', desc: 'Forums & discussions', href: '/community' },
        ]
      },
      {
        title: 'Support',
        items: [
          { icon: <HelpCircle className="w-5 h-5" />, label: 'Help Center', desc: 'FAQs & guides', href: '/help' },
          { icon: <MessageSquare className="w-5 h-5" />, label: 'Contact Support', desc: 'Get assistance', href: '/contact' },
        ]
      }
    ]
  }
};

// ============================================
// SEARCH SUGGESTIONS
// ============================================

const SEARCH_SUGGESTIONS = [
  { type: 'action', label: 'Create new beam', shortcut: '⌘N' },
  { type: 'action', label: 'Run analysis', shortcut: '⌘R' },
  { type: 'action', label: 'Add point load', shortcut: 'L' },
  { type: 'page', label: 'Go to Dashboard' },
  { type: 'page', label: 'View Reports' },
  { type: 'help', label: 'How to add supports?' },
  { type: 'help', label: 'Modal analysis tutorial' },
];

// ============================================
// COMPONENT
// ============================================

export const EnhancedNavbar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Analysis Complete', desc: 'Project "Bridge Design" analysis finished', time: '2m ago', unread: true },
    { id: 2, title: 'Welcome to Pro!', desc: 'Your trial has been activated', time: '1h ago', unread: true },
  ]);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setActiveMenu(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = searchQuery
    ? SEARCH_SUGGESTIONS.filter(s => 
        s.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : SEARCH_SUGGESTIONS;

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-slate-950/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden shadow-lg group-hover:shadow-blue-500/25 transition-all">
              <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              BeamLab
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="hidden lg:flex items-center gap-1" ref={menuRef}>
            {/* Products Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'products' ? null : 'products')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeMenu === 'products' 
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Products
                <ChevronDown className={`w-4 h-4 transition-transform ${activeMenu === 'products' ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {activeMenu === 'products' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-[700px] p-6 bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl"
                  >
                    <div className="grid grid-cols-3 gap-6">
                      {MEGA_MENU_ITEMS.products.sections.map((section, i) => (
                        <div key={i}>
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            {section.title}
                          </h4>
                          <div className="space-y-1">
                            {section.items.map((item, j) => (
                              <Link
                                key={j}
                                to={item.href}
                                onClick={() => setActiveMenu(null)}
                                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
                              >
                                <div className="p-2 rounded-lg bg-slate-800 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                  {item.icon}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{item.label}</span>
                                    {item.badge && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400">{item.desc}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Featured Banner */}
                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">Try AI Architect</p>
                            <p className="text-xs text-slate-400">Generate structures from natural language</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => { navigate('/app'); setActiveMenu(null); }}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                        >
                          Try Now
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Resources Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'resources' ? null : 'resources')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeMenu === 'resources' 
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Resources
                <ChevronDown className={`w-4 h-4 transition-transform ${activeMenu === 'resources' ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {activeMenu === 'resources' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-[400px] p-6 bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      {MEGA_MENU_ITEMS.resources.sections.map((section, i) => (
                        <div key={i}>
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            {section.title}
                          </h4>
                          <div className="space-y-1">
                            {section.items.map((item, j) => (
                              <Link
                                key={j}
                                to={item.href}
                                onClick={() => setActiveMenu(null)}
                                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
                              >
                                <div className="p-2 rounded-lg bg-slate-800 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                  {item.icon}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-white">{item.label}</span>
                                  <p className="text-xs text-slate-400">{item.desc}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              to="/pricing"
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
            >
              Pricing
            </Link>

            <Link
              to="/demo"
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
            >
              Demo
            </Link>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 rounded">
                <Command className="w-3 h-3" /> K
              </kbd>
            </button>

            {/* Notifications */}
            {isSignedIn && (
              <div className="relative">
                <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>
              </div>
            )}

            {/* Auth Buttons */}
            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-3">
                    <Link
                      to="/app"
                      className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
                    >
                      Open App <ArrowRight className="w-4 h-4" />
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/sign-in"
                      className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/sign-up"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-xl"
            >
              <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                  <Search className="w-5 h-5 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search commands, pages, help..."
                    className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                    autoFocus
                  />
                  <button onClick={() => setSearchOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {filteredSuggestions.length > 0 ? (
                    <div className="p-2">
                      {filteredSuggestions.map((item, i) => (
                        <button
                          key={i}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              item.type === 'action' ? 'bg-blue-500' :
                              item.type === 'page' ? 'bg-green-500' : 'bg-purple-500'
                            }`} />
                            <span className="text-sm text-white">{item.label}</span>
                          </div>
                          {item.shortcut && (
                            <kbd className="px-2 py-1 text-xs text-slate-400 bg-slate-800 rounded">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      No results found
                    </div>
                  )}
                </div>
                
                <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↵</kbd> to select</span>
                  <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">ESC</kbd> to close</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default EnhancedNavbar;
