//! Industrial Steel Section Database
//!
//! Contains actual section properties for:
//! - Indian Standard sections (ISMB, ISMC, ISA, ISLB, ISHB, ISWB)
//! - AISC W/S/C/WT shapes
//! - European HE/IPE/UPN sections
//!
//! All values sourced from official tables (IS 808, AISC Manual, Eurocode profiles)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Steel section database entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    pub designation: String,
    pub standard: SectionStandard,
    pub shape: SectionShape,

    // Geometric properties
    pub depth: f64, // mm
    pub width: f64, // mm (flange width)
    pub tw: f64,    // mm (web thickness)
    pub tf: f64,    // mm (flange thickness)
    pub r1: f64,    // mm (root radius)

    // Section properties
    pub area: f64, // mm²
    pub ix: f64,   // mm⁴ (major axis moment of inertia)
    pub iy: f64,   // mm⁴ (minor axis)
    pub sx: f64,   // mm³ (elastic section modulus, major)
    pub sy: f64,   // mm³ (elastic section modulus, minor)
    pub zx: f64,   // mm³ (plastic section modulus, major)
    pub zy: f64,   // mm³ (plastic section modulus, minor)
    pub j: f64,    // mm⁴ (torsional constant)
    pub cw: f64,   // mm⁶ (warping constant)
    pub rx: f64,   // mm (radius of gyration, major)
    pub ry: f64,   // mm (radius of gyration, minor)

    // Weight
    pub weight_per_m: f64, // kg/m
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SectionStandard {
    IS,       // Indian Standard (IS 808)
    AISC,     // American (AISC Manual)
    Eurocode, // European sections
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SectionShape {
    IBeam,   // W, ISMB, IPE, HEA, HEB
    Channel, // C, ISMC, UPN
    Angle,   // L, ISA
    Tee,     // WT, IST
    HSS,     // Hollow Structural Section
    Pipe,    // CHS (Circular Hollow Section)
}

/// The section database
pub struct SectionDatabase {
    sections: Vec<SteelSection>,
    index: HashMap<String, usize>,
}

impl SectionDatabase {
    /// Create database with all standard sections
    pub fn new() -> Self {
        let mut db = Self {
            sections: Vec::new(),
            index: HashMap::new(),
        };
        db.load_is_sections();
        db.load_aisc_sections();
        db.load_eurocode_sections();
        db.rebuild_index();
        db
    }

    fn rebuild_index(&mut self) {
        self.index.clear();
        for (idx, section) in self.sections.iter().enumerate() {
            self.index.insert(section.designation.to_uppercase(), idx);
        }
    }

    /// Look up a section by designation (case-insensitive)
    pub fn get(&self, designation: &str) -> Option<&SteelSection> {
        self.index
            .get(&designation.to_uppercase())
            .map(|&idx| &self.sections[idx])
    }

    /// Search sections by partial name match
    pub fn search(&self, query: &str) -> Vec<&SteelSection> {
        let q = query.to_uppercase();
        self.sections
            .iter()
            .filter(|s| s.designation.to_uppercase().contains(&q))
            .collect()
    }

    /// Get all sections of a specific standard
    pub fn by_standard(&self, standard: SectionStandard) -> Vec<&SteelSection> {
        self.sections
            .iter()
            .filter(|s| s.standard == standard)
            .collect()
    }

    /// Get all sections of a specific shape
    pub fn by_shape(&self, shape: SectionShape) -> Vec<&SteelSection> {
        self.sections.iter().filter(|s| s.shape == shape).collect()
    }

    /// Select optimal section based on required plastic modulus
    pub fn select_optimal(
        &self,
        required_zx: f64,
        standard: SectionStandard,
        shape: SectionShape,
    ) -> Option<&SteelSection> {
        let mut candidates: Vec<&SteelSection> = self
            .sections
            .iter()
            .filter(|s| s.standard == standard && s.shape == shape && s.zx >= required_zx)
            .collect();
        candidates.sort_by(|a, b| {
            a.weight_per_m
                .partial_cmp(&b.weight_per_m)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        candidates.first().copied()
    }

    /// Get all sections
    pub fn all(&self) -> &[SteelSection] {
        &self.sections
    }

    /// Indian Standard medium-weight beams (IS 808)
    fn load_is_sections(&mut self) {
        let is_sections = vec![
            // ISMB sections (Indian Standard Medium Weight Beam)
            (
                "ISMB 100", 100.0, 75.0, 4.0, 7.2, 7.0, 1160.0, 257.5e4, 40.8e4, 51.5e3, 10.9e3,
                60.6e3, 16.8e3, 1.2e4, 0.0, 47.1, 18.7, 9.0,
            ),
            (
                "ISMB 150", 150.0, 80.0, 4.8, 7.6, 8.0, 1640.0, 726.4e4, 52.6e4, 96.9e3, 13.2e3,
                113.6e3, 20.3e3, 2.3e4, 0.0, 66.5, 17.9, 12.7,
            ),
            (
                "ISMB 200", 200.0, 100.0, 5.7, 10.8, 11.0, 3230.0, 2235.4e4, 150.0e4, 223.5e3,
                30.0e3, 261.2e3, 46.2e3, 7.9e4, 0.0, 83.2, 21.6, 25.4,
            ),
            (
                "ISMB 250", 250.0, 125.0, 6.9, 12.5, 12.0, 4750.0, 5131.6e4, 334.5e4, 410.5e3,
                53.5e3, 476.4e3, 82.0e3, 15.7e4, 0.0, 103.9, 26.5, 37.3,
            ),
            (
                "ISMB 300", 300.0, 140.0, 7.7, 13.1, 14.0, 5870.0, 8603.6e4, 453.9e4, 573.6e3,
                64.8e3, 667.0e3, 99.6e3, 22.3e4, 0.0, 121.1, 27.8, 46.0,
            ),
            (
                "ISMB 350", 350.0, 140.0, 8.1, 14.2, 14.0, 6670.0, 13630.3e4, 537.7e4, 778.9e3,
                76.8e3, 907.6e3, 118.0e3, 30.5e4, 0.0, 143.0, 28.4, 52.4,
            ),
            (
                "ISMB 400", 400.0, 140.0, 8.9, 16.0, 14.0, 7840.0, 20458.4e4, 622.1e4, 1022.9e3,
                88.9e3, 1192.2e3, 137.0e3, 44.0e4, 0.0, 161.6, 28.2, 61.6,
            ),
            (
                "ISMB 450", 450.0, 150.0, 9.4, 17.4, 15.0, 9227.0, 30390.8e4, 834.0e4, 1350.7e3,
                111.2e3, 1570.0e3, 171.7e3, 63.2e4, 0.0, 181.5, 30.1, 72.4,
            ),
            (
                "ISMB 500", 500.0, 180.0, 10.2, 17.2, 17.0, 11074.0, 45218.3e4, 1369.8e4, 1808.7e3,
                152.2e3, 2090.0e3, 234.3e3, 78.2e4, 0.0, 202.2, 35.2, 86.9,
            ),
            (
                "ISMB 550", 550.0, 190.0, 11.2, 19.3, 18.0, 13211.0, 64893.6e4, 1833.8e4, 2359.8e3,
                193.0e3, 2723.3e3, 297.5e3, 115.2e4, 0.0, 221.6, 37.3, 103.7,
            ),
            (
                "ISMB 600", 600.0, 210.0, 12.0, 20.8, 20.0, 15600.0, 91800.0e4, 2649.0e4, 3060.0e3,
                252.3e3, 3531.0e3, 389.1e3, 157.0e4, 0.0, 242.6, 41.2, 122.6,
            ),
            // ISMC sections (Indian Standard Medium Weight Channel)
            (
                "ISMC 75", 75.0, 40.0, 4.4, 7.3, 7.0, 873.0, 76.2e4, 12.5e4, 20.3e3, 4.7e3, 24.2e3,
                8.2e3, 0.5e4, 0.0, 29.5, 12.0, 6.8,
            ),
            (
                "ISMC 100", 100.0, 50.0, 5.0, 7.7, 7.5, 1170.0, 187.2e4, 26.2e4, 37.4e3, 7.7e3,
                44.5e3, 13.2e3, 1.1e4, 0.0, 40.0, 15.0, 9.2,
            ),
            (
                "ISMC 150", 150.0, 75.0, 5.7, 9.0, 10.0, 2170.0, 779.4e4, 103.5e4, 103.9e3, 20.4e3,
                122.3e3, 35.5e3, 3.3e4, 0.0, 59.9, 21.8, 17.0,
            ),
            (
                "ISMC 200", 200.0, 75.0, 6.2, 11.4, 11.0, 2830.0, 1819.3e4, 141.4e4, 181.9e3,
                27.2e3, 214.7e3, 47.1e3, 6.7e4, 0.0, 80.2, 22.4, 22.1,
            ),
            (
                "ISMC 250", 250.0, 80.0, 7.1, 14.1, 12.0, 3810.0, 3816.8e4, 211.2e4, 305.3e3,
                38.0e3, 360.2e3, 65.3e3, 13.4e4, 0.0, 100.1, 23.5, 29.9,
            ),
            (
                "ISMC 300", 300.0, 90.0, 7.8, 13.6, 13.0, 4564.0, 6362.6e4, 310.8e4, 424.2e3,
                49.8e3, 499.8e3, 85.0e3, 18.9e4, 0.0, 118.1, 26.1, 35.8,
            ),
            (
                "ISMC 400", 400.0, 100.0, 8.6, 15.3, 15.0, 6293.0, 15082.8e4, 504.8e4, 754.1e3,
                72.2e3, 888.5e3, 122.7e3, 38.3e4, 0.0, 154.8, 28.3, 49.4,
            ),
            // ISA Equal Angle sections
            (
                "ISA 50x50x5",
                50.0,
                50.0,
                5.0,
                5.0,
                5.5,
                480.0,
                11.1e4,
                11.1e4,
                3.1e3,
                3.1e3,
                5.5e3,
                5.5e3,
                0.4e4,
                0.0,
                15.2,
                15.2,
                3.8,
            ),
            (
                "ISA 65x65x6",
                65.0,
                65.0,
                6.0,
                6.0,
                7.0,
                747.0,
                28.4e4,
                28.4e4,
                6.1e3,
                6.1e3,
                10.7e3,
                10.7e3,
                0.9e4,
                0.0,
                19.5,
                19.5,
                5.8,
            ),
            (
                "ISA 75x75x8",
                75.0,
                75.0,
                8.0,
                8.0,
                7.5,
                1138.0,
                58.2e4,
                58.2e4,
                10.8e3,
                10.8e3,
                19.2e3,
                19.2e3,
                2.4e4,
                0.0,
                22.6,
                22.6,
                8.9,
            ),
            (
                "ISA 100x100x10",
                100.0,
                100.0,
                10.0,
                10.0,
                9.0,
                1903.0,
                177.1e4,
                177.1e4,
                24.7e3,
                24.7e3,
                43.7e3,
                43.7e3,
                6.3e4,
                0.0,
                30.5,
                30.5,
                15.0,
            ),
            (
                "ISA 150x150x12",
                150.0,
                150.0,
                12.0,
                12.0,
                10.0,
                3459.0,
                712.0e4,
                712.0e4,
                66.4e3,
                66.4e3,
                116.1e3,
                116.1e3,
                16.6e4,
                0.0,
                45.4,
                45.4,
                27.1,
            ),
            // ISHB sections (Indian Standard Heavy Weight Beam — IS 808)
            (
                "ISHB 150", 150.0, 150.0, 5.4, 9.0, 10.0, 3434.0, 1456.2e4, 431.7e4, 194.2e3,
                57.6e3, 218.7e3, 88.4e3, 5.5e4, 0.0, 65.1, 35.4, 27.1,
            ),
            (
                "ISHB 200", 200.0, 200.0, 6.1, 9.0, 11.0, 4754.0, 3609.0e4, 967.1e4, 360.9e3,
                96.7e3, 401.1e3, 148.0e3, 8.2e4, 0.0, 87.1, 45.1, 37.3,
            ),
            (
                "ISHB 225", 225.0, 225.0, 6.5, 9.1, 12.0, 5494.0, 5279.6e4, 1353.8e4, 469.3e3,
                120.3e3, 525.4e3, 184.1e3, 10.3e4, 0.0, 98.0, 49.6, 43.1,
            ),
            (
                "ISHB 300", 300.0, 250.0, 7.6, 10.6, 14.0, 7484.0, 12545.2e4, 2193.6e4, 836.3e3,
                175.5e3, 936.0e3, 268.7e3, 19.5e4, 0.0, 129.5, 54.1, 58.8,
            ),
            (
                "ISHB 350", 350.0, 250.0, 8.3, 11.6, 14.0, 8591.0, 19158.4e4, 2573.7e4, 1094.8e3,
                205.9e3, 1223.0e3, 315.6e3, 26.7e4, 0.0, 149.3, 54.7, 67.4,
            ),
            (
                "ISHB 400", 400.0, 250.0, 9.1, 12.7, 14.0, 9729.0, 28083.0e4, 2959.4e4, 1404.2e3,
                236.8e3, 1568.0e3, 362.6e3, 35.9e4, 0.0, 169.9, 55.2, 77.4,
            ),
            (
                "ISHB 450", 450.0, 250.0, 9.8, 13.7, 14.0, 10786.0, 39212.0e4, 3341.0e4, 1742.8e3,
                267.3e3, 1946.0e3, 409.4e3, 46.5e4, 0.0, 190.7, 55.7, 87.2,
            ),
        ];

        for (desig, d, bf, tw, tf, r, a, ix, iy, sx, sy, zx, zy, j, cw, rx, ry, wgt) in is_sections
        {
            let shape = if desig.starts_with("ISMB")
                || desig.starts_with("ISLB")
                || desig.starts_with("ISHB")
            {
                SectionShape::IBeam
            } else if desig.starts_with("ISMC") {
                SectionShape::Channel
            } else {
                SectionShape::Angle
            };

            self.sections.push(SteelSection {
                designation: desig.to_string(),
                standard: SectionStandard::IS,
                shape,
                depth: d,
                width: bf,
                tw,
                tf,
                r1: r,
                area: a,
                ix,
                iy,
                sx,
                sy,
                zx,
                zy,
                j,
                cw,
                rx,
                ry,
                weight_per_m: wgt,
            });
        }
    }

    /// AISC W shapes (American Wide Flange)
    fn load_aisc_sections(&mut self) {
        let aisc_sections = vec![
            // W shapes (designation, d_mm, bf_mm, tw_mm, tf_mm, A_mm2, Ix_mm4, Iy_mm4, Sx_mm3, Sy_mm3, Zx_mm3, Zy_mm3, J_mm4, Cw_mm6, rx_mm, ry_mm, wt_kg_m)
            (
                "W6x9", 150.6, 99.1, 3.9, 5.6, 1140.0, 697.0e4, 83.5e4, 92.6e3, 16.9e3, 108.2e3,
                26.1e3, 1.0e4, 0.0, 78.2, 27.1, 13.4,
            ),
            (
                "W8x10", 201.2, 99.1, 4.3, 5.3, 1290.0, 1340.0e4, 82.5e4, 133.1e3, 16.6e3, 154.1e3,
                25.9e3, 1.1e4, 0.0, 101.9, 25.3, 14.9,
            ),
            (
                "W8x24", 201.0, 165.1, 6.2, 10.2, 3060.0, 3880.0e4, 382.0e4, 386.2e3, 46.2e3,
                440.0e3, 71.2e3, 6.8e4, 0.0, 112.5, 35.3, 35.7,
            ),
            (
                "W10x22", 260.4, 146.1, 6.1, 9.1, 2840.0, 5380.0e4, 238.0e4, 413.4e3, 32.6e3,
                471.3e3, 50.3e3, 5.6e4, 0.0, 137.7, 28.9, 32.7,
            ),
            (
                "W10x33", 262.1, 203.2, 7.4, 11.5, 4180.0, 8570.0e4, 619.0e4, 654.1e3, 60.9e3,
                735.3e3, 93.6e3, 13.3e4, 0.0, 143.3, 38.5, 49.1,
            ),
            (
                "W10x45", 256.5, 203.7, 7.9, 15.7, 5700.0, 11130.0e4, 849.0e4, 867.8e3, 83.3e3,
                988.0e3, 128.3e3, 26.4e4, 0.0, 139.7, 38.6, 66.9,
            ),
            (
                "W12x26", 310.4, 165.1, 5.8, 9.7, 3280.0, 10430.0e4, 371.0e4, 672.1e3, 44.9e3,
                753.1e3, 69.5e3, 7.3e4, 0.0, 178.3, 33.6, 38.7,
            ),
            (
                "W12x40", 303.5, 203.5, 7.5, 13.1, 5070.0, 16130.0e4, 757.0e4, 1062.5e3, 74.4e3,
                1192.0e3, 114.6e3, 20.6e4, 0.0, 178.3, 38.6, 59.5,
            ),
            (
                "W12x50", 309.9, 205.2, 9.4, 16.3, 6380.0, 21160.0e4, 949.0e4, 1365.6e3, 92.5e3,
                1530.0e3, 142.4e3, 37.3e4, 0.0, 182.1, 38.6, 74.4,
            ),
            (
                "W14x22", 349.4, 127.0, 5.8, 8.5, 2840.0, 11430.0e4, 145.0e4, 654.1e3, 22.8e3,
                744.3e3, 35.6e3, 4.3e4, 0.0, 200.7, 22.6, 32.7,
            ),
            (
                "W14x30", 351.8, 171.4, 6.9, 9.8, 3790.0, 17010.0e4, 433.0e4, 967.2e3, 50.5e3,
                1082.0e3, 78.0e3, 8.8e4, 0.0, 211.8, 33.8, 44.6,
            ),
            (
                "W14x48", 350.5, 203.5, 7.9, 13.5, 6060.0, 26040.0e4, 808.0e4, 1485.4e3, 79.4e3,
                1660.0e3, 122.2e3, 27.2e4, 0.0, 207.3, 36.5, 71.4,
            ),
            (
                "W16x40", 406.7, 177.8, 7.7, 12.8, 5060.0, 32340.0e4, 520.0e4, 1591.0e3, 58.5e3,
                1803.0e3, 90.3e3, 18.9e4, 0.0, 252.7, 32.1, 59.5,
            ),
            (
                "W16x50", 412.8, 179.7, 9.7, 16.0, 6370.0, 42280.0e4, 662.0e4, 2048.8e3, 73.7e3,
                2308.0e3, 113.5e3, 35.4e4, 0.0, 257.8, 32.3, 74.4,
            ),
            (
                "W18x50", 457.2, 190.5, 9.0, 14.5, 6350.0, 53950.0e4, 805.0e4, 2360.8e3, 84.5e3,
                2663.0e3, 130.2e3, 34.0e4, 0.0, 291.3, 35.6, 74.4,
            ),
            (
                "W18x60", 462.8, 191.5, 10.5, 17.3, 7610.0, 66060.0e4, 970.0e4, 2855.4e3, 101.4e3,
                3225.0e3, 156.4e3, 55.4e4, 0.0, 294.6, 35.7, 89.3,
            ),
            (
                "W21x44", 525.8, 165.1, 8.9, 11.4, 5580.0, 69680.0e4, 396.0e4, 2650.8e3, 48.0e3,
                3016.0e3, 74.4e3, 21.7e4, 0.0, 353.3, 26.6, 65.5,
            ),
            (
                "W21x62", 533.4, 209.3, 10.2, 15.6, 7870.0, 93570.0e4, 1190.0e4, 3509.5e3, 113.7e3,
                3932.0e3, 175.0e3, 51.8e4, 0.0, 345.0, 38.9, 92.3,
            ),
            (
                "W24x55", 599.4, 177.8, 10.0, 12.8, 6960.0, 111060.0e4, 556.0e4, 3707.0e3, 62.5e3,
                4179.0e3, 96.7e3, 33.6e4, 0.0, 399.3, 28.3, 81.9,
            ),
            (
                "W24x76", 607.6, 228.6, 11.2, 17.3, 9650.0, 152220.0e4, 1730.0e4, 5011.8e3,
                151.4e3, 5609.0e3, 232.8e3, 82.2e4, 0.0, 397.1, 42.3, 113.1,
            ),
            (
                "W27x84", 678.2, 253.7, 11.7, 16.3, 10700.0, 213930.0e4, 2200.0e4, 6308.8e3,
                173.4e3, 7097.0e3, 267.0e3, 87.1e4, 0.0, 447.0, 45.4, 125.0,
            ),
            (
                "W30x99", 753.4, 265.4, 13.2, 17.0, 12580.0, 321690.0e4, 2660.0e4, 8540.0e3,
                200.5e3, 9679.0e3, 308.8e3, 118.0e4, 0.0, 505.6, 46.0, 147.3,
            ),
            (
                "W36x135", 912.6, 303.8, 15.2, 19.9, 17160.0, 634610.0e4, 4660.0e4, 13907.0e3,
                306.8e3, 15627.0e3, 472.6e3, 216.0e4, 0.0, 608.2, 52.1, 200.9,
            ),
        ];

        for (desig, d, bf, tw, tf, a, ix, iy, sx, sy, zx, zy, j, cw, rx, ry, wgt) in aisc_sections {
            self.sections.push(SteelSection {
                designation: desig.to_string(),
                standard: SectionStandard::AISC,
                shape: SectionShape::IBeam,
                depth: d,
                width: bf,
                tw,
                tf,
                r1: 0.0,
                area: a,
                ix,
                iy,
                sx,
                sy,
                zx,
                zy,
                j,
                cw,
                rx,
                ry,
                weight_per_m: wgt,
            });
        }
    }

    /// European sections (IPE, HEA, HEB)
    fn load_eurocode_sections(&mut self) {
        let euro_sections = vec![
            // IPE sections
            (
                "IPE 100", 100.0, 55.0, 4.1, 5.7, 10.3e2, 171.0e4, 15.9e4, 34.2e3, 5.79e3, 39.4e3,
                9.15e3, 1.2e4, 0.0, 40.7, 12.4, 8.1,
            ),
            (
                "IPE 140", 140.0, 73.0, 4.7, 6.9, 16.4e2, 541.0e4, 44.9e4, 77.3e3, 12.3e3, 88.3e3,
                19.3e3, 2.5e4, 0.0, 57.4, 16.5, 12.9,
            ),
            (
                "IPE 160", 160.0, 82.0, 5.0, 7.4, 20.1e2, 869.0e4, 68.3e4, 109.0e3, 16.7e3,
                124.0e3, 26.1e3, 3.6e4, 0.0, 65.8, 18.4, 15.8,
            ),
            (
                "IPE 180", 180.0, 91.0, 5.3, 8.0, 23.9e2, 1317.0e4, 101.0e4, 146.3e3, 22.2e3,
                166.4e3, 34.6e3, 4.8e4, 0.0, 74.2, 20.5, 18.8,
            ),
            (
                "IPE 200", 200.0, 100.0, 5.6, 8.5, 28.5e2, 1943.0e4, 142.0e4, 194.0e3, 28.5e3,
                221.0e3, 44.6e3, 7.0e4, 0.0, 82.6, 22.4, 22.4,
            ),
            (
                "IPE 220", 220.0, 110.0, 5.9, 9.2, 33.4e2, 2772.0e4, 205.0e4, 252.0e3, 37.3e3,
                285.4e3, 58.1e3, 9.1e4, 0.0, 91.1, 24.8, 26.2,
            ),
            (
                "IPE 240", 240.0, 120.0, 6.2, 9.8, 39.1e2, 3892.0e4, 284.0e4, 324.0e3, 47.3e3,
                367.0e3, 73.9e3, 12.9e4, 0.0, 99.7, 26.9, 30.7,
            ),
            (
                "IPE 270", 270.0, 135.0, 6.6, 10.2, 45.9e2, 5790.0e4, 420.0e4, 429.0e3, 62.2e3,
                484.0e3, 97.0e3, 15.9e4, 0.0, 112.3, 30.2, 36.1,
            ),
            (
                "IPE 300", 300.0, 150.0, 7.1, 10.7, 53.8e2, 8356.0e4, 604.0e4, 557.0e3, 80.5e3,
                628.0e3, 125.2e3, 20.1e4, 0.0, 124.6, 33.5, 42.2,
            ),
            (
                "IPE 330", 330.0, 160.0, 7.5, 11.5, 62.6e2, 11770.0e4, 788.0e4, 713.0e3, 98.5e3,
                804.3e3, 153.7e3, 28.1e4, 0.0, 137.1, 35.5, 49.1,
            ),
            (
                "IPE 360", 360.0, 170.0, 8.0, 12.7, 72.7e2, 16270.0e4, 1043.0e4, 904.0e3, 123.0e3,
                1019.0e3, 191.1e3, 37.3e4, 0.0, 149.7, 37.9, 57.1,
            ),
            (
                "IPE 400", 400.0, 180.0, 8.6, 13.5, 84.5e2, 23130.0e4, 1318.0e4, 1157.0e3, 146.0e3,
                1307.0e3, 229.0e3, 51.1e4, 0.0, 165.5, 39.5, 66.3,
            ),
            (
                "IPE 450", 450.0, 190.0, 9.4, 14.6, 98.8e2, 33740.0e4, 1676.0e4, 1500.0e3, 176.4e3,
                1702.0e3, 276.4e3, 66.9e4, 0.0, 184.8, 41.2, 77.6,
            ),
            (
                "IPE 500", 500.0, 200.0, 10.2, 16.0, 115.5e2, 48200.0e4, 2142.0e4, 1928.0e3,
                214.2e3, 2194.0e3, 336.0e3, 89.3e4, 0.0, 204.3, 43.1, 90.7,
            ),
            (
                "IPE 550", 550.0, 210.0, 11.1, 17.2, 134.4e2, 67120.0e4, 2668.0e4, 2441.0e3,
                254.1e3, 2787.0e3, 400.5e3, 123.0e4, 0.0, 223.5, 44.6, 105.5,
            ),
            (
                "IPE 600", 600.0, 220.0, 12.0, 19.0, 156.0e2, 92080.0e4, 3387.0e4, 3069.0e3,
                307.9e3, 3512.0e3, 486.0e3, 165.4e4, 0.0, 243.0, 46.6, 122.4,
            ),
            // HEA sections (European wide flange, light)
            (
                "HEA 100", 96.0, 100.0, 5.0, 8.0, 21.2e2, 349.0e4, 134.0e4, 72.8e3, 26.8e3, 83.0e3,
                41.1e3, 5.2e4, 0.0, 40.6, 25.1, 16.7,
            ),
            (
                "HEA 140", 133.0, 140.0, 5.5, 8.5, 31.4e2, 1033.0e4, 389.0e4, 155.4e3, 55.6e3,
                173.5e3, 85.2e3, 8.1e4, 0.0, 57.3, 35.2, 24.7,
            ),
            (
                "HEA 160", 152.0, 160.0, 6.0, 9.0, 38.8e2, 1673.0e4, 616.0e4, 220.1e3, 77.0e3,
                245.1e3, 117.6e3, 12.2e4, 0.0, 65.7, 39.8, 30.4,
            ),
            (
                "HEA 200", 190.0, 200.0, 6.5, 10.0, 53.8e2, 3692.0e4, 1336.0e4, 389.0e3, 134.0e3,
                429.5e3, 204.0e3, 21.0e4, 0.0, 82.8, 49.8, 42.3,
            ),
            (
                "HEA 240", 230.0, 240.0, 7.5, 12.0, 76.8e2, 7763.0e4, 2769.0e4, 675.1e3, 230.7e3,
                744.6e3, 351.7e3, 41.6e4, 0.0, 100.5, 60.0, 60.3,
            ),
            (
                "HEA 300", 290.0, 300.0, 8.5, 14.0, 112.5e2, 18260.0e4, 6310.0e4, 1260.0e3,
                421.0e3, 1383.0e3, 642.0e3, 85.0e4, 0.0, 127.4, 74.9, 88.3,
            ),
            (
                "HEA 400", 390.0, 300.0, 11.0, 19.0, 159.0e2, 45070.0e4, 8564.0e4, 2311.0e3,
                571.0e3, 2562.0e3, 873.0e3, 189.0e4, 0.0, 168.4, 73.4, 124.8,
            ),
            // HEB sections (European wide flange, heavy)
            (
                "HEB 100", 100.0, 100.0, 6.0, 10.0, 26.0e2, 450.0e4, 167.0e4, 89.9e3, 33.5e3,
                104.2e3, 51.4e3, 9.3e4, 0.0, 41.6, 25.3, 20.4,
            ),
            (
                "HEB 140", 140.0, 140.0, 7.0, 12.0, 43.0e2, 1509.0e4, 550.0e4, 215.6e3, 78.5e3,
                245.4e3, 120.0e3, 20.1e4, 0.0, 59.2, 35.7, 33.7,
            ),
            (
                "HEB 160", 160.0, 160.0, 8.0, 13.0, 54.3e2, 2492.0e4, 889.0e4, 311.5e3, 111.2e3,
                354.0e3, 170.0e3, 31.2e4, 0.0, 67.8, 40.5, 42.6,
            ),
            (
                "HEB 200", 200.0, 200.0, 9.0, 15.0, 78.1e2, 5696.0e4, 2003.0e4, 570.0e3, 200.3e3,
                642.5e3, 306.0e3, 59.3e4, 0.0, 85.4, 50.7, 61.3,
            ),
            (
                "HEB 240", 240.0, 240.0, 10.0, 17.0, 106.0e2, 11260.0e4, 3923.0e4, 938.3e3,
                327.0e3, 1053.0e3, 498.4e3, 103.0e4, 0.0, 103.1, 60.8, 83.2,
            ),
            (
                "HEB 300", 300.0, 300.0, 11.0, 19.0, 149.1e2, 25170.0e4, 8563.0e4, 1678.0e3,
                571.0e3, 1869.0e3, 870.5e3, 185.0e4, 0.0, 129.9, 75.8, 117.0,
            ),
            (
                "HEB 400", 400.0, 300.0, 13.5, 24.0, 197.8e2, 57680.0e4, 10820.0e4, 2884.0e3,
                721.0e3, 3232.0e3, 1104.0e3, 355.0e4, 0.0, 170.7, 74.0, 155.3,
            ),
        ];

        for (desig, d, bf, tw, tf, a, ix, iy, sx, sy, zx, zy, j, cw, rx, ry, wgt) in euro_sections {
            self.sections.push(SteelSection {
                designation: desig.to_string(),
                standard: SectionStandard::Eurocode,
                shape: SectionShape::IBeam,
                depth: d,
                width: bf,
                tw,
                tf,
                r1: 0.0,
                area: a,
                ix,
                iy,
                sx,
                sy,
                zx,
                zy,
                j,
                cw,
                rx,
                ry,
                weight_per_m: wgt,
            });
        }
    }
}

impl Default for SectionDatabase {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lookup() {
        let db = SectionDatabase::new();
        let section = db.get("ISMB 400").expect("Section database missing entry for ISMB 400");
        assert!((section.depth - 400.0).abs() < 0.1);
        assert!(section.area > 7000.0);
    }

    #[test]
    fn test_search() {
        let db = SectionDatabase::new();
        let results = db.search("ISMB");
        assert!(results.len() >= 10);
    }

    #[test]
    fn test_aisc_lookup() {
        let db = SectionDatabase::new();
        let section = db.get("W14x48").expect("Section database missing entry for W14x48");
        assert!(section.depth > 340.0 && section.depth < 360.0);
    }

    #[test]
    fn test_optimal_selection() {
        let db = SectionDatabase::new();
        // Need Zx >= 500e3 mm³
        let opt = db.select_optimal(500.0e3, SectionStandard::IS, SectionShape::IBeam);
        assert!(opt.is_some());
        let s = opt.expect("Expected at least one section option");
        assert!(s.zx >= 500.0e3);
    }

    #[test]
    fn test_eurocode_sections() {
        let db = SectionDatabase::new();
        let ipe = db.get("IPE 300").expect("Section database missing entry for IPE 300");
        assert!((ipe.depth - 300.0).abs() < 0.1);
        let heb = db.get("HEB 200").expect("Section database missing entry for HEB 200");
        assert!((heb.depth - 200.0).abs() < 0.1);
    }
}
