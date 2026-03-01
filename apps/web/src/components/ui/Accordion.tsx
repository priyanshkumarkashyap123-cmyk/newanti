/**
 * Accordion Component - Collapsible content sections
 * Matches Figma spec 02_COMPONENT_LIBRARY §15
 */

import React, { useState, useRef, useEffect } from 'react';
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

export const Accordion: React.FC<AccordionProps> = ({
  items,
  multiple = false,
  defaultExpanded = [],
  className,
  variant = 'default',
}) => {
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

  const variantClasses = {
    default: 'divide-y divide-slate-200 dark:divide-slate-700/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden',
    bordered: 'space-y-2',
    ghost: 'divide-y divide-slate-200/50 dark:divide-slate-800',
  };

  return (
    <div className={cn(variantClasses[variant], className)} role="tablist">
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
};

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
    ? 'border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden'
    : '';

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        role="tab"
        aria-expanded={expanded}
        aria-controls={`accordion-content-${item.id}`}
        id={`accordion-header-${item.id}`}
        disabled={item.disabled}
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-200',
          'text-sm font-medium text-slate-700 dark:text-slate-200',
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
        {item.icon && <span className="flex-shrink-0 text-slate-500 dark:text-slate-400">{item.icon}</span>}
        <span className="flex-1">{item.title}</span>
      </button>
      <div
        id={`accordion-content-${item.id}`}
        role="tabpanel"
        aria-labelledby={`accordion-header-${item.id}`}
        style={{ maxHeight: expanded ? height : 0 }}
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
      >
        <div ref={contentRef} className="px-4 pb-4 pt-1 text-sm text-slate-600 dark:text-slate-400">
          {item.children}
        </div>
      </div>
    </div>
  );
};

export default Accordion;
