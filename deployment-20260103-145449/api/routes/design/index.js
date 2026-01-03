import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function runPythonDesign(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    const python = spawn("python3", ["-c", `
import sys
import json

# Add project path
sys.path.insert(0, '${path.join(__dirname, "../../../backend-python")}')

# Parse input
input_data = json.loads('''${JSON.stringify(inputData)}''')

# Run the appropriate design function
${scriptPath}

# Output result
print(json.dumps(result))
`], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python stderr:", stderr);
        reject(new Error(`Design script failed: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse design result: ${stdout}`));
      }
    });
    python.stdin.end();
  });
}
router.post("/steel", async (req, res) => {
  try {
    const request = req.body;
    if (!request.section || !request.forces) {
      res.status(400).json({
        success: false,
        error: "Missing section or forces data"
      });
      return;
    }
    const pythonScript = request.code === "AISC360" ? `
from design.steel.aisc360 import AISC360Designer, DesignMethod
from design.steel.is800 import SectionProperties, MemberGeometry, DesignForces

section = SectionProperties(
    name=input_data['section']['name'],
    area=input_data['section']['area'],
    depth=input_data['section']['depth'],
    width=input_data['section']['width'],
    web_thickness=input_data['section']['webThickness'],
    flange_thickness=input_data['section']['flangeThickness'],
    Iy=input_data['section']['Iy'],
    Iz=input_data['section']['Iz'],
    Zy=input_data['section'].get('Zy', input_data['section']['Iz'] / (input_data['section']['depth'] / 2)),
    Zz=input_data['section'].get('Zz', input_data['section']['Iy'] / (input_data['section']['width'] / 2)),
    ry=input_data['section']['ry'],
    rz=input_data['section']['rz']
)

geometry = MemberGeometry(
    length=input_data['geometry']['length'],
    effective_length_y=input_data['geometry'].get('effectiveLengthY'),
    effective_length_z=input_data['geometry'].get('effectiveLengthZ'),
    unbraced_length=input_data['geometry'].get('unbracedLength'),
    Cb=input_data['geometry'].get('Cb', 1.0)
)

forces = DesignForces(
    N=input_data['forces']['N'],
    Vy=input_data['forces']['Vy'],
    Vz=input_data['forces']['Vz'],
    My=input_data['forces']['My'],
    Mz=input_data['forces']['Mz']
)

method = DesignMethod.LRFD if input_data.get('designMethod', 'LRFD') == 'LRFD' else DesignMethod.ASD
designer = AISC360Designer(
    section=section,
    Fy=input_data['material']['fy'],
    Fu=input_data['material']['fu'],
    E=input_data['material'].get('E', 200000),
    method=method
)

# Run checks
Pt, tension_check = designer.get_tension_capacity()
Pc, compression_check = designer.get_compression_capacity(geometry)
Mc, moment_check = designer.get_moment_capacity(geometry)
Vc, shear_check = designer.get_shear_capacity()
interaction = designer.check_interaction(forces, geometry)

result = {
    'code': 'AISC360',
    'method': method.value,
    'tension_capacity': Pt,
    'compression_capacity': Pc,
    'moment_capacity': Mc,
    'shear_capacity': Vc,
    'interaction_ratio': interaction.ratio,
    'status': interaction.status,
    'checks': [
        {'name': 'Tension', 'ratio': abs(forces.N) / Pt if Pt > 0 and forces.N > 0 else 0},
        {'name': 'Compression', 'ratio': abs(forces.N) / Pc if Pc > 0 and forces.N < 0 else 0},
        {'name': 'Moment', 'ratio': abs(forces.Mz) / Mc if Mc > 0 else 0},
        {'name': 'Shear', 'ratio': abs(forces.Vy) / Vc if Vc > 0 else 0},
        {'name': 'Interaction', 'ratio': interaction.ratio}
    ]
}
` : `
from design.steel.is800 import IS800Designer, SectionProperties, MemberGeometry, DesignForces

section = SectionProperties(
    name=input_data['section']['name'],
    area=input_data['section']['area'],
    depth=input_data['section']['depth'],
    width=input_data['section']['width'],
    web_thickness=input_data['section']['webThickness'],
    flange_thickness=input_data['section']['flangeThickness'],
    Iy=input_data['section']['Iy'],
    Iz=input_data['section']['Iz'],
    Zy=input_data['section'].get('Zy', input_data['section']['Iz'] / (input_data['section']['depth'] / 2)),
    Zz=input_data['section'].get('Zz', input_data['section']['Iy'] / (input_data['section']['width'] / 2)),
    ry=input_data['section']['ry'],
    rz=input_data['section']['rz']
)

geometry = MemberGeometry(
    length=input_data['geometry']['length'],
    effective_length_y=input_data['geometry'].get('effectiveLengthY'),
    effective_length_z=input_data['geometry'].get('effectiveLengthZ'),
    unbraced_length=input_data['geometry'].get('unbracedLength'),
    Cb=input_data['geometry'].get('Cb', 1.0)
)

forces = DesignForces(
    N=input_data['forces']['N'],
    Vy=input_data['forces']['Vy'],
    Vz=input_data['forces']['Vz'],
    My=input_data['forces']['My'],
    Mz=input_data['forces']['Mz']
)

designer = IS800Designer(
    section=section,
    fy=input_data['material']['fy'],
    fu=input_data['material']['fu'],
    E=input_data['material'].get('E', 200000)
)

design_result = designer.design_member(geometry, forces)

result = {
    'code': 'IS800',
    'section_class': design_result.section_class.value,
    'tension_capacity': design_result.tension_capacity,
    'compression_capacity': design_result.compression_capacity,
    'moment_capacity_z': design_result.moment_capacity_z,
    'moment_capacity_y': design_result.moment_capacity_y,
    'shear_capacity': design_result.shear_capacity,
    'interaction_ratio': design_result.interaction_ratio,
    'status': design_result.status,
    'checks': [c.__dict__ for c in design_result.checks]
}
`;
    const result = await runPythonDesign(pythonScript, request);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[Design/Steel] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Steel design failed"
    });
  }
});
router.post("/concrete/beam", async (req, res) => {
  try {
    const request = req.body;
    const pythonScript = `
from design.concrete.is456 import IS456Designer, BeamSection

section = BeamSection(
    width=input_data['section']['width'],
    depth=input_data['section']['depth'],
    effective_depth=input_data['section']['effectiveDepth'],
    cover=input_data['section'].get('cover', 40)
)

designer = IS456Designer(
    fck=input_data['material']['fck'],
    fy=input_data['material']['fy']
)

design_result = designer.design_beam(
    section=section,
    Mu=input_data['forces']['Mu'],
    Vu=input_data['forces']['Vu']
)

result = {
    'tension_steel': {
        'diameter': design_result.tension_steel.diameter,
        'count': design_result.tension_steel.count,
        'area': design_result.tension_steel.area
    },
    'compression_steel': {
        'diameter': design_result.compression_steel.diameter if design_result.compression_steel else 0,
        'count': design_result.compression_steel.count if design_result.compression_steel else 0,
        'area': design_result.compression_steel.area if design_result.compression_steel else 0
    } if design_result.compression_steel else None,
    'stirrups': {
        'diameter': design_result.stirrups.diameter,
        'spacing': design_result.stirrups.spacing
    },
    'Mu_capacity': design_result.Mu_capacity,
    'Vu_capacity': design_result.Vu_capacity,
    'status': design_result.status,
    'checks': design_result.checks
}
`;
    const result = await runPythonDesign(pythonScript, request);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[Design/Concrete/Beam] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Concrete beam design failed"
    });
  }
});
router.post("/concrete/column", async (req, res) => {
  try {
    const request = req.body;
    const pythonScript = `
from design.concrete.is456 import IS456Designer, ColumnSection

section = ColumnSection(
    width=input_data['section']['width'],
    depth=input_data['section']['depth'],
    cover=input_data['section'].get('cover', 40)
)

designer = IS456Designer(
    fck=input_data['material']['fck'],
    fy=input_data['material']['fy']
)

design_result = designer.design_column(
    section=section,
    Pu=input_data['forces']['Pu'],
    Mux=input_data['forces']['Mux'],
    Muy=input_data['forces']['Muy'],
    unsupported_length=input_data['geometry']['unsupportedLength'],
    effective_length_factor=input_data['geometry'].get('effectiveLengthFactor', 1.0)
)

result = {
    'longitudinal_steel': [{
        'diameter': bar.diameter,
        'count': bar.count,
        'area': bar.area
    } for bar in design_result.longitudinal_steel],
    'ties': {
        'diameter': design_result.ties.diameter,
        'spacing': design_result.ties.spacing
    },
    'Pu_capacity': design_result.Pu_capacity,
    'Mux_capacity': design_result.Mux_capacity,
    'Muy_capacity': design_result.Muy_capacity,
    'interaction_ratio': design_result.interaction_ratio,
    'status': design_result.status,
    'checks': design_result.checks
}
`;
    const result = await runPythonDesign(pythonScript, request);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[Design/Concrete/Column] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Concrete column design failed"
    });
  }
});
router.post("/connection", async (req, res) => {
  try {
    const request = req.body;
    let pythonScript = "";
    if (request.type === "bolted_shear") {
      pythonScript = `
from design.connections.steel_joints import ConnectionDesigner, BoltedConnection, BoltGrade

bolt_grade_map = {
    '4.6': BoltGrade.GRADE_4_6,
    '4.8': BoltGrade.GRADE_4_8,
    '5.6': BoltGrade.GRADE_5_6,
    '5.8': BoltGrade.GRADE_5_8,
    '6.8': BoltGrade.GRADE_6_8,
    '8.8': BoltGrade.GRADE_8_8,
    '10.9': BoltGrade.GRADE_10_9,
    '12.9': BoltGrade.GRADE_12_9
}

bolt_data = input_data.get('bolt', {})
grade_str = bolt_data.get('grade', '8.8')
bolt_grade = bolt_grade_map.get(grade_str, BoltGrade.GRADE_8_8)

conn = BoltedConnection(
    bolt_diameter=bolt_data.get('diameter', 20),
    bolt_grade=bolt_grade,
    num_bolts=bolt_data.get('numBolts', 4),
    rows=bolt_data.get('rows', 2),
    columns=bolt_data.get('columns', 2),
    pitch=bolt_data.get('pitch', 60),
    gauge=bolt_data.get('gauge', 80),
    edge_distance=bolt_data.get('edgeDistance', 40),
    end_distance=bolt_data.get('endDistance', 40),
    plate_thickness=input_data.get('plate', {}).get('thickness', 10)
)

material = input_data.get('material', {})
designer = ConnectionDesigner(
    fu=material.get('fu', 410),
    fy=material.get('fy', 250)
)

design_result = designer.design_bolt_shear(conn, input_data['forces'].get('shear', 0))

result = {
    'type': 'bolted_shear',
    'capacity': design_result.capacity,
    'demand': design_result.demand,
    'ratio': design_result.ratio,
    'status': design_result.status,
    'checks': design_result.checks
}
`;
    } else if (request.type === "welded") {
      pythonScript = `
from design.connections.steel_joints import ConnectionDesigner, WeldedConnection, WeldType

weld_data = input_data.get('weld', {})
weld_type = WeldType.FILLET if weld_data.get('type', 'fillet') == 'fillet' else WeldType.BUTT

weld = WeldedConnection(
    weld_type=weld_type,
    weld_size=weld_data.get('size', 6),
    weld_length=weld_data.get('length', 100)
)

material = input_data.get('material', {})
designer = ConnectionDesigner(
    fu=material.get('fu', 410),
    fy=material.get('fy', 250)
)

force = input_data['forces'].get('shear', 0) or input_data['forces'].get('tension', 0)
design_result = designer.design_fillet_weld(weld, force)

result = {
    'type': 'welded',
    'capacity': design_result.capacity,
    'demand': design_result.demand,
    'ratio': design_result.ratio,
    'status': design_result.status,
    'checks': design_result.checks
}
`;
    } else if (request.type === "base_plate") {
      pythonScript = `
from design.connections.steel_joints import ConnectionDesigner, BasePlate

plate_data = input_data.get('plate', {})
plate = BasePlate(
    width=plate_data.get('width', 400),
    length=plate_data.get('length', 400),
    thickness=plate_data.get('thickness', 25),
    fy_plate=plate_data.get('fy', 250),
    concrete_fck=input_data.get('concrete', {}).get('fck', 25),
    pedestal_width=plate_data.get('pedestalWidth', 500),
    pedestal_length=plate_data.get('pedestalLength', 500)
)

material = input_data.get('material', {})
designer = ConnectionDesigner(
    fu=material.get('fu', 410),
    fy=material.get('fy', 250)
)

design_result = designer.design_base_plate(
    plate,
    Pu=input_data['forces'].get('axial', 0),
    Mu=input_data['forces'].get('moment', 0),
    Vu=input_data['forces'].get('shear', 0)
)

result = {
    'type': 'base_plate',
    'capacity': design_result.capacity,
    'demand': design_result.demand,
    'ratio': design_result.ratio,
    'status': design_result.status,
    'checks': design_result.checks
}
`;
    } else {
      res.status(400).json({
        success: false,
        error: `Unknown connection type: ${request.type}`
      });
      return;
    }
    const result = await runPythonDesign(pythonScript, request);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[Design/Connection] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Connection design failed"
    });
  }
});
router.post("/foundation", async (req, res) => {
  try {
    const request = req.body;
    const pythonScript = `
from design.foundation.footing import FoundationDesigner, SoilProfile, SoilType, ColumnLoad, IsolatedFooting

soil_type_map = {
    'soft_clay': SoilType.SOFT_CLAY,
    'medium_clay': SoilType.MEDIUM_CLAY,
    'stiff_clay': SoilType.STIFF_CLAY,
    'loose_sand': SoilType.LOOSE_SAND,
    'medium_sand': SoilType.MEDIUM_SAND,
    'dense_sand': SoilType.DENSE_SAND,
    'gravel': SoilType.GRAVEL,
    'rock': SoilType.ROCK
}

soil_data = input_data.get('soil', {})
soil_type = soil_type_map.get(soil_data.get('soilType', 'medium_sand'), SoilType.MEDIUM_SAND)

soil = SoilProfile(
    bearing_capacity=soil_data.get('bearingCapacity', 150),
    soil_type=soil_type,
    depth_to_water=10,
    subgrade_modulus=50000
)

designer = FoundationDesigner(soil)

loads_data = input_data.get('loads', [])
if not loads_data:
    loads_data = [{'P': 500}]

col_size = input_data.get('columnSize', {'width': 400, 'depth': 400})
column_size = (col_size['width'] / 1000, col_size['depth'] / 1000)

if input_data['type'] == 'isolated':
    load = ColumnLoad(
        P=loads_data[0].get('P', 500),
        Mx=loads_data[0].get('Mx', 0),
        My=loads_data[0].get('My', 0)
    )
    
    footing = designer.size_isolated_footing(load, column_size, input_data.get('minDepth', 0.45))
    design_result = designer.design_isolated_footing(footing, load, column_size)
    
    result = {
        'type': 'isolated',
        'dimensions': design_result.dimensions,
        'reinforcement': design_result.reinforcement,
        'bearing_ratio': design_result.bearing_check,
        'punching_ratio': design_result.punching_check,
        'shear_ratio': design_result.one_way_shear,
        'flexure_ratio': design_result.flexure_check,
        'status': design_result.status,
        'checks': design_result.checks
    }

elif input_data['type'] == 'combined':
    loads = [ColumnLoad(
        P=ld.get('P', 500),
        Mx=ld.get('Mx', 0),
        My=ld.get('My', 0),
        x=ld.get('x', 0),
        y=ld.get('y', 0)
    ) for ld in loads_data]
    
    column_sizes = [column_size] * len(loads)
    design_result = designer.design_combined_footing(loads, column_sizes, input_data.get('minDepth', 0.6))
    
    result = {
        'type': 'combined',
        'dimensions': design_result.dimensions,
        'reinforcement': design_result.reinforcement,
        'bearing_ratio': design_result.bearing_check,
        'punching_ratio': design_result.punching_check,
        'flexure_ratio': design_result.flexure_check,
        'status': design_result.status,
        'checks': design_result.checks
    }

elif input_data['type'] == 'mat':
    loads = [ColumnLoad(
        P=ld.get('P', 500),
        Mx=ld.get('Mx', 0),
        My=ld.get('My', 0),
        x=ld.get('x', 0),
        y=ld.get('y', 0)
    ) for ld in loads_data]
    
    column_sizes = [column_size] * len(loads)
    design_result = designer.design_mat_foundation(loads, column_sizes, input_data.get('minDepth', 0.6))
    
    result = {
        'type': 'mat',
        'dimensions': design_result.dimensions,
        'reinforcement': design_result.reinforcement,
        'bearing_ratio': design_result.bearing_check,
        'punching_ratio': design_result.punching_check,
        'flexure_ratio': design_result.flexure_check,
        'status': design_result.status,
        'checks': design_result.checks
    }
else:
    result = {'error': f"Unknown foundation type: {input_data['type']}"}
`;
    const result = await runPythonDesign(pythonScript, request);
    res.json({ success: true, result });
  } catch (error) {
    console.error("[Design/Foundation] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Foundation design failed"
    });
  }
});
router.get("/codes", (_req, res) => {
  res.json({
    success: true,
    codes: {
      steel: [
        { code: "IS800", name: "IS 800:2007", country: "India", description: "Limit State Method" },
        { code: "AISC360", name: "AISC 360-16", country: "USA", description: "LRFD/ASD Methods" }
      ],
      concrete: [
        { code: "IS456", name: "IS 456:2000", country: "India", description: "Limit State Method" }
      ],
      connections: [
        { code: "IS800_CONN", name: "IS 800:2007 Chapter 10", country: "India" }
      ],
      foundations: [
        { code: "IS456_FOUND", name: "IS 456:2000 + IS 1904", country: "India" }
      ]
    }
  });
});
var design_default = router;
export {
  design_default as default
};
//# sourceMappingURL=index.js.map
