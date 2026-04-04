/**
 * Tests for HTML sanitizer utility (DOMPurify-based)
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../sanitize';

describe('sanitizeHTML', () => {
    it('returns empty string for falsy input', () => {
        expect(sanitizeHTML('')).toBe('');
        expect(sanitizeHTML(null as unknown as string)).toBe('');
        expect(sanitizeHTML(undefined as unknown as string)).toBe('');
    });

    it('preserves safe HTML', () => {
        const safe = '<h1>Title</h1><p>Hello <strong>world</strong></p>';
        expect(sanitizeHTML(safe)).toBe(safe);
    });

    it('strips <script> tags and their content', () => {
        const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('script');
        expect(result).not.toContain('alert');
        expect(result).toContain('Hello');
        expect(result).toContain('World');
    });

    it('strips <iframe> tags and content', () => {
        const input = '<div>Safe</div><iframe src="evil.html">inner</iframe>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('iframe');
        expect(result).toContain('Safe');
    });

    it('removes event handler attributes', () => {
        const input = '<img src="x.png" onerror="alert(1)" />';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('onerror');
    });

    it('removes onclick attributes', () => {
        const input = '<a href="#" onclick="steal()">Click</a>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('onclick');
        expect(result).toContain('Click');
    });

    it('neutralises javascript: URLs', () => {
        const input = '<a href="javascript:alert(1)">XSS</a>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('javascript:');
    });

    it('strips <object> and <embed> tags', () => {
        const input = '<object data="evil.swf"></object><embed src="evil.swf">';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('object');
        expect(result).not.toContain('embed');
    });

    it('strips <form> tags', () => {
        const input = '<form action="evil.php"><input></form>';
        const result = sanitizeHTML(input);
        expect(result).not.toContain('form');
    });

    it('handles mixed safe and dangerous content', () => {
        const input = `
            <h2>Report</h2>
            <p>Normal text</p>
            <script>document.cookie</script>
            <img src="chart.png" onload="fetch('evil')" />
            <table><tr><td>Data</td></tr></table>
        `;
        const result = sanitizeHTML(input);
        expect(result).toContain('Report');
        expect(result).toContain('table');
        expect(result).not.toContain('script');
        expect(result).not.toContain('onload');
    });
});
