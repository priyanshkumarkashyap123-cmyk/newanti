from .framework import DesignFactory, DesignCode, DesignMember, DesignResult
from .aisc360_16 import AISC360_16
from .eurocode3 import Eurocode3
from .concrete.aci_318 import ACI318
from .concrete.eurocode2 import Eurocode2
from .steel.bs5950 import BS5950
from .steel.as4100 import AS4100
from .steel.is800 import IS800Designer

# Register available codes
DesignFactory.register("AISC360-16", AISC360_16)
DesignFactory.register("Eurocode3", Eurocode3)
DesignFactory.register("ACI318-19", ACI318)
DesignFactory.register("Eurocode2", Eurocode2)
DesignFactory.register("BS5950", BS5950)
DesignFactory.register("AS4100", AS4100)
# Note: IS800Designer uses its own API (section-level design)
# and is wired through /design/steel endpoint in routers/design.py

# Export key classes
__all__ = ['DesignFactory', 'DesignCode', 'DesignMember', 'DesignResult', 'IS800Designer']
