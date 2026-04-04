/**
 * PageTransition Component
 * Wraps page content with smooth enter/exit animations using Framer Motion
 *
 * Enhancement per Figma §22.7:
 *   - Respects prefers-reduced-motion via useReducedMotion()
 *   - Falls back to instant transition when motion is reduced
 */

import { motion, AnimatePresence, useReducedMotion, HTMLMotionProps } from 'framer-motion';
import { FC, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: {
            duration: 0.2,
            ease: 'easeInOut' as const,
        },
    },
};

const reducedVariants = {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
};

export const PageTransition: FC<PageTransitionProps> = ({ children, className = '' }) => {
    const location = useLocation();
    const prefersReducedMotion = useReducedMotion();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                variants={prefersReducedMotion ? reducedVariants : pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={`w-full h-full ${className}`.trim()}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

/**
 * FadeIn Component
 * Simple fade-in animation for content sections
 */
interface FadeInProps {
    children: ReactNode;
    delay?: number;
    className?: string;
}

export const FadeIn: FC<FadeInProps> = ({ children, delay = 0, className = '' }) => {
    const reduced = useReducedMotion();
    return (
        <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * StaggerContainer & StaggerItem
 * For animating lists/grids with staggered entrance
 */
interface StaggerContainerProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    className?: string;
    staggerDelay?: number;
}

export const StaggerContainer: FC<StaggerContainerProps> = ({
    children,
    className = '',
    staggerDelay = 0.08,
    ...props
}) => (
    <motion.div
        initial="hidden"
        animate="show"
        variants={{
            hidden: { opacity: 0 },
            show: {
                opacity: 1,
                transition: {
                    staggerChildren: staggerDelay,
                },
            },
        }}
        className={className}
        {...props}
    >
        {children}
    </motion.div>
);

interface StaggerItemProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    className?: string;
}

export const StaggerItem: FC<StaggerItemProps> = ({
    children,
    className = '',
    ...props
}) => (
    <motion.div
        variants={{
            hidden: { opacity: 0, y: 20, scale: 0.95 },
            show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                },
            },
        }}
        className={className}
        {...props}
    >
        {children}
    </motion.div>
);

/**
 * ScaleOnHover Component
 * Subtle scale effect on hover for interactive elements
 */
interface ScaleOnHoverProps {
    children: ReactNode;
    scale?: number;
    className?: string;
}

export const ScaleOnHover: FC<ScaleOnHoverProps> = ({
    children,
    scale = 1.02,
    className = '',
}) => {
    const reduced = useReducedMotion();
    return (
        <motion.div
            whileHover={reduced ? undefined : { scale }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * SlideIn Component
 * Slide in from direction with opacity
 */
interface SlideInProps {
    children: ReactNode;
    direction?: 'left' | 'right' | 'up' | 'down';
    delay?: number;
    className?: string;
}

export const SlideIn: FC<SlideInProps> = ({
    children,
    direction = 'up',
    delay = 0,
    className = '',
}) => {
    const directionMap = {
        left: { x: -30, y: 0 },
        right: { x: 30, y: 0 },
        up: { x: 0, y: 30 },
        down: { x: 0, y: -30 },
    };

    return (
        <motion.div
            initial={{ opacity: 0, ...directionMap[direction] }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
