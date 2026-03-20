import { FC, ReactNode, useState, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    shortcut?: string;
    description?: string;
    children: ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
}

export const Tooltip: FC<TooltipProps> = ({
    content,
    shortcut,
    description,
    children,
    side = 'top',
    delay = 800,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number>();
    const hideTimeoutRef = useRef<number>();
    const tooltipId = useId();
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const showTooltip = () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                let top = 0;
                let left = 0;

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
        hideTimeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
        }, 200);
    };

    const getTransform = () => {
        switch (side) {
            case 'top': return 'translate(-50%, -100%)';
            case 'bottom': return 'translate(-50%, 0)';
            case 'left': return 'translate(-100%, -50%)';
            case 'right': return 'translate(0, -50%)';
        }
    };

    // Arrow positioning classes
    const getArrowStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            width: 6,
            height: 6,
            transform: 'rotate(45deg)',
        };
        switch (side) {
            case 'top': return { ...base, bottom: -3, left: '50%', marginLeft: -3, backgroundColor: 'inherit', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'inherit' };
            case 'bottom': return { ...base, top: -3, left: '50%', marginLeft: -3, backgroundColor: 'inherit', borderLeft: '1px solid', borderTop: '1px solid', borderColor: 'inherit' };
            case 'left': return { ...base, right: -3, top: '50%', marginTop: -3, backgroundColor: 'inherit', borderTop: '1px solid', borderRight: '1px solid', borderColor: 'inherit' };
            case 'right': return { ...base, left: -3, top: '50%', marginTop: -3, backgroundColor: 'inherit', borderBottom: '1px solid', borderLeft: '1px solid', borderColor: 'inherit' };
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
                aria-describedby={isVisible ? tooltipId : undefined}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    id={tooltipId}
                    role="tooltip"
                    className="fixed z-[1000] px-2.5 py-1.5 bg-slate-700 border border-slate-600 text-slate-100 text-xs rounded-md shadow-md max-w-[280px] pointer-events-none"
                    style={{
                        top: position.top,
                        left: position.left,
                        transform: getTransform(),
                        animation: prefersReducedMotion ? 'none' : 'tooltipIn 150ms ease-out',
                    }}
                >
                    <div style={getArrowStyle()} />
                    <div className="flex items-center gap-2">
                        <span className="font-medium tracking-wide tracking-wide">{content}</span>
                        {shortcut && (
                            <kbd className="bg-slate-600 border border-slate-500 px-1.5 py-0.5 rounded text-[11px] text-slate-300 font-mono">
                                {shortcut}
                            </kbd>
                        )}
                    </div>
                    {description && (
                        <p className="text-[11px] text-slate-400 mt-1">{description}</p>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};
