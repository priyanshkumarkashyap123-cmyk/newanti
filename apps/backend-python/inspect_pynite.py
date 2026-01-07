from PyNite import FEModel3D
import inspect

print("add_member signature:")
try:
    print(inspect.signature(FEModel3D.add_member))
except Exception as e:
    print(e)
