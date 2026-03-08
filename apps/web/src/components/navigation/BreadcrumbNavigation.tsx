/**
 * BreadcrumbNavigation.tsx - Hierarchical breadcrumb navigation
 * Shows the current page location and path in the site hierarchy
 */

import React, { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  // Dashboard
  '/stream': [{ label: 'Dashboard', path: '/stream', current: true }],

  // Workspace
  '/app': [
    { label: 'Dashboard', path: '/stream' },
    { label: '3D Workspace', path: '/app', current: true },
  ],

  // Analysis
  '/analysis/modal': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Modal Analysis', path: '/analysis/modal', current: true },
  ],
  '/analysis/time-history': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Time History', path: '/analysis/time-history', current: true },
  ],
  '/analysis/seismic': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Seismic', path: '/analysis/seismic', current: true },
  ],
  '/analysis/buckling': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Buckling', path: '/analysis/buckling', current: true },
  ],
  '/analysis/pushover': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Pushover', path: '/analysis/pushover', current: true },
  ],
  '/analysis/pdelta': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'P-Delta', path: '/analysis/pdelta', current: true },
  ],
  '/analysis/cable': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Cable Analysis', path: '/analysis/cable', current: true },
  ],
  '/analysis/nonlinear': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Nonlinear', path: '/analysis/nonlinear', current: true },
  ],
  '/analysis/dynamic': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Dynamic', path: '/analysis/dynamic', current: true },
  ],
  '/analysis/plate-shell': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Plate & Shell FEM', path: '/analysis/plate-shell', current: true },
  ],
  '/analysis/sensitivity-optimization': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Optimization', path: '/analysis/sensitivity-optimization', current: true },
  ],

  // Design
  '/design/steel': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Steel Design', path: '/design/steel', current: true },
  ],
  '/design/concrete': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'RC Design', path: '/design/concrete', current: true },
  ],
  '/design/foundation': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Foundation Design', path: '/design/foundation', current: true },
  ],
  '/design/connections': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Connections', path: '/design/connections', current: true },
  ],
  '/design/welded-connections': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Welded Connections', path: '/design/welded-connections', current: true },
  ],
  '/design/detailing': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'RC Detailing', path: '/design/detailing', current: true },
  ],
  '/design/reinforcement': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Reinforcement', path: '/design/reinforcement', current: true },
  ],
  '/design-center': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design Center', path: '/design-center', current: true },
  ],
  '/design-hub': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Post-Analysis Hub', path: '/design-hub', current: true },
  ],

  // Tools
  '/tools/load-combinations': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Tools', path: '/tools/section-database' },
    { label: 'Load Combinations', path: '/tools/load-combinations', current: true },
  ],
  '/tools/section-database': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Tools', path: '/tools/section-database' },
    { label: 'Section Database', path: '/tools/section-database', current: true },
  ],
  '/tools/bar-bending': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Tools', path: '/tools/section-database' },
    { label: 'Bar Bending Schedule', path: '/tools/bar-bending', current: true },
  ],
  '/tools/advanced-meshing': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Tools', path: '/tools/section-database' },
    { label: 'Advanced Meshing', path: '/tools/advanced-meshing', current: true },
  ],
  '/tools/print-export': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Tools', path: '/tools/section-database' },
    { label: 'Print & Export', path: '/tools/print-export', current: true },
  ],

  // Reports
  '/reports': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Reports', path: '/reports', current: true },
  ],
  '/reports/builder': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Reports', path: '/reports' },
    { label: 'Report Builder', path: '/reports/builder', current: true },
  ],
  '/reports/professional': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Reports', path: '/reports' },
    { label: 'Professional Reports', path: '/reports/professional', current: true },
  ],

  // Enterprise & Integration
  '/bim': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'BIM Integration', path: '/bim', current: true },
  ],
  '/bim/export-enhanced': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'BIM Export', path: '/bim/export-enhanced', current: true },
  ],
  '/cad/integration': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'CAD Integration', path: '/cad/integration', current: true },
  ],
  '/collaboration': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/collaboration' },
    { label: 'Collaboration Hub', path: '/collaboration', current: true },
  ],
  '/integrations/api-dashboard': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'API Dashboard', path: '/integrations/api-dashboard', current: true },
  ],
  '/materials/database': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'Materials Database', path: '/materials/database', current: true },
  ],
  '/compliance/checker': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Enterprise', path: '/bim' },
    { label: 'Code Compliance', path: '/compliance/checker', current: true },
  ],
  '/connections/database': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-hub' },
    { label: 'Connection Database', path: '/connections/database', current: true },
  ],

  // Visualization
  '/visualization': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Visualization Hub', path: '/visualization', current: true },
  ],
  '/visualization/3d-engine': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Visualization', path: '/visualization' },
    { label: '3D Engine', path: '/visualization/3d-engine', current: true },
  ],
  '/visualization/result-animation': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Visualization', path: '/visualization' },
    { label: 'Result Animation', path: '/visualization/result-animation', current: true },
  ],

  // Quantity & Planning
  '/quantity': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Quantity Survey', path: '/quantity', current: true },
  ],
  '/space-planning': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Space Planning', path: '/space-planning', current: true },
  ],
  '/room-planner': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Room Planner', path: '/room-planner', current: true },
  ],

  // AI
  '/ai-dashboard': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'AI Dashboard', path: '/ai-dashboard', current: true },
  ],
  '/ai-power': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'AI Power Panel', path: '/ai-power', current: true },
  ],

  // Civil
  '/civil/hydraulics': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Civil Engineering', path: '/civil/hydraulics' },
    { label: 'Hydraulics', path: '/civil/hydraulics', current: true },
  ],
  '/civil/transportation': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Civil Engineering', path: '/civil/hydraulics' },
    { label: 'Transportation', path: '/civil/transportation', current: true },
  ],
  '/civil/construction': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Civil Engineering', path: '/civil/hydraulics' },
    { label: 'Construction', path: '/civil/construction', current: true },
  ],

  // Other
  '/cloud-storage': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Cloud Storage', path: '/cloud-storage', current: true },
  ],
  '/digital-twin': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Digital Twin', path: '/digital-twin', current: true },
  ],
  '/performance/monitor': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Performance Monitor', path: '/performance/monitor', current: true },
  ],
  '/settings': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Settings', path: '/settings', current: true },
  ],
  '/settings-enhanced': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Settings', path: '/settings' },
    { label: 'Enhanced', path: '/settings-enhanced', current: true },
  ],
  '/settings/advanced': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Settings', path: '/settings' },
    { label: 'Advanced', path: '/settings/advanced', current: true },
  ],
  '/learning': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Learning Center', path: '/learning', current: true },
  ],
  '/sitemap': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Site Map', path: '/sitemap', current: true },
  ],
};

interface BreadcrumbNavigationProps {
  className?: string;
  showHome?: boolean;
  separator?: React.ReactNode;
}

/**
 * BreadcrumbNavigation Component
 */
export const BreadcrumbNavigation: FC<BreadcrumbNavigationProps> = ({
  className = '',
  showHome = true,
  separator = <ChevronRight className="w-4 h-4" />,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Get breadcrumbs from config or generate from path
  let breadcrumbs = ROUTE_BREADCRUMBS[pathname];

  if (!breadcrumbs) {
    // Auto-generate breadcrumbs from path
    const parts = pathname.split('/').filter(Boolean);
    breadcrumbs = parts.map((part, index) => ({
      label: part
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      path: '/' + parts.slice(0, index + 1).join('/'),
      current: index === parts.length - 1,
    }));
  }

  // Add home if requested
  if (showHome && !breadcrumbs.some((b) => b.path === '/')) {
    breadcrumbs = [{ label: 'Home', path: '/' }, ...breadcrumbs];
  }

  return (
    <nav className={`flex items-center gap-2 ${className}`} aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <span className="text-slate-400 dark:text-slate-600 flex-shrink-0">
              {separator}
            </span>
          )}
          {item.current ? (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors truncate"
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbNavigation;
