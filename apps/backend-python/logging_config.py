"""
logging_config.py - Structured JSON logging for production environments.

Usage:
    from logging_config import get_logger
    logger = get_logger(__name__)
    logger.info("Request processed", extra={"request_id": "abc", "duration_ms": 42})

In development (ENVIRONMENT != 'production'), outputs human-readable logs.
In production, outputs single-line JSON per log entry for log aggregators
(Azure Monitor, ELK, Datadog, etc.).
"""

import logging
import json
import sys
import os
import traceback
from datetime import datetime, timezone
from typing import Any


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON for structured log ingestion."""

    def __init__(self, service_name: str = "beamlab-python-api"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self.service_name,
        }

        # Merge any extra fields passed via `extra={...}`
        # Exclude standard LogRecord attributes
        _RESERVED = logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
        for key, value in record.__dict__.items():
            if key not in _RESERVED and key not in ("message", "msg", "args"):
                log_entry[key] = value

        # Include exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stacktrace": traceback.format_exception(*record.exc_info),
            }

        # Include stack info if present
        if record.stack_info:
            log_entry["stack_info"] = record.stack_info

        return json.dumps(log_entry, default=str, ensure_ascii=False)


class DevFormatter(logging.Formatter):
    """Human-readable colored log format for local development."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[1;31m", # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        timestamp = datetime.fromtimestamp(record.created).strftime("%H:%M:%S.%f")[:-3]
        base = f"{color}[{timestamp}] {record.levelname:8s}{self.RESET} {record.name}: {record.getMessage()}"

        # Append extra fields if any
        _RESERVED = logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
        extras = {
            k: v for k, v in record.__dict__.items()
            if k not in _RESERVED and k not in ("message", "msg", "args")
        }
        if extras:
            base += f"  {color}| {extras}{self.RESET}"

        if record.exc_info and record.exc_info[0] is not None:
            base += "\n" + "".join(traceback.format_exception(*record.exc_info))

        return base


def setup_logging(
    level: str | None = None,
    service_name: str = "beamlab-python-api",
) -> None:
    """
    Configure the root logger for the application.

    - In production: JSON output to stdout for log aggregators.
    - In development: colored human-readable output.
    """
    environment = os.getenv("ENVIRONMENT", os.getenv("PYTHON_ENV", "development")).lower()
    is_production = environment in ("production", "prod", "staging")

    log_level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()

    # Clear any existing handlers
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(getattr(logging, log_level, logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, log_level, logging.INFO))

    if is_production:
        handler.setFormatter(JSONFormatter(service_name=service_name))
    else:
        handler.setFormatter(DevFormatter())

    root.addHandler(handler)

    # Quiet noisy third-party loggers
    for noisy in ("uvicorn.access", "uvicorn.error", "httpcore", "httpx", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger. Call setup_logging() first at app startup."""
    return logging.getLogger(name)


# Auto-configure only if no handlers have been configured yet
if not logging.getLogger().handlers:
    setup_logging()
