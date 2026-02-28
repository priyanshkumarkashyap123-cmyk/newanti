import { FC, ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    shortcut?: string;
    children: ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
}

export const Tooltip: FC<TooltipProps> = ({
    content,
    shortcut,
    children,
    side = 'top',
    delay = 300,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number>();

    const showTooltip = () => {
        timeoutRef.current = window.setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                let top = 0;
                let left = 0;

                // Simple positioning logic
                switch (side) {
                    case 'top':
                        top = rect.top - 8;
                        left = rect.left + rect.width / 2;
                        break;
                    case 'bottom':
                        top = rect.bottom + 8;
                        left = rect.left + rect.width / 2;
                        break;
                    case 'left':
                        top = rect.top + rect.height / 2;
                        left = rect.left - 8;
                        break;
                    case 'right':
                        top = rect.top + rect.height / 2;
                        left = rect.right + 8;
                        break;
                }

                setPosition({ top, left });
                setIsVisible(true);
            }
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    // Calculate transforms based on side
    const getTransform = () => {
        switch (side) {
            case 'top': return 'translate(-50%, -100%)';
            case 'bottom': return 'translate(-50%, 0)';
            case 'left': return 'translate(-100%, -50%)';
            case 'right': return 'translate(0, -50%)';
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                className={className}
                aria-describedby={isVisible ? 'tooltip-content' : undefined}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    id="tooltip-content"
                    role="tooltip"
                    aria-live="polite"
                    className="fixed z-[1000] px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        top: position.top,
                        left: position.left,
                        transform: getTransform()
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-medium">{content}</span>
                        {shortcut && (
                            <kbd className="bg-slate-200 dark:bg-slate-700 border border-slate-600 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                                {shortcut}
                            </kbd>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
