/**
 * Accordion Component - Collapsible content sections
 * Matches Figma spec 02_COMPONENT_LIBRARY §15
 *
 * ARIA: Uses WAI-ARIA Accordion pattern (heading + region),
 *       NOT tab roles. Each header is a <h3> wrapping a <button type="button">
 *       with aria-expanded. Panels use role="region".
 *
 * Animation: smooth max-height + opacity fade on content.
 */

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItem {
  id: string;
  title: string;
  /** Optional icon before title */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Allow multiple items open simultaneously */
  multiple?: boolean;
  /** Initially expanded item IDs */
  defaultExpanded?: string[];
  className?: string;
  /** Variant styling */
  variant?: 'default' | 'bordered' | 'ghost';
}

const variantClasses = {
  default: 'divide-y divide-slate-200 dark:divide-slate-700/50 border border-[#1a2333]/50 rounded-lg overflow-hidden',
  bordered: 'space-y-2',
  ghost: 'divide-y divide-slate-200/50 dark:divide-slate-800',
} as const;

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(({
  items,
  multiple = false,
  defaultExpanded = [],
  className,
  variant = 'default',
}, ref) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(defaultExpanded));

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div ref={ref} className={cn(variantClasses[variant], className)}>
      {items.map((item) => (
        <AccordionPanel
          key={item.id}
          item={item}
          expanded={expandedIds.has(item.id)}
          onToggle={() => toggle(item.id)}
          variant={variant}
        />
      ))}
    </div>
  );
});
Accordion.displayName = 'Accordion';

interface AccordionPanelProps {
  item: AccordionItem;
  expanded: boolean;
  onToggle: () => void;
  variant: 'default' | 'bordered' | 'ghost';
}

const AccordionPanel: React.FC<AccordionPanelProps> = ({ item, expanded, onToggle, variant }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, item.children]);

  const wrapperClass = variant === 'bordered'
    ? 'border border-[#1a2333]/50 rounded-lg overflow-hidden'
    : '';

  return (
    <div className={wrapperClass}>
      {/* WAI-ARIA: heading wrapping a button */}
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`accordion-content-${item.id}`}
          id={`accordion-header-${item.id}`}
          disabled={item.disabled}
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-200',
            'text-sm font-medium tracking-wide tracking-wide text-slate-700 dark:text-slate-200',
            'hover:bg-slate-100 dark:hover:bg-slate-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
            item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent',
          )}
        >
          <ChevronRight
            className={cn(
              'w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          />
          {item.icon && <span className="flex-shrink-0 text-[#869ab8]">{item.icon}</span>}
          <span className="flex-1">{item.title}</span>
        </button>
      </h3>
      <div
        id={`accordion-content-${item.id}`}
        role="region"
        aria-labelledby={`accordion-header-${item.id}`}
        hidden={!expanded}
        style={{ maxHeight: expanded ? height : 0, opacity: expanded ? 1 : 0 }}
        className="overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out"
      >
        <div ref={contentRef} className="px-4 pb-4 pt-1 text-sm text-[#869ab8]">
          {item.children}
        </div>
      </div>
    </div>
  );
};

export default Accordion;
