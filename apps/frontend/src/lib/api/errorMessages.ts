/**
 * ============================================================================
 * USER-FRIENDLY ERROR MESSAGES MAPPING
 * ============================================================================
 * 
 * Maps backend error codes to actionable, user-friendly messages.
 * Provides contextual help and recovery suggestions.
 * 
 * @version 1.0.0
 */

export interface ErrorMessageConfig {
  title: string;
  message: string;
  suggestion?: string;
  action?: string;
  helpLink?: string;
  category: 'network' | 'auth' | 'validation' | 'server' | 'client' | 'timeout';
}

/**
 * Error code to user message mapping
 */
export const ERROR_MESSAGES: Record<string, ErrorMessageConfig> = {
  // Network Errors
  'NETWORK_ERROR': {
    title: 'Connection Problem',
    message: 'Unable to reach the server. Please check your internet connection.',
    suggestion: 'Try refreshing the page or check your network settings.',
    action: 'Retry',
    category: 'network',
  },
  'TIMEOUT': {
    title: 'Request Timeout',
    message: 'The server is taking too long to respond.',
    suggestion: 'This might be due to a large analysis or network slowness. Please try again.',
    action: 'Retry',
    category: 'timeout',
  },
  'DNS_ERROR': {
    title: 'Server Not Found',
    message: 'Cannot connect to the BeamLab servers.',
    suggestion: 'Check if beamlabultimate.tech is accessible. Contact support if the issue persists.',
    category: 'network',
  },

  // Authentication Errors
  'HTTP_401': {
    title: 'Authentication Required',
    message: 'Your session has expired. Please sign in again.',
    suggestion: 'You will be redirected to the sign-in page.',
    action: 'Sign In',
    category: 'auth',
  },
  'UNAUTHORIZED': {
    title: 'Unauthorized',
    message: 'You do not have permission to perform this action.',
    suggestion: 'Check your subscription tier or contact support for access.',
    category: 'auth',
  },
  'HTTP_403': {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    suggestion: 'This feature may require a Pro or Enterprise subscription.',
    action: 'Upgrade Plan',
    helpLink: '/pricing',
    category: 'auth',
  },
  'TOKEN_EXPIRED': {
    title: 'Session Expired',
    message: 'Your session has expired for security reasons.',
    suggestion: 'Please sign in again to continue.',
    action: 'Sign In',
    category: 'auth',
  },

  // Validation Errors
  'HTTP_400': {
    title: 'Invalid Request',
    message: 'The data you submitted is invalid or incomplete.',
    suggestion: 'Please check your input and try again.',
    category: 'validation',
  },
  'VALIDATION_ERROR': {
    title: 'Validation Failed',
    message: 'Some fields contain invalid data.',
    suggestion: 'Please review the highlighted fields and correct any errors.',
    category: 'validation',
  },
  'INVALID_MODEL': {
    title: 'Invalid Structural Model',
    message: 'The structural model contains errors or is incomplete.',
    suggestion: 'Ensure all nodes are constrained, members are connected, and loads are defined correctly.',
    helpLink: '/docs/model-validation',
    category: 'validation',
  },
  'UNSTABLE_STRUCTURE': {
    title: 'Unstable Structure',
    message: 'The structure is kinematically unstable and cannot be analyzed.',
    suggestion: 'Add more restraints or check member connectivity. The structure has more degrees of freedom than equations.',
    helpLink: '/docs/structural-stability',
    category: 'validation',
  },

  // Server Errors
  'HTTP_500': {
    title: 'Server Error',
    message: 'An internal server error occurred.',
    suggestion: 'Our team has been notified. Please try again in a few moments.',
    action: 'Retry',
    category: 'server',
  },
  'HTTP_502': {
    title: 'Service Unavailable',
    message: 'The analysis service is temporarily unavailable.',
    suggestion: 'We are experiencing high load. Please try again in a minute.',
    action: 'Retry',
    category: 'server',
  },
  'HTTP_503': {
    title: 'Service Maintenance',
    message: 'The service is temporarily down for maintenance.',
    suggestion: 'We will be back shortly. Check our status page for updates.',
    helpLink: 'https://status.beamlabultimate.tech',
    category: 'server',
  },
  'ANALYSIS_FAILED': {
    title: 'Analysis Failed',
    message: 'The structural analysis could not complete.',
    suggestion: 'This may be due to numerical instability. Try simplifying the model or adjusting load magnitudes.',
    helpLink: '/docs/troubleshooting-analysis',
    category: 'server',
  },
  'SOLVER_ERROR': {
    title: 'Solver Error',
    message: 'The finite element solver encountered an error.',
    suggestion: 'Check for ill-conditioned stiffness matrix (very large or very small member sizes).',
    helpLink: '/docs/solver-errors',
    category: 'server',
  },

  // Client Errors
  'HTTP_404': {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    suggestion: 'The project or file may have been deleted or moved.',
    category: 'client',
  },
  'HTTP_429': {
    title: 'Too Many Requests',
    message: 'You have exceeded the rate limit for your subscription tier.',
    suggestion: 'Please wait a moment before trying again, or upgrade to a higher tier for more capacity.',
    action: 'Upgrade Plan',
    helpLink: '/pricing',
    category: 'client',
  },
  'QUOTA_EXCEEDED': {
    title: 'Quota Exceeded',
    message: 'You have reached your monthly analysis limit.',
    suggestion: 'Upgrade your subscription to continue analyzing structures.',
    action: 'Upgrade Plan',
    helpLink: '/pricing',
    category: 'client',
  },

  // Fallback
  'UNKNOWN_ERROR': {
    title: 'Unexpected Error',
    message: 'Something went wrong.',
    suggestion: 'Please try again. If the problem persists, contact support with error ID.',
    action: 'Retry',
    category: 'server',
  },
};

/**
 * Get user-friendly error message configuration
 */
export function getUserFriendlyError(
  code: string,
  status?: number,
  originalMessage?: string
): ErrorMessageConfig {
  // Try exact code match first
  let config = ERROR_MESSAGES[code];

  // Try HTTP status code
  if (!config && status) {
    config = ERROR_MESSAGES[`HTTP_${status}`];
  }

  // Fallback to category-based generic messages
  if (!config) {
    if (status && status >= 500) {
      config = ERROR_MESSAGES['HTTP_500'];
    } else if (status === 401) {
      config = ERROR_MESSAGES['HTTP_401'];
    } else if (status === 403) {
      config = ERROR_MESSAGES['HTTP_403'];
    } else if (status === 429) {
      config = ERROR_MESSAGES['HTTP_429'];
    } else {
      config = ERROR_MESSAGES['UNKNOWN_ERROR'];
    }
  }

  // If we have original technical message, append it for debugging
  return {
    ...config,
    message: originalMessage && originalMessage !== config.message
      ? `${config.message} (${originalMessage})`
      : config.message,
  };
}

/**
 * Check if error is retryable (user should try again)
 */
export function isRetryableError(category: ErrorMessageConfig['category']): boolean {
  return ['network', 'timeout', 'server'].includes(category);
}

/**
 * Check if error requires authentication
 */
export function requiresAuth(code: string, status?: number): boolean {
  return code === 'HTTP_401' || code === 'TOKEN_EXPIRED' || status === 401;
}

/**
 * Check if error suggests upgrading subscription
 */
export function suggestsUpgrade(code: string, status?: number): boolean {
  return ['HTTP_403', 'HTTP_429', 'QUOTA_EXCEEDED'].includes(code) ||
    status === 403 || status === 429;
}
