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
  maxItems?: number;
}

/**
 * BreadcrumbNavigation Component
 */
export const BreadcrumbNavigation: FC<BreadcrumbNavigationProps> = ({
  className = '',
  showHome = true,
  separator = <ChevronRight className="w-4 h-4" />,
  maxItems = 4,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  let breadcrumbs = getBreadcrumbsForPath(pathname);

  // Add home if requested
  if (showHome && !breadcrumbs.some((b) => b.path === '/')) {
    breadcrumbs = [{ label: 'Home', path: '/' }, ...breadcrumbs];
  }

  // Compact mode for deep paths: keep first item + trailing context
  const displayItems = breadcrumbs.length > maxItems
    ? [
        breadcrumbs[0],
        { label: '…', path: '__ellipsis__', current: false },
        ...breadcrumbs.slice(-(maxItems - 1)),
      ]
    : breadcrumbs;

  return (
    <nav className={`flex items-center gap-2 ${className}`} aria-label="Breadcrumb">
      {displayItems.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <span className="text-[var(--color-text-dim)]/70 flex-shrink-0">
              {separator}
            </span>
          )}
          {item.path === '__ellipsis__' ? (
            <span className="text-sm text-[var(--color-text-dim)] select-none" aria-hidden="true">
              {item.label}
            </span>
          ) : item.current ? (
            <span
              className="text-sm font-medium tracking-wide text-[var(--color-text)] truncate"
              aria-current="page"
            >
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              className="rounded px-1 text-sm text-[var(--color-text-soft)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/40 hover:underline underline-offset-2 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
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
