"""
Standard Section Database
Ported from frontend sections.json
"""

STANDARD_SECTIONS = {
    "indian": {
        "name": "Indian (IS 800:2007)",
        "sections": {
            "ISMB 100": {"type": "I-BEAM", "depth": 100, "width": 50, "web_t": 4.4, "flange_t": 5.7, "area": 1070, "Iy": 368000, "Iz": 46000, "weight": 8.4},
            "ISMB 150": {"type": "I-BEAM", "depth": 150, "width": 75, "web_t": 4.9, "flange_t": 6.4, "area": 1950, "Iy": 1467000, "Iz": 124000, "weight": 15.3},
            "ISMB 200": {"type": "I-BEAM", "depth": 200, "width": 100, "web_t": 5.4, "flange_t": 7.2, "area": 3180, "Iy": 4447000, "Iz": 315000, "weight": 25.0},
            "ISMB 250": {"type": "I-BEAM", "depth": 250, "width": 125, "web_t": 6.0, "flange_t": 8.0, "area": 4990, "Iy": 10560000, "Iz": 695000, "weight": 39.2},
            "ISMB 300": {"type": "I-BEAM", "depth": 300, "width": 140, "web_t": 6.5, "flange_t": 8.9, "area": 7180, "Iy": 22110000, "Iz": 1289000, "weight": 56.4},
            "ISMB 350": {"type": "I-BEAM", "depth": 350, "width": 140, "web_t": 7.2, "flange_t": 9.6, "area": 8640, "Iy": 36800000, "Iz": 1348000, "weight": 67.9},
            "ISMB 400": {"type": "I-BEAM", "depth": 400, "width": 140, "web_t": 8.0, "flange_t": 10.5, "area": 10240, "Iy": 57280000, "Iz": 1430000, "weight": 80.4},
            "ISMB 450": {"type": "I-BEAM", "depth": 450, "width": 150, "web_t": 8.6, "flange_t": 11.4, "area": 12110, "Iy": 83600000, "Iz": 1846000, "weight": 95.1},
            "ISMB 500": {"type": "I-BEAM", "depth": 500, "width": 150, "web_t": 9.4, "flange_t": 12.4, "area": 14340, "Iy": 121000000, "Iz": 2002000, "weight": 112.6},
            "ISMB 600": {"type": "I-BEAM", "depth": 600, "width": 160, "web_t": 10.5, "flange_t": 14.2, "area": 19500, "Iy": 245200000, "Iz": 2755000, "weight": 153.0},
            "ISMC 75": {"type": "C-CHANNEL", "depth": 75, "width": 40, "web_t": 4.4, "flange_t": 5.9, "area": 852, "Iy": 204000, "Iz": 20000, "weight": 6.7},
            "ISMC 100": {"type": "C-CHANNEL", "depth": 100, "width": 50, "web_t": 4.9, "flange_t": 6.4, "area": 1330, "Iy": 604000, "Iz": 52000, "weight": 10.4},
            "ISMC 125": {"type": "C-CHANNEL", "depth": 125, "width": 65, "web_t": 5.4, "flange_t": 7.2, "area": 2070, "Iy": 1518000, "Iz": 145000, "weight": 16.3},
            "ISMC 150": {"type": "C-CHANNEL", "depth": 150, "width": 75, "web_t": 5.9, "flange_t": 7.9, "area": 2800, "Iy": 3008000, "Iz": 261000, "weight": 22.0},
            "ISMC 200": {"type": "C-CHANNEL", "depth": 200, "width": 75, "web_t": 6.4, "flange_t": 8.4, "area": 3800, "Iy": 7600000, "Iz": 282000, "weight": 29.8},
            "ISMC 250": {"type": "C-CHANNEL", "depth": 250, "width": 80, "web_t": 7.4, "flange_t": 9.4, "area": 5370, "Iy": 16150000, "Iz": 402000, "weight": 42.1}
        }
    },
    "european": {
        "name": "European (HE/IPE)",
        "sections": {
            "IPE 200": {"type": "I-BEAM", "depth": 200, "width": 100, "web_t": 5.6, "flange_t": 8.5, "area": 2850, "Iy": 19430000, "Iz": 1420000, "weight": 22.4},
            "IPE 300": {"type": "I-BEAM", "depth": 300, "width": 150, "web_t": 7.1, "flange_t": 10.7, "area": 5380, "Iy": 83560000, "Iz": 6040000, "weight": 42.2},
            "HEB 200": {"type": "I-BEAM", "depth": 200, "width": 200, "web_t": 9, "flange_t": 15, "area": 7810, "Iy": 56960000, "Iz": 20000000, "weight": 61.3}
        }
    },
    "us": {
        "name": "US (W-Shapes)",
        "sections": {
            "W8x31": {"type": "I-BEAM", "depth": 203, "width": 203, "web_t": 7.2, "flange_t": 11, "area": 5870, "Iy": 47300000, "Iz": 15700000, "weight": 46.1},
            "W12x26": {"type": "I-BEAM", "depth": 310, "width": 165, "web_t": 5.8, "flange_t": 9.7, "area": 4940, "Iy": 85600000, "Iz": 8600000, "weight": 38.7},
            "W14x30": {"type": "I-BEAM", "depth": 352, "width": 171, "web_t": 6.9, "flange_t": 9.8, "area": 5685, "Iy": 127800000, "Iz": 10400000, "weight": 44.6}
        }
    }
}

def get_db_section(name: str):
    for db in STANDARD_SECTIONS.values():
        if name in db["sections"]:
            return db["sections"][name]
    return None

def get_all_sections_by_type(shape_type: str):
    # Flatten all databases
    results = []
    for db in STANDARD_SECTIONS.values():
        for name, data in db["sections"].items():
            if data["type"] == shape_type:
                # Add name to data for convenience
                item = data.copy()
                item["name"] = name
                results.append(item)
    return results
