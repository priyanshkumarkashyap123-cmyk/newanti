"""
Validation Framework for Structural Analysis
Provides comprehensive pre-analysis validation to catch errors before solving
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


class ValidationSeverity(Enum):
    """Severity levels for validation issues"""
    ERROR = "error"  # Blocks analysis
    WARNING = "warning"  # Allows analysis but user should review
    INFO = "info"  # Informational only


@dataclass
class ValidationMessage:
    """A single validation issue"""
    severity: ValidationSeverity
    code: str
    message: str
    suggestion: str
    affected_elements: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'severity': self.severity.value,
            'code': self.code,
            'message': self.message,
            'suggestion': self.suggestion,
            'affected_elements': self.affected_elements
        }


@dataclass
class ValidationResult:
    """Result of validation check"""
    is_valid: bool
    messages: List[ValidationMessage]
    
    def has_errors(self) -> bool:
        """Check if any errors exist"""
        return any(m.severity == ValidationSeverity.ERROR for m in self.messages)
    
    def has_warnings(self) -> bool:
        """Check if any warnings exist"""
        return any(m.severity == ValidationSeverity.WARNING for m in self.messages)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'is_valid': self.is_valid,
            'has_errors': self.has_errors(),
            'has_warnings': self.has_warnings(),
            'messages': [m.to_dict() for m in self.messages]
        }


class BaseValidator:
    """Base class for all validators"""
    
    def __init__(self):
        self.messages: List[ValidationMessage] = []
    
    def add_error(self, code: str, message: str, suggestion: str, affected_elements: List[str] = None):
        """Add an error message"""
        self.messages.append(ValidationMessage(
            severity=ValidationSeverity.ERROR,
            code=code,
            message=message,
            suggestion=suggestion,
            affected_elements=affected_elements or []
        ))
    
    def add_warning(self, code: str, message: str, suggestion: str, affected_elements: List[str] = None):
        """Add a warning message"""
        self.messages.append(ValidationMessage(
            severity=ValidationSeverity.WARNING,
            code=code,
            message=message,
            suggestion=suggestion,
            affected_elements=affected_elements or []
        ))
    
    def add_info(self, code: str, message: str, suggestion: str = "", affected_elements: List[str] = None):
        """Add an info message"""
        self.messages.append(ValidationMessage(
            severity=ValidationSeverity.INFO,
            code=code,
            message=message,
            suggestion=suggestion,
            affected_elements=affected_elements or []
        ))
    
    def has_errors(self) -> bool:
        """Check if validator has errors"""
        return any(m.severity == ValidationSeverity.ERROR for m in self.messages)
    
    def get_result(self) -> ValidationResult:
        """Get validation result"""
        return ValidationResult(
            is_valid=not self.has_errors(),
            messages=self.messages
        )
