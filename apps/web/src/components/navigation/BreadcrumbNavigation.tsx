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
  '/stream': [{ label: 'Dashboard', path: '/stream', current: true }],
  '/app': [
    { label: 'Workspace', path: '/app' },
    { label: '3D Modeler', path: '/app', current: true },
  ],
  '/design-center': [
    { label: 'Engineering', path: '/' },
    { label: 'Design Center', path: '/design-center', current: true },
  ],
  '/design/steel': [
    { label: 'Engineering', path: '/' },
    { label: 'Design', path: '/design-center' },
    { label: 'Steel Design', path: '/design/steel', current: true },
  ],
  '/design/concrete': [
    { label: 'Engineering', path: '/' },
    { label: 'Design', path: '/design-center' },
    { label: 'RC Design', path: '/design/concrete', current: true },
  ],
  '/design/foundation': [
    { label: 'Engineering', path: '/' },
    { label: 'Design', path: '/design-center' },
    { label: 'Foundation Design', path: '/design/foundation', current: true },
  ],
  '/analysis/modal': [
    { label: 'Engineering', path: '/' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Modal Analysis', path: '/analysis/modal', current: true },
  ],
  '/analysis/time-history': [
    { label: 'Engineering', path: '/' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Time History', path: '/analysis/time-history', current: true },
  ],
  '/analysis/pushover': [
    { label: 'Engineering', path: '/' },
    { label: 'Analysis', path: '/analysis/modal' },
    { label: 'Pushover Analysis', path: '/analysis/pushover', current: true },
  ],
  '/tools/load-combinations': [
    { label: 'Tools', path: '/' },
    { label: 'Load Combinations', path: '/tools/load-combinations', current: true },
  ],
  '/tools/section-database': [
    { label: 'Tools', path: '/' },
    { label: 'Section Database', path: '/tools/section-database', current: true },
  ],
  '/reports/professional': [
    { label: 'Reports', path: '/reports' },
    { label: 'Professional Reports', path: '/reports/professional', current: true },
  ],
  '/collaboration': [
    { label: 'Enterprise', path: '/' },
    { label: 'Collaboration', path: '/collaboration', current: true },
  ],
  '/settings': [
    { label: 'Settings', path: '/settings', current: true },
  ],
  '/learning': [
    { label: 'Help & Learning', path: '/' },
    { label: 'Learning Center', path: '/learning', current: true },
  ],
  '/sitemap': [
    { label: 'Navigation', path: '/sitemap', current: true },
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
