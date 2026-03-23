/**
 * BreadcrumbNavigation.tsx - Hierarchical breadcrumb navigation
 * Shows the current page location and path in the site hierarchy
 */

import React, { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getBreadcrumbsForPath } from '../../config/appRouteMeta';

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

  let breadcrumbs = getBreadcrumbsForPath(pathname);

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
            <span className="text-sm font-medium tracking-wide text-[#adc6ff] truncate">
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
