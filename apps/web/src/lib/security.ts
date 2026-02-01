/**
 * Security Utilities
 * 
 * Industry Standard: Client-side security best practices
 * 
 * Includes:
 * - XSS prevention
 * - CSRF token handling
 * - Input sanitization
 * - Secure storage
 * - Content Security Policy helpers
 */

// ============================================================================
// XSS Prevention
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char]);
}

/**
 * Sanitize user input for display
 */
export function sanitizeInput(input: string): string {
  // Remove any HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '');
  // Escape remaining special characters
  return escapeHtml(withoutTags);
}

/**
 * Sanitize URL to prevent javascript: and data: schemes
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return 'about:blank';
  }

  // Allow safe schemes
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return url;
  }

  // Prefix with https:// if no scheme
  if (!trimmed.includes('://')) {
    return `https://${url}`;
  }

  return 'about:blank';
}

// ============================================================================
// CSRF Protection
// ============================================================================

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store CSRF token
 */
export function storeCsrfToken(token: string): void {
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
}

/**
 * Get stored CSRF token
 */
export function getCsrfToken(): string | null {
  return sessionStorage.getItem(CSRF_TOKEN_KEY);
}

/**
 * Get or create CSRF token
 */
export function ensureCsrfToken(): string {
  let token = getCsrfToken();
  if (!token) {
    token = generateCsrfToken();
    storeCsrfToken(token);
  }
  return token;
}

/**
 * Add CSRF token to request headers
 */
export function addCsrfHeader(headers: Headers | Record<string, string>): void {
  const token = ensureCsrfToken();
  
  if (headers instanceof Headers) {
    headers.set(CSRF_HEADER, token);
  } else {
    headers[CSRF_HEADER] = token;
  }
}

// ============================================================================
// Secure Storage
// ============================================================================

/**
 * Secure storage with optional encryption
 * 
 * Note: For truly sensitive data, use a proper encryption library
 */
export class SecureStorage {
  private prefix: string;
  private storage: Storage;

  constructor(prefix: string = 'secure_', useSession: boolean = false) {
    this.prefix = prefix;
    this.storage = useSession ? sessionStorage : localStorage;
  }

  /**
   * Store a value securely
   */
  set(key: string, value: unknown): void {
    const serialized = JSON.stringify({
      v: value,
      t: Date.now(),
    });
    
    // Basic obfuscation (not encryption!)
    const encoded = btoa(serialized);
    this.storage.setItem(this.prefix + key, encoded);
  }

  /**
   * Retrieve a value
   */
  get<T>(key: string): T | null {
    const encoded = this.storage.getItem(this.prefix + key);
    if (!encoded) return null;

    try {
      const serialized = atob(encoded);
      const { v } = JSON.parse(serialized);
      return v as T;
    } catch {
      return null;
    }
  }

  /**
   * Retrieve with expiry check
   */
  getWithExpiry<T>(key: string, maxAgeMs: number): T | null {
    const encoded = this.storage.getItem(this.prefix + key);
    if (!encoded) return null;

    try {
      const serialized = atob(encoded);
      const { v, t } = JSON.parse(serialized);
      
      // Check if expired
      if (Date.now() - t > maxAgeMs) {
        this.remove(key);
        return null;
      }
      
      return v as T;
    } catch {
      return null;
    }
  }

  /**
   * Remove a value
   */
  remove(key: string): void {
    this.storage.removeItem(this.prefix + key);
  }

  /**
   * Clear all values with this prefix
   */
  clear(): void {
    const keys = Object.keys(this.storage).filter((k) => k.startsWith(this.prefix));
    keys.forEach((k) => this.storage.removeItem(k));
  }
}

export const secureStorage = new SecureStorage();
export const secureSessionStorage = new SecureStorage('ssec_', true);

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Include uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Include special characters');

  return {
    valid: score >= 4,
    score,
    feedback,
  };
}

/**
 * Check for common password patterns
 */
export function isCommonPassword(password: string): boolean {
  const common = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'password1', 'admin', 'letmein', 'welcome', 'monkey',
  ];
  return common.includes(password.toLowerCase());
}

// ============================================================================
// Rate Limiting for Forms
// ============================================================================

const formSubmissions = new Map<string, number[]>();

/**
 * Check if form submission should be rate limited
 */
export function shouldRateLimitForm(
  formId: string,
  maxSubmissions: number = 5,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const submissions = formSubmissions.get(formId) || [];
  
  // Filter to window
  const recentSubmissions = submissions.filter((t) => now - t < windowMs);
  
  if (recentSubmissions.length >= maxSubmissions) {
    return true;
  }
  
  // Record this submission
  recentSubmissions.push(now);
  formSubmissions.set(formId, recentSubmissions);
  
  return false;
}

// ============================================================================
// Content Security Policy Helpers
// ============================================================================

/**
 * Generate nonce for inline scripts
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Check if current page is loaded over HTTPS
 */
export function isSecureContext(): boolean {
  return window.isSecureContext;
}

/**
 * Check for mixed content
 */
export function hasMixedContent(): boolean {
  if (location.protocol !== 'https:') return false;
  
  const elements = document.querySelectorAll('[src], [href]');
  for (const el of elements) {
    const src = el.getAttribute('src') || el.getAttribute('href');
    if (src?.startsWith('http://')) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Clickjacking Protection
// ============================================================================

/**
 * Check if page is in an iframe (potential clickjacking)
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // If access is denied, we're in a cross-origin iframe
  }
}

/**
 * Break out of iframe if not allowed
 */
export function preventClickjacking(allowedOrigins: string[] = []): void {
  if (!isInIframe()) return;
  
  try {
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : '';
    
    if (!allowedOrigins.includes(parentOrigin)) {
      // Redirect top frame to this page
      if (window.top) {
        window.top.location.href = window.self.location.href;
      }
    }
  } catch {
    // Cross-origin, can't access parent - redirect
    if (window.top) {
      window.top.location.href = window.self.location.href;
    }
  }
}

// ============================================================================
// Sensitive Data Handling
// ============================================================================

/**
 * Mask sensitive data for display
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4,
  maskChar: string = '*'
): string {
  if (data.length <= visibleChars * 2) {
    return maskChar.repeat(data.length);
  }
  
  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const middle = maskChar.repeat(Math.min(data.length - visibleChars * 2, 10));
  
  return `${start}${middle}${end}`;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskSensitiveData(email);
  
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '*'.repeat(local.length);
    
  return `${maskedLocal}@${domain}`;
}

/**
 * Clear sensitive data from memory
 */
export function clearSensitiveString(str: string): void {
  // In JavaScript, strings are immutable, so we can't truly clear them
  // This is more of a best-effort attempt
  // For truly sensitive data, avoid storing in strings at all
  
  // The best we can do is set references to null and hope GC cleans up
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  str = '';
}
