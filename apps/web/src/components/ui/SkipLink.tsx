/**
 * SkipLink - Accessibility skip-to-main-content link
 * 
 * Per Figma §22.2: positioned off-screen, slides in on focus,
 * bg: blue-500, z-index: 9999
 */

import { FC } from 'react';

interface SkipLinkProps {
    targetId?: string;
    label?: string;
}

export const SkipLink: FC<SkipLinkProps> = ({
    targetId = 'main-content',
    label = 'Skip to main content',
}) => (
    <a
        href={`#${targetId}`}
        className="fixed top-0 left-4 z-[9999] -translate-y-full focus:translate-y-4 bg-blue-500 text-white px-4 py-2 rounded-b-lg font-medium text-sm transition-transform duration-150 outline-none ring-2 ring-blue-300 ring-offset-2"
    >
        {label}
    </a>
);

export default SkipLink;
