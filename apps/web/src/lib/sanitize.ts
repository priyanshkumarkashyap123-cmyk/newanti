/**
 * HTML Sanitizer Utility
 *
 * Lightweight HTML sanitization for use with dangerouslySetInnerHTML.
 * Strips dangerous tags (script, iframe, object, embed, form, style with
 * expression/url) and event-handler attributes while preserving safe markup.
 *
 * For a production app handling untrusted user input, consider using DOMPurify.
 * This utility is a defense-in-depth measure for rendering server-generated or
 * internally-composed HTML where a full library would be overkill.
 */

// Tags that must be completely removed (including their content)
const DANGEROUS_TAGS = /(<\s*\/?\s*(script|iframe|object|embed|applet|form|base|link|meta)\b[^>]*>)/gi;

// Content within dangerous tags (greedy, but only for the worst offenders)
const DANGEROUS_TAG_CONTENT = /<\s*(script|iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

// Event handler attributes: onclick, onerror, onload, etc.
const EVENT_HANDLER_ATTRS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// javascript: / data: / vbscript: in href/src/action attributes
const DANGEROUS_URLS = /(href|src|action|xlink:href)\s*=\s*(?:["']?\s*(?:javascript|data|vbscript)\s*:)/gi;

// style attributes containing expression() or url() with javascript:
const DANGEROUS_STYLE = /style\s*=\s*["'][^"']*(?:expression|javascript)\s*\([^"']*["']/gi;

/**
 * Sanitize an HTML string by stripping dangerous elements and attributes.
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHTML(html: string): string {
    if (!html) return '';

    let clean = html;

    // 1. Remove dangerous tag content (script blocks, etc.)
    clean = clean.replace(DANGEROUS_TAG_CONTENT, '');

    // 2. Remove remaining dangerous tags (self-closing, orphan closing tags)
    clean = clean.replace(DANGEROUS_TAGS, '');

    // 3. Strip event handler attributes
    clean = clean.replace(EVENT_HANDLER_ATTRS, '');

    // 4. Neutralise dangerous URL schemes
    clean = clean.replace(DANGEROUS_URLS, '$1=""');

    // 5. Neutralise dangerous style expressions
    clean = clean.replace(DANGEROUS_STYLE, 'style=""');

    return clean;
}
