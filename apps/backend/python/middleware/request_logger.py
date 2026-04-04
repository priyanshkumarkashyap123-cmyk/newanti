"""
Python Request ID and Structured Logging Middleware

Extracts or generates request IDs for end-to-end tracing across
Node → Python → Rust call chains.

Provides JSON-formatted structured logging with request context.
"""

import logging
import json
import time
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Extract or generate request ID from X-Request-ID header.
    
    Attaches to request.state.request_id for logging throughout handler lifecycle.
    
    Header Priority:
    1. X-Request-ID (from upstream)
    2. Generate new UUID4
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract or generate request ID
        request_id = request.headers.get('x-request-id') or str(uuid.uuid4())
        
        # Attach to request state for downstream use
        request.state.request_id = request_id
        
        # Timestamp request arrival
        start_time = time.time()
        
        # Add to request headers for upstream context
        request.headers.__dict__['x-request-id'] = request_id
        
        # Get logger and add request context
        logger = logging.getLogger(__name__)
        print(json.dumps({
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(start_time)) + 'Z',
            'level': 'INFO',
            'service': 'python-api',
            'request_id': request_id,
            'action': 'REQUEST_START',
            'method': request.method,
            'path': request.url.path,
            'query': dict(request.query_params),
        }), flush=True)
        
        try:
            # Call handler
            response = await call_next(request)
            
            # Measure duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log request completion
            print(json.dumps({
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + 'Z',
                'level': 'INFO',
                'service': 'python-api',
                'request_id': request_id,
                'action': 'REQUEST_END',
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'duration_ms': f'{duration_ms:.1f}',
            }), flush=True)
            
            return response
            
        except Exception as exc:
            # Log exception with request ID
            duration_ms = (time.time() - start_time) * 1000
            print(json.dumps({
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + 'Z',
                'level': 'ERROR',
                'service': 'python-api',
                'request_id': request_id,
                'action': 'REQUEST_ERROR',
                'method': request.method,
                'path': request.url.path,
                'error': str(exc),
                'error_type': type(exc).__name__,
                'duration_ms': f'{duration_ms:.1f}',
            }), flush=True)
            raise


def get_request_id(request: Request) -> str:
    """
    Extract request ID from request state.
    
    Usage in handler:
        @app.get('/health')
        async def health(request: Request):
            request_id = get_request_id(request)
            # ... handler logic
    """
    return getattr(request.state, 'request_id', 'unknown')


def log_with_request_id(request_id: str, level: str, action: str, **kwargs):
    """
    Helper to log structured message with request context.
    
    Usage:
        log_with_request_id(request_id, 'INFO', 'DESIGN_CHECK',
                           status='success', member_count=5)
    """
    log_entry = {
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + 'Z',
        'level': level,
        'service': 'python-api',
        'request_id': request_id,
        'action': action,
        **kwargs,
    }
    print(json.dumps(log_entry), flush=True)
