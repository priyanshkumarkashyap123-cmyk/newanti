/**
 * SitemapPage.tsx - Complete navigation & sitemap page
 * Helps users discover all features and pages in the application
 */

import React, { FC, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink, Home, BarChart3, Building2, Zap, FileText, Users, BookOpen, Cog, Search } from 'lucide-react';
import { SEO } from '../components/SEO';

interface PageSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  pages: {
    title: string;
    path: string;
    description: string;
    badge?: string;
  }[];
}

const PAGE_SECTIONS: PageSection[] = [
  {
    id: 'core',
    title: 'Core Workspace',
    description: 'Main application features',
    icon: <Home className="w-5 h-5" />,
    pages: [
      { title: 'Dashboard', path: '/stream', description: 'Main dashboard and project management' },
      { title: '3D Modeler', path: '/app', description: 'Interactive structural modeling', badge: 'Core' },
      { title: 'My Projects', path: '/stream', description: 'View all your projects' },
    ],
  },
  {
    id: 'analysis',
    title: 'Analysis Modules',
    description: 'Structural analysis and simulation',
    icon: <BarChart3 className="w-5 h-5" />,
    pages: [
      { title: 'Modal Analysis', path: '/analysis/modal', description: 'Dynamic modal analysis' },
      { title: 'Time History', path: '/analysis/time-history', description: 'Earthquake time-history analysis' },
      { title: 'Seismic Analysis', path: '/analysis/seismic', description: 'Seismic design analysis' },
      { title: 'Buckling Analysis', path: '/analysis/buckling', description: 'Elastic & inelastic buckling' },
      { title: 'P-Delta Analysis', path: '/analysis/pdelta', description: 'Second-order P-Delta' },
      { title: 'Nonlinear Analysis', path: '/analysis/nonlinear', description: 'Nonlinear behavior simulation' },
      { title: 'Pushover Analysis', path: '/analysis/pushover', description: 'Nonlinear static pushover' },
      { title: 'Cable Analysis', path: '/analysis/cable', description: 'Cable structure analysis' },
      { title: 'Plate & Shell FEM', path: '/analysis/plate-shell', description: '2D plate/shell analysis', badge: 'New' },
      { title: 'Sensitivity & Optimization', path: '/analysis/sensitivity-optimization', description: 'Parameter optimization' },
    ],
  },
  {
    id: 'design',
    title: 'Design Modules',
    description: 'Member and connection design',
    icon: <Building2 className="w-5 h-5" />,
    pages: [
      { title: 'RC Design', path: '/design/concrete', description: 'Reinforced concrete design per IS 456/ACI' },
      { title: 'Foundation Design', path: '/design/foundation', description: 'Footing analysis and design' },
      { title: 'Steel Design', path: '/design/steel', description: 'Steel member design per AISC/IS 800' },
      { title: 'Connection Design', path: '/design/connections', description: 'Bolted & welded connections' },
      { title: 'Welded Connections', path: '/design/connections', description: 'Fillet & groove weld design (inside Connection Design)' },
      { title: 'Reinforcement Design', path: '/design/reinforcement', description: 'Stirrup and development length' },
      { title: 'RC Detailing', path: '/design/detailing', description: 'Detailed reinforcement drawings' },
      { title: 'Design Center', path: '/design-center', description: 'Unified design interface' },
      { title: 'Post-Analysis Hub', path: '/design-hub', description: 'STAAD.Pro-style workflow' },
    ],
  },
  {
    id: 'tools',
    title: 'Engineering Tools',
    description: 'Calculators and utilities',
    icon: <Zap className="w-5 h-5" />,
    pages: [
      { title: 'Load Combinations', path: '/tools/load-combinations', description: 'IS 1893/ASCE 7 combinations' },
      { title: 'Section Database', path: '/tools/section-database', description: 'ISMB/AISC/IPE properties' },
      { title: 'Bar Bending Schedule', path: '/tools/bar-bending', description: 'IS 2502 BBS generator', badge: 'New' },
      { title: 'Advanced Meshing', path: '/tools/advanced-meshing', description: 'Mesh generation & control' },
      { title: 'Print & Export', path: '/tools/print-export', description: 'Report generation & export' },
      { title: 'Space Planning', path: '/space-planning', description: 'House & facility layout', badge: 'New' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Visualization',
    description: 'Output and presentation',
    icon: <FileText className="w-5 h-5" />,
    pages: [
      { title: 'Reports', path: '/reports', description: 'Report management and generation' },
      { title: 'Report Builder', path: '/reports/builder', description: 'Custom report builder' },
      { title: 'Professional Reports', path: '/reports/professional', description: 'Industry-standard reports' },
      { title: 'Visualization Hub', path: '/visualization', description: 'Visualization options' },
      { title: '3D Engine', path: '/visualization/3d-engine', description: 'Advanced 3D rendering' },
      { title: 'Result Animation', path: '/visualization/result-animation', description: 'Animation playback viewer' },
    ],
  },
  {
    id: 'enterprise',
    title: 'Enterprise Features',
    description: 'Team and integration tools',
    icon: <Users className="w-5 h-5" />,
    pages: [
      { title: 'Collaboration Hub', path: '/collaboration', description: 'Team workspace & projects' },
      { title: 'BIM Integration', path: '/bim', description: 'BIM import/export hub' },
      { title: 'CAD Integration', path: '/cad/integration', description: 'CAD file integration' },
      { title: 'API Integration', path: '/integrations/api-dashboard', description: 'API connections' },
      { title: 'Materials Database', path: '/materials/database', description: 'Material properties' },
      { title: 'Code Compliance', path: '/compliance/checker', description: 'Design code validation' },
      { title: 'Connection Database', path: '/connections/database', description: 'Connection catalog' },
      { title: 'Cloud Storage', path: '/cloud-storage', description: 'File storage management' },
      { title: 'Performance Monitor', path: '/performance/monitor', description: 'System analytics' },
    ],
  },
  {
    id: 'civil',
    title: 'Civil Engineering',
    description: 'Specialized modules',
    icon: <Building2 className="w-5 h-5" />,
    pages: [
      { title: 'Civil Library', path: '/civil-engineering/library', description: 'Civil engineering suite landing' },
      { title: 'Civil Book Interface', path: '/civil-engineering/book', description: 'Book-style civil engineering workspace' },
      { title: 'Hydraulics Designer', path: '/civil/hydraulics', description: 'Hydraulic system design' },
      { title: 'Transportation Designer', path: '/civil/transportation', description: 'Road & highway design' },
      { title: 'Construction Manager', path: '/civil/construction', description: 'Construction planning' },
      { title: 'Quantity Survey', path: '/quantity', description: 'Material quantity takeoff' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Features',
    description: 'Artificial intelligence tools',
    icon: <Zap className="w-5 h-5" />,
    pages: [
      { title: 'AI Dashboard', path: '/ai-dashboard', description: 'C-suite AI analytics', badge: 'New' },
      { title: 'AI Power Panel', path: '/ai-power', description: 'Next-gen AI interface', badge: 'New' },
    ],
  },
  {
    id: 'learning',
    title: 'Learning & Support',
    description: 'Education and help resources',
    icon: <BookOpen className="w-5 h-5" />,
    pages: [
      { title: 'Learning Center', path: '/learning', description: 'Tutorials and courses' },
      { title: 'Engineering Blog', path: '/blog', description: 'Product updates and engineering insights' },
      { title: 'Help Center', path: '/help', description: 'FAQs and support' },
      { title: 'About', path: '/about', description: 'Company information' },
      { title: 'Contact', path: '/contact', description: 'Contact form and info' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Account',
    description: 'User preferences',
    icon: <Cog className="w-5 h-5" />,
    pages: [
      { title: 'Settings', path: '/settings', description: 'User settings' },
      { title: 'Notifications', path: '/notifications', description: 'Project and platform alerts' },
      { title: 'Profile', path: '/profile', description: 'Manage account and profile information' },
      { title: 'Settings (Enhanced)', path: '/settings-enhanced', description: 'Enhanced settings interface' },
      { title: 'Advanced Settings', path: '/settings/advanced', description: 'Analysis configuration' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal & Policies',
    description: 'Terms and policies',
    icon: <FileText className="w-5 h-5" />,
    pages: [
      { title: 'Privacy Policy', path: '/privacy-policy', description: 'Data privacy & GDPR' },
      { title: 'Terms of Service', path: '/terms-of-service', description: 'Service terms' },
      { title: 'Terms & Conditions', path: '/terms-and-conditions', description: 'Comprehensive T&C' },
      { title: 'Refund Policy', path: '/refund-cancellation', description: 'Refund and cancellation' },
    ],
  },
];

interface SitemapPageProps {}

const SectionCard: FC<{ section: PageSection; index: number }> = ({ section, index }) => {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-[#1a2333] overflow-hidden"
    >
      {/* Section Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          {section.icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-[#dae2fd]">
            {section.title}
          </h3>
          <p className="text-sm text-[#869ab8]">
            {section.description}
          </p>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-xs bg-[#131b2e] px-2 py-1 rounded">
            {section.pages.length}
          </span>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Pages List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[#1a2333]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
              {section.pages.map((page, i) => (
                <Link
                  key={i}
                  to={page.path}
                  className="group p-3 rounded-lg border border-[#1a2333] hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium tracking-wide text-[#dae2fd] text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {page.title}
                      </h4>
                      <p className="text-xs text-[#869ab8] mt-1 line-clamp-2">
                        {page.description}
                      </p>
                    </div>
                    {page.badge && (
                      <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                        {page.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium tracking-wide">
                      Open
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const SitemapPage: FC<SitemapPageProps> = () => {
  useEffect(() => { document.title = 'Sitemap | BeamLab'; }, []);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = searchQuery
    ? PAGE_SECTIONS.map((section) => ({
        ...section,
        pages: section.pages.filter(
          (page) =>
            page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            page.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((section) => section.pages.length > 0)
    : PAGE_SECTIONS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-12 px-4">
      <SEO
        title="Site Map"
        description="Complete navigation guide to all BeamLab features: structural analysis, RC design, steel design, foundation design, reports, and more."
        path="/sitemap"
      />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="space-y-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-[#dae2fd] mb-2">
              Site Navigation
            </h1>
            <p className="text-lg text-[#869ab8]">
              Complete map of all features and pages. Discover everything BeamLab has to offer.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-[#131b2e] text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Sections Grid */}
        <div className="space-y-4">
          {filteredSections.length > 0 ? (
            filteredSections.map((section, index) => (
              <SectionCard key={section.id} section={section} index={index} />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-[#869ab8]">
                No pages found matching "{searchQuery}"
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {PAGE_SECTIONS.reduce((sum, s) => sum + s.pages.length, 0)}
            </div>
            <p className="text-sm text-[#869ab8]">Total Pages</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {PAGE_SECTIONS.length}
            </div>
            <p className="text-sm text-[#869ab8]">Categories</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              14
            </div>
            <p className="text-sm text-[#869ab8]">Analysis Types</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              10+
            </div>
            <p className="text-sm text-[#869ab8]">Design Modules</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SitemapPage;
