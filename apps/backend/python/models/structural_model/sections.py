import sys
import os
from typing import Set

# Import section database for profile validation
try:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from data import section_database
    KNOWN_SECTIONS: Set[str] = set(section_database.SECTION_DATABASE.keys()) if hasattr(section_database, 'SECTION_DATABASE') else set()
except Exception:
    KNOWN_SECTIONS = set()

# Fallback: common IS/US/EU sections
FALLBACK_SECTIONS: Set[str] = {
    'ISMB100', 'ISMB150', 'ISMB200', 'ISMB250', 'ISMB300', 'ISMB350',
    'ISMB400', 'ISMB450', 'ISMB500', 'ISMB550', 'ISMB600',
    'ISMC75', 'ISMC100', 'ISMC125', 'ISMC150', 'ISMC175', 'ISMC200',
    'ISMC225', 'ISMC250', 'ISMC300', 'ISMC350', 'ISMC400',
    'ISA50x50x5', 'ISA65x65x6', 'ISA75x75x6', 'ISA100x100x8',
    'W8X31', 'W10X49', 'W12X65', 'W14X82', 'W16X100', 'W18X119',
    'HEA100', 'HEA120', 'HEA140', 'HEA160', 'HEA180', 'HEA200',
    'IPE100', 'IPE120', 'IPE140', 'IPE160', 'IPE180', 'IPE200',
}

VALID_SECTIONS: Set[str] = KNOWN_SECTIONS | FALLBACK_SECTIONS

__all__ = ["VALID_SECTIONS", "KNOWN_SECTIONS", "FALLBACK_SECTIONS"]
