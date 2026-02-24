/**
 * Utils - Class Name Helper
 * 
 * Utility for merging Tailwind classes with clsx.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
