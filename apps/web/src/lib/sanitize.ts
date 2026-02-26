/**
 * HTML Sanitizer Utility
 *
 * Uses DOMPurify for robust, battle-tested HTML sanitization.
 * Strips dangerous tags, event handlers, and javascript: URIs
 * while preserving safe structural and presentational markup.
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize an HTML string by stripping dangerous elements and attributes.
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHTML(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
        // Allow safe structural tags + SVG for diagrams
        ALLOWED_TAGS: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'br', 'hr', 'div', 'span', 'blockquote', 'pre', 'code',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
            'a', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'small', 'mark', 'abbr',
            'img', 'figure', 'figcaption',
            'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'g',
            'defs', 'use', 'clipPath', 'marker',
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id', 'style',
            'width', 'height', 'colspan', 'rowspan', 'scope',
            'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r',
            'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
            'font-size', 'font-family', 'text-anchor', 'fill-opacity', 'stroke-opacity',
            'marker-start', 'marker-end', 'marker-mid',
        ],
        // Block javascript: URIs
        ALLOW_UNKNOWN_PROTOCOLS: false,
    });
}
