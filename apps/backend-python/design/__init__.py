from .framework import DesignFactory, DesignCode, DesignMember, DesignResult
from .aisc360_16 import AISC360_16
from .eurocode3 import Eurocode3

# Register available codes
DesignFactory.register("AISC360-16", AISC360_16)
DesignFactory.register("Eurocode3", Eurocode3)

# Export key classes
__all__ = ['DesignFactory', 'DesignCode', 'DesignMember', 'DesignResult']
