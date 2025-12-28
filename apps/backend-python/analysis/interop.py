"""
interop.py - Interoperability and Data Exchange Module

Provides data exchange capabilities:
- OpenBeam REST API wrapper
- STAAD.Pro file import/export
- SAP2000 file exchange
- Excel/CSV export
- JSON/IFC data models
- DXF geometry import

Reference: Industry standard file formats
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Optional, Any, Union
from enum import Enum
import json
import csv
import io
import math
import re


# ============================================
# DATA MODELS
# ============================================

@dataclass
class Node:
    """Node in structural model"""
    id: int
    x: float
    y: float
    z: float = 0
    support: Optional[str] = None  # 'FIXED', 'PINNED', etc.


@dataclass
class Member:
    """Member connecting two nodes"""
    id: int
    start_node: int
    end_node: int
    section: str
    material: str = 'Steel'
    releases: Optional[str] = None  # Member end releases


@dataclass
class LoadCase:
    """Load case definition"""
    name: str
    type: str  # 'DEAD', 'LIVE', 'WIND', 'SEISMIC'
    factor: float = 1.0


@dataclass
class NodalLoad:
    """Load applied at a node"""
    node_id: int
    load_case: str
    Fx: float = 0
    Fy: float = 0
    Fz: float = 0
    Mx: float = 0
    My: float = 0
    Mz: float = 0


@dataclass
class MemberLoad:
    """Distributed or point load on member"""
    member_id: int
    load_case: str
    load_type: str  # 'UDL', 'POINT', 'TRAPEZOIDAL'
    direction: str  # 'GY', 'LY', 'GX', 'LZ'
    values: List[float]  # [w] for UDL, [P, a] for point, [w1, w2] for trapez
    start_pos: float = 0
    end_pos: float = 1


@dataclass
class StructuralModel:
    """Complete structural model"""
    title: str
    nodes: List[Node]
    members: List[Member]
    load_cases: List[LoadCase]
    nodal_loads: List[NodalLoad]
    member_loads: List[MemberLoad]
    units: str = 'SI'  # 'SI' or 'IMPERIAL'


# ============================================
# FILE FORMAT HANDLERS
# ============================================

class STAADImporter:
    """
    Import STAAD.Pro input files (.std)
    """
    
    def __init__(self):
        self.model = None
        self.current_load_case = None
    
    def parse(self, content: str) -> StructuralModel:
        """Parse STAAD input file content"""
        lines = content.strip().split('\n')
        
        nodes = []
        members = []
        load_cases = []
        nodal_loads = []
        member_loads = []
        title = "Imported Model"
        
        i = 0
        while i < len(lines):
            line = lines[i].strip().upper()
            
            # Title
            if line.startswith('STAAD'):
                title = line
            
            # Joint coordinates
            elif 'JOINT COORDINATES' in line:
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(('MEMBER', 'END', 'CONSTANTS')):
                    parts = lines[i].strip().split()
                    if len(parts) >= 4 and parts[0].isdigit():
                        nodes.append(Node(
                            id=int(parts[0]),
                            x=float(parts[1]),
                            y=float(parts[2]),
                            z=float(parts[3]) if len(parts) > 3 else 0
                        ))
                    i += 1
                continue
            
            # Member incidences
            elif 'MEMBER INCIDENCES' in line:
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(('MEMBER PROPERTY', 'CONSTANTS', 'SUPPORTS', 'LOAD')):
                    parts = lines[i].strip().split()
                    if len(parts) >= 3 and parts[0].isdigit():
                        members.append(Member(
                            id=int(parts[0]),
                            start_node=int(parts[1]),
                            end_node=int(parts[2]),
                            section='DEFAULT'
                        ))
                    i += 1
                continue
            
            # Supports
            elif line.startswith('SUPPORTS'):
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(('LOAD', 'MEMBER', 'PERFORM')):
                    parts = lines[i].strip().split()
                    if len(parts) >= 2:
                        node_ids = self._parse_node_list(parts[0])
                        support_type = parts[1] if len(parts) > 1 else 'FIXED'
                        for node_id in node_ids:
                            for node in nodes:
                                if node.id == node_id:
                                    node.support = support_type
                    i += 1
                continue
            
            # Load case
            elif line.startswith('LOAD') and 'LOADTYPE' in line:
                parts = line.split()
                case_num = parts[1] if len(parts) > 1 else '1'
                case_name = f"LC{case_num}"
                load_cases.append(LoadCase(name=case_name, type='DEAD'))
                self.current_load_case = case_name
            
            # Joint loads
            elif 'JOINT LOAD' in line:
                i += 1
                while i < len(lines):
                    jl = lines[i].strip()
                    if jl.upper().startswith(('MEMBER LOAD', 'LOAD', 'PERFORM', 'FINISH')):
                        break
                    parts = jl.split()
                    if len(parts) >= 3 and parts[0].isdigit():
                        node_id = int(parts[0])
                        # Parse forces
                        fx, fy, fz, mx, my, mz = 0, 0, 0, 0, 0, 0
                        j = 1
                        while j < len(parts) - 1:
                            direction = parts[j].upper()
                            value = float(parts[j + 1])
                            if direction == 'FX':
                                fx = value
                            elif direction == 'FY':
                                fy = value
                            elif direction == 'FZ':
                                fz = value
                            j += 2
                        
                        nodal_loads.append(NodalLoad(
                            node_id=node_id,
                            load_case=self.current_load_case or 'LC1',
                            Fx=fx, Fy=fy, Fz=fz
                        ))
                    i += 1
                continue
            
            # Member loads
            elif 'MEMBER LOAD' in line:
                i += 1
                while i < len(lines):
                    ml = lines[i].strip()
                    if ml.upper().startswith(('JOINT LOAD', 'LOAD', 'PERFORM', 'FINISH')):
                        break
                    parts = ml.split()
                    if len(parts) >= 3:
                        member_ids = self._parse_member_list(parts[0])
                        load_type = 'UDL'
                        direction = 'GY'
                        values = []
                        
                        for part in parts[1:]:
                            if part.upper() in ['UNI', 'UDL']:
                                load_type = 'UDL'
                            elif part.upper() == 'CON':
                                load_type = 'POINT'
                            elif part.upper() in ['GX', 'GY', 'GZ', 'LX', 'LY', 'LZ']:
                                direction = part.upper()
                            else:
                                try:
                                    values.append(float(part))
                                except ValueError:
                                    pass
                        
                        for member_id in member_ids:
                            member_loads.append(MemberLoad(
                                member_id=member_id,
                                load_case=self.current_load_case or 'LC1',
                                load_type=load_type,
                                direction=direction,
                                values=values
                            ))
                    i += 1
                continue
            
            i += 1
        
        if not load_cases:
            load_cases.append(LoadCase(name='LC1', type='DEAD'))
        
        self.model = StructuralModel(
            title=title,
            nodes=nodes,
            members=members,
            load_cases=load_cases,
            nodal_loads=nodal_loads,
            member_loads=member_loads
        )
        
        return self.model
    
    def _parse_node_list(self, s: str) -> List[int]:
        """Parse node list like '1 2 3' or '1 TO 5'"""
        result = []
        if 'TO' in s.upper():
            parts = s.upper().split('TO')
            start = int(parts[0].strip())
            end = int(parts[1].strip())
            result = list(range(start, end + 1))
        else:
            for part in s.split():
                if part.isdigit():
                    result.append(int(part))
        return result
    
    def _parse_member_list(self, s: str) -> List[int]:
        """Parse member list"""
        return self._parse_node_list(s)


class STAADExporter:
    """
    Export to STAAD.Pro input format
    """
    
    def export(self, model: StructuralModel) -> str:
        """Generate STAAD input file content"""
        lines = [
            "STAAD SPACE",
            f"* {model.title}",
            "START JOB INFORMATION",
            "END JOB INFORMATION",
            f"INPUT WIDTH 79",
            f"UNIT {'METER KN' if model.units == 'SI' else 'FEET KIP'}",
            ""
        ]
        
        # Joint coordinates
        lines.append("JOINT COORDINATES")
        for node in model.nodes:
            lines.append(f"{node.id} {node.x:.4f} {node.y:.4f} {node.z:.4f}")
        lines.append("")
        
        # Member incidences
        lines.append("MEMBER INCIDENCES")
        for member in model.members:
            lines.append(f"{member.id} {member.start_node} {member.end_node}")
        lines.append("")
        
        # Member properties (simplified)
        lines.append("MEMBER PROPERTY AMERICAN")
        sections = set(m.section for m in model.members)
        for section in sections:
            member_ids = [m.id for m in model.members if m.section == section]
            lines.append(f"{' '.join(map(str, member_ids))} PRIS YD 0.3 ZD 0.3")
        lines.append("")
        
        # Constants
        lines.append("CONSTANTS")
        lines.append("E 2.1e8 ALL")
        lines.append("POISSON 0.3 ALL")
        lines.append("DENSITY 78.5 ALL")
        lines.append("")
        
        # Supports
        lines.append("SUPPORTS")
        supported_nodes = [n for n in model.nodes if n.support]
        for node in supported_nodes:
            lines.append(f"{node.id} {node.support or 'FIXED'}")
        lines.append("")
        
        # Load cases
        for lc in model.load_cases:
            lines.append(f"LOAD {lc.name} LOADTYPE {lc.type}")
            lines.append("SELFWEIGHT Y -1.0")
            
            # Nodal loads
            case_nodal = [nl for nl in model.nodal_loads if nl.load_case == lc.name]
            if case_nodal:
                lines.append("JOINT LOAD")
                for nl in case_nodal:
                    load_str = f"{nl.node_id}"
                    if nl.Fx != 0:
                        load_str += f" FX {nl.Fx}"
                    if nl.Fy != 0:
                        load_str += f" FY {nl.Fy}"
                    if nl.Fz != 0:
                        load_str += f" FZ {nl.Fz}"
                    lines.append(load_str)
            
            # Member loads
            case_member = [ml for ml in model.member_loads if ml.load_case == lc.name]
            if case_member:
                lines.append("MEMBER LOAD")
                for ml in case_member:
                    if ml.load_type == 'UDL':
                        lines.append(f"{ml.member_id} UNI {ml.direction} {ml.values[0] if ml.values else -10}")
                    elif ml.load_type == 'POINT':
                        lines.append(f"{ml.member_id} CON {ml.direction} {ml.values[0] if ml.values else -10}")
            
            lines.append("")
        
        # Analysis and finish
        lines.append("PERFORM ANALYSIS PRINT STATICS CHECK")
        lines.append("FINISH")
        
        return '\n'.join(lines)


# ============================================
# JSON MODEL EXCHANGE
# ============================================

class JSONModelIO:
    """JSON-based model import/export"""
    
    @staticmethod
    def export_model(model: StructuralModel) -> str:
        """Export model to JSON"""
        return json.dumps({
            'title': model.title,
            'units': model.units,
            'nodes': [asdict(n) for n in model.nodes],
            'members': [asdict(m) for m in model.members],
            'load_cases': [asdict(lc) for lc in model.load_cases],
            'nodal_loads': [asdict(nl) for nl in model.nodal_loads],
            'member_loads': [asdict(ml) for ml in model.member_loads]
        }, indent=2)
    
    @staticmethod
    def import_model(json_str: str) -> StructuralModel:
        """Import model from JSON"""
        data = json.loads(json_str)
        
        return StructuralModel(
            title=data.get('title', 'Imported'),
            units=data.get('units', 'SI'),
            nodes=[Node(**n) for n in data.get('nodes', [])],
            members=[Member(**m) for m in data.get('members', [])],
            load_cases=[LoadCase(**lc) for lc in data.get('load_cases', [])],
            nodal_loads=[NodalLoad(**nl) for nl in data.get('nodal_loads', [])],
            member_loads=[MemberLoad(**ml) for ml in data.get('member_loads', [])]
        )


# ============================================
# EXCEL/CSV EXPORT
# ============================================

class ExcelExporter:
    """Export results to Excel-compatible format"""
    
    @staticmethod
    def export_nodes(nodes: List[Node]) -> str:
        """Export nodes to CSV"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['Node ID', 'X', 'Y', 'Z', 'Support'])
        for node in nodes:
            writer.writerow([node.id, node.x, node.y, node.z, node.support or ''])
        
        return output.getvalue()
    
    @staticmethod
    def export_members(members: List[Member]) -> str:
        """Export members to CSV"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['Member ID', 'Start Node', 'End Node', 'Section', 'Material'])
        for member in members:
            writer.writerow([member.id, member.start_node, member.end_node, 
                           member.section, member.material])
        
        return output.getvalue()
    
    @staticmethod
    def export_results(results: List[Dict]) -> str:
        """Export analysis results to CSV"""
        if not results:
            return ""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=results[0].keys())
        
        writer.writeheader()
        writer.writerows(results)
        
        return output.getvalue()


# ============================================
# DXF GEOMETRY IMPORT
# ============================================

class DXFImporter:
    """
    Import geometry from DXF files (simplified)
    """
    
    def __init__(self):
        self.nodes = []
        self.members = []
        self.node_id_counter = 1
        self.member_id_counter = 1
        self.node_tolerance = 0.001
    
    def parse(self, content: str) -> Tuple[List[Node], List[Member]]:
        """Parse DXF content and extract LINE entities"""
        lines = content.split('\n')
        
        entities = []
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            if line == 'LINE':
                # Parse LINE entity
                x1, y1, z1 = 0, 0, 0
                x2, y2, z2 = 0, 0, 0
                
                i += 1
                while i < len(lines) and lines[i].strip() != '0':
                    code = lines[i].strip()
                    i += 1
                    if i >= len(lines):
                        break
                    value = lines[i].strip()
                    
                    try:
                        if code == '10':
                            x1 = float(value)
                        elif code == '20':
                            y1 = float(value)
                        elif code == '30':
                            z1 = float(value)
                        elif code == '11':
                            x2 = float(value)
                        elif code == '21':
                            y2 = float(value)
                        elif code == '31':
                            z2 = float(value)
                    except ValueError:
                        pass
                    
                    i += 1
                
                entities.append(((x1, y1, z1), (x2, y2, z2)))
                continue
            
            i += 1
        
        # Convert to nodes and members
        for start, end in entities:
            start_node = self._get_or_create_node(*start)
            end_node = self._get_or_create_node(*end)
            
            self.members.append(Member(
                id=self.member_id_counter,
                start_node=start_node,
                end_node=end_node,
                section='DEFAULT'
            ))
            self.member_id_counter += 1
        
        return self.nodes, self.members
    
    def _get_or_create_node(self, x: float, y: float, z: float) -> int:
        """Find existing node or create new one"""
        for node in self.nodes:
            if (abs(node.x - x) < self.node_tolerance and
                abs(node.y - y) < self.node_tolerance and
                abs(node.z - z) < self.node_tolerance):
                return node.id
        
        node = Node(id=self.node_id_counter, x=x, y=y, z=z)
        self.nodes.append(node)
        self.node_id_counter += 1
        return node.id


# ============================================
# OPENBEAM API WRAPPER
# ============================================

class OpenBeamAPI:
    """
    Wrapper for OpenBeam REST API integration
    """
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
    
    def model_to_openbeam(self, model: StructuralModel) -> Dict:
        """Convert StructuralModel to OpenBeam format"""
        openbeam_model = {
            "nodes": {},
            "elements": {},
            "constraints": [],
            "loads": []
        }
        
        # Convert nodes
        for node in model.nodes:
            openbeam_model["nodes"][str(node.id)] = {
                "coordinates": [node.x, node.y, node.z]
            }
            
            # Add constraints for supported nodes
            if node.support:
                constraint = {"node": str(node.id)}
                if node.support == 'FIXED':
                    constraint["dofs"] = [True, True, True, True, True, True]
                elif node.support == 'PINNED':
                    constraint["dofs"] = [True, True, True, False, False, False]
                openbeam_model["constraints"].append(constraint)
        
        # Convert elements
        for member in model.members:
            openbeam_model["elements"][str(member.id)] = {
                "nodes": [str(member.start_node), str(member.end_node)],
                "section": member.section,
                "material": member.material
            }
        
        # Convert loads
        for nl in model.nodal_loads:
            openbeam_model["loads"].append({
                "type": "nodal",
                "node": str(nl.node_id),
                "case": nl.load_case,
                "values": [nl.Fx, nl.Fy, nl.Fz, nl.Mx, nl.My, nl.Mz]
            })
        
        for ml in model.member_loads:
            openbeam_model["loads"].append({
                "type": "member",
                "element": str(ml.member_id),
                "case": ml.load_case,
                "load_type": ml.load_type,
                "direction": ml.direction,
                "values": ml.values
            })
        
        return openbeam_model
    
    def openbeam_to_model(self, openbeam_data: Dict) -> StructuralModel:
        """Convert OpenBeam format to StructuralModel"""
        nodes = []
        members = []
        nodal_loads = []
        member_loads = []
        
        # Convert nodes
        for node_id, node_data in openbeam_data.get("nodes", {}).items():
            coords = node_data.get("coordinates", [0, 0, 0])
            nodes.append(Node(
                id=int(node_id),
                x=coords[0],
                y=coords[1] if len(coords) > 1 else 0,
                z=coords[2] if len(coords) > 2 else 0
            ))
        
        # Convert elements
        for elem_id, elem_data in openbeam_data.get("elements", {}).items():
            node_ids = elem_data.get("nodes", [])
            members.append(Member(
                id=int(elem_id),
                start_node=int(node_ids[0]) if node_ids else 0,
                end_node=int(node_ids[1]) if len(node_ids) > 1 else 0,
                section=elem_data.get("section", "DEFAULT"),
                material=elem_data.get("material", "Steel")
            ))
        
        # Apply constraints
        for constraint in openbeam_data.get("constraints", []):
            node_id = int(constraint.get("node", 0))
            for node in nodes:
                if node.id == node_id:
                    dofs = constraint.get("dofs", [])
                    if all(dofs):
                        node.support = "FIXED"
                    elif dofs[:3] == [True, True, True]:
                        node.support = "PINNED"
        
        return StructuralModel(
            title="OpenBeam Import",
            nodes=nodes,
            members=members,
            load_cases=[LoadCase(name="LC1", type="DEAD")],
            nodal_loads=nodal_loads,
            member_loads=member_loads
        )


# ============================================
# REPORT DATA GENERATOR
# ============================================

class ReportDataGenerator:
    """Generate structured data for reports"""
    
    @staticmethod
    def generate_geometry_summary(model: StructuralModel) -> Dict:
        """Generate geometry summary for reports"""
        return {
            "title": model.title,
            "units": model.units,
            "node_count": len(model.nodes),
            "member_count": len(model.members),
            "load_case_count": len(model.load_cases),
            "x_range": (min(n.x for n in model.nodes), max(n.x for n in model.nodes)),
            "y_range": (min(n.y for n in model.nodes), max(n.y for n in model.nodes)),
            "z_range": (min(n.z for n in model.nodes), max(n.z for n in model.nodes)),
            "support_count": len([n for n in model.nodes if n.support]),
            "sections_used": list(set(m.section for m in model.members))
        }
    
    @staticmethod
    def generate_load_summary(model: StructuralModel) -> Dict:
        """Generate load summary for reports"""
        summary = {}
        
        for lc in model.load_cases:
            nodal = [nl for nl in model.nodal_loads if nl.load_case == lc.name]
            member = [ml for ml in model.member_loads if ml.load_case == lc.name]
            
            summary[lc.name] = {
                "type": lc.type,
                "factor": lc.factor,
                "nodal_load_count": len(nodal),
                "member_load_count": len(member),
                "total_vertical": sum(nl.Fy for nl in nodal)
            }
        
        return summary
