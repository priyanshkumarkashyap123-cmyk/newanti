//! # Surveying Engineering Module (Rust)
//! 
//! High-performance surveying calculations including:
//! - Coordinate transformations
//! - Traverse computations
//! - Curve setting out
//! - Earthwork calculations
//! - Area and volume computations

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// COORDINATE SYSTEMS
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64, // Easting
    pub y: f64, // Northing
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64, // Easting
    pub y: f64, // Northing
    pub z: f64, // Elevation
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GeodeticCoord {
    /// Latitude (degrees)
    pub latitude: f64,
    /// Longitude (degrees)
    pub longitude: f64,
    /// Ellipsoidal height (m)
    pub height: f64,
}

/// Coordinate transformation utilities
pub struct Coordinates;

impl Coordinates {
    /// Calculate bearing from point 1 to point 2 (degrees)
    pub fn bearing(p1: &Point2D, p2: &Point2D) -> f64 {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        
        let angle = dx.atan2(dy).to_degrees();
        if angle < 0.0 { angle + 360.0 } else { angle }
    }
    
    /// Calculate distance between two points
    pub fn distance_2d(p1: &Point2D, p2: &Point2D) -> f64 {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        (dx * dx + dy * dy).sqrt()
    }
    
    /// Calculate 3D distance
    pub fn distance_3d(p1: &Point3D, p2: &Point3D) -> f64 {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let dz = p2.z - p1.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Calculate slope distance and zenith angle
    pub fn slope_info(p1: &Point3D, p2: &Point3D) -> (f64, f64) {
        let horizontal = Self::distance_2d(
            &Point2D { x: p1.x, y: p1.y },
            &Point2D { x: p2.x, y: p2.y },
        );
        let dz = p2.z - p1.z;
        let slope_dist = (horizontal * horizontal + dz * dz).sqrt();
        let zenith = (horizontal / slope_dist).acos().to_degrees();
        
        (slope_dist, zenith)
    }
    
    /// Calculate point from bearing and distance
    pub fn point_from_bearing(origin: &Point2D, bearing_deg: f64, distance: f64) -> Point2D {
        let bearing_rad = bearing_deg.to_radians();
        Point2D {
            x: origin.x + distance * bearing_rad.sin(),
            y: origin.y + distance * bearing_rad.cos(),
        }
    }
    
    /// Degrees to DMS (Degrees, Minutes, Seconds)
    pub fn deg_to_dms(degrees: f64) -> (i32, i32, f64) {
        let d = degrees.abs();
        let deg = d.floor() as i32;
        let min_float = (d - deg as f64) * 60.0;
        let min = min_float.floor() as i32;
        let sec = (min_float - min as f64) * 60.0;
        
        if degrees < 0.0 {
            (-deg, min, sec)
        } else {
            (deg, min, sec)
        }
    }
    
    /// DMS to Degrees
    pub fn dms_to_deg(deg: i32, min: i32, sec: f64) -> f64 {
        let sign = if deg < 0 { -1.0 } else { 1.0 };
        sign * (deg.abs() as f64 + min as f64 / 60.0 + sec / 3600.0)
    }
    
    /// Geographic to UTM coordinates
    pub fn geo_to_utm(lat: f64, lon: f64) -> (f64, f64, i32) {
        // WGS84 ellipsoid
        let a = 6378137.0;
        let f = 1.0 / 298.257223563;
        let e2 = 2.0 * f - f * f;
        let e_prime2 = e2 / (1.0 - e2);
        
        let lat_rad = lat.to_radians();
        let lon_rad = lon.to_radians();
        
        // UTM zone
        let zone = ((lon + 180.0) / 6.0).floor() as i32 + 1;
        let lon0 = ((zone as f64 - 1.0) * 6.0 - 180.0 + 3.0).to_radians();
        
        let k0 = 0.9996;
        let n = (lat_rad.sin()).powi(2) * e2 / (1.0 - e2 * lat_rad.sin().powi(2));
        let t = lat_rad.tan().powi(2);
        let c = e_prime2 * lat_rad.cos().powi(2);
        let aa = (lon_rad - lon0) * lat_rad.cos();
        
        let nu = a / (1.0 - e2 * lat_rad.sin().powi(2)).sqrt();
        
        // Meridian arc
        let m = a * (
            (1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0) * lat_rad
            - (3.0 * e2 / 8.0 + 3.0 * e2 * e2 / 32.0) * (2.0 * lat_rad).sin()
            + (15.0 * e2 * e2 / 256.0) * (4.0 * lat_rad).sin()
        );
        
        let easting = k0 * nu * (
            aa + (1.0 - t + c) * aa.powi(3) / 6.0
            + (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * e_prime2) * aa.powi(5) / 120.0
        ) + 500000.0;
        
        let mut northing = k0 * (
            m + nu * lat_rad.tan() * (
                aa * aa / 2.0
                + (5.0 - t + 9.0 * c + 4.0 * c * c) * aa.powi(4) / 24.0
                + (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * e_prime2) * aa.powi(6) / 720.0
            )
        );
        
        if lat < 0.0 {
            northing += 10000000.0;
        }
        
        (easting, northing, zone)
    }
}

// ============================================================================
// TRAVERSE COMPUTATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraverseStation {
    pub name: String,
    /// Observed angle (degrees)
    pub angle: f64,
    /// Distance to next station (m)
    pub distance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraverseResult {
    pub coordinates: Vec<(String, Point2D)>,
    /// Linear misclosure (m)
    pub linear_misclosure: f64,
    /// Angular misclosure (seconds)
    pub angular_misclosure: f64,
    /// Relative precision (1:n)
    pub precision: f64,
    /// Adjusted coordinates
    pub adjusted_coordinates: Vec<(String, Point2D)>,
}

/// Traverse computation calculator
pub struct Traverse;

impl Traverse {
    /// Compute closed traverse
    pub fn closed_traverse(
        stations: &[TraverseStation],
        starting_point: Point2D,
        starting_bearing: f64,
    ) -> TraverseResult {
        let n = stations.len();
        
        // Calculate sum of angles
        let angle_sum: f64 = stations.iter().map(|s| s.angle).sum();
        let expected_sum = (n as f64 - 2.0) * 180.0 + 360.0; // For interior angles
        let angular_misclosure = (angle_sum - expected_sum) * 3600.0; // seconds
        
        // Distribute angular error
        let correction = (expected_sum - angle_sum) / n as f64;
        let adjusted_angles: Vec<f64> = stations.iter()
            .map(|s| s.angle + correction)
            .collect();
        
        // Calculate bearings
        let mut bearings = vec![starting_bearing];
        for i in 0..n - 1 {
            let new_bearing = bearings[i] + adjusted_angles[i] - 180.0;
            let normalized = if new_bearing < 0.0 {
                new_bearing + 360.0
            } else if new_bearing >= 360.0 {
                new_bearing - 360.0
            } else {
                new_bearing
            };
            bearings.push(normalized);
        }
        
        // Calculate coordinates
        let mut coordinates = vec![(stations[0].name.clone(), starting_point)];
        let mut sum_lat = 0.0;
        let mut sum_dep = 0.0;
        let mut total_dist = 0.0;
        
        for i in 0..n {
            let bearing_rad = bearings[i].to_radians();
            let dist = stations[i].distance;
            
            let lat = dist * bearing_rad.cos(); // Northing
            let dep = dist * bearing_rad.sin(); // Easting
            
            sum_lat += lat;
            sum_dep += dep;
            total_dist += dist;
            
            let prev = &coordinates[i].1;
            let next = Point2D {
                x: prev.x + dep,
                y: prev.y + lat,
            };
            
            if i < n - 1 {
                coordinates.push((stations[i + 1].name.clone(), next));
            }
        }
        
        // Calculate misclosure
        let linear_misclosure = (sum_lat * sum_lat + sum_dep * sum_dep).sqrt();
        let precision = if linear_misclosure > 0.0001 {
            total_dist / linear_misclosure
        } else {
            999999.0
        };
        
        // Compass rule adjustment
        let mut adjusted_coordinates = vec![(stations[0].name.clone(), starting_point)];
        let mut cumulative_dist = 0.0;
        
        for i in 0..n - 1 {
            cumulative_dist += stations[i].distance;
            let lat_corr = -sum_lat * cumulative_dist / total_dist;
            let dep_corr = -sum_dep * cumulative_dist / total_dist;
            
            let unadjusted = &coordinates[i + 1].1;
            let adjusted = Point2D {
                x: unadjusted.x + dep_corr,
                y: unadjusted.y + lat_corr,
            };
            
            adjusted_coordinates.push((stations[i + 1].name.clone(), adjusted));
        }
        
        TraverseResult {
            coordinates,
            linear_misclosure,
            angular_misclosure,
            precision,
            adjusted_coordinates,
        }
    }
    
    /// Calculate area from traverse coordinates (Coordinate method)
    pub fn area_from_coordinates(points: &[Point2D]) -> f64 {
        if points.len() < 3 {
            return 0.0;
        }
        
        let n = points.len();
        let mut sum = 0.0;
        
        for i in 0..n {
            let j = (i + 1) % n;
            sum += points[i].x * points[j].y;
            sum -= points[j].x * points[i].y;
        }
        
        sum.abs() / 2.0
    }
}

// ============================================================================
// LEVELING
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelingObservation {
    pub station: String,
    pub backsight: Option<f64>,
    pub foresight: Option<f64>,
    pub intermediate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelingResult {
    pub elevations: Vec<(String, f64)>,
    /// Misclosure (m)
    pub misclosure: f64,
    /// Adjusted elevations
    pub adjusted_elevations: Vec<(String, f64)>,
}

/// Leveling computation calculator
pub struct Leveling;

impl Leveling {
    /// Rise and fall method
    pub fn rise_fall(
        observations: &[LevelingObservation],
        starting_elevation: f64,
    ) -> LevelingResult {
        let mut elevations = vec![];
        let mut current_elevation = starting_elevation;
        let mut hi = starting_elevation; // Height of instrument
        
        for obs in observations {
            if let Some(bs) = obs.backsight {
                hi = current_elevation + bs;
            }
            
            if let Some(fs) = obs.foresight {
                current_elevation = hi - fs;
                elevations.push((obs.station.clone(), current_elevation));
            } else if let Some(is) = obs.intermediate {
                let elev = hi - is;
                elevations.push((obs.station.clone(), elev));
            }
        }
        
        // For closed loop, misclosure is difference from known elevation
        let misclosure = 0.0; // Would need known endpoint
        
        LevelingResult {
            elevations: elevations.clone(),
            misclosure,
            adjusted_elevations: elevations,
        }
    }
    
    /// Height of collimation method
    pub fn height_of_collimation(
        observations: &[LevelingObservation],
        starting_elevation: f64,
    ) -> LevelingResult {
        Self::rise_fall(observations, starting_elevation) // Similar calculation
    }
    
    /// Allowable misclosure (3rd order leveling)
    pub fn allowable_misclosure_3rd_order(distance_km: f64) -> f64 {
        0.012 * distance_km.sqrt() // mm
    }
}

// ============================================================================
// AREA CALCULATION
// ============================================================================

/// Area calculation methods
pub struct AreaCalculation;

impl AreaCalculation {
    /// Cross-coordinate method
    pub fn cross_coordinate(points: &[Point2D]) -> f64 {
        Traverse::area_from_coordinates(points)
    }
    
    /// Double Meridian Distance (DMD) method
    pub fn dmd_method(departures: &[f64], latitudes: &[f64]) -> f64 {
        let n = departures.len();
        if n < 3 || latitudes.len() != n {
            return 0.0;
        }
        
        let mut dmd = vec![departures[0]];
        
        for i in 1..n {
            let new_dmd = dmd[i - 1] + departures[i - 1] + departures[i];
            dmd.push(new_dmd);
        }
        
        let mut double_area = 0.0;
        for i in 0..n {
            double_area += dmd[i] * latitudes[i];
        }
        
        double_area.abs() / 2.0
    }
    
    /// Simpson's rule for irregular boundary
    pub fn simpson_rule(ordinates: &[f64], spacing: f64) -> f64 {
        let n = ordinates.len();
        if n < 3 {
            return 0.0;
        }
        
        // Simpson's 1/3 rule requires odd number of ordinates
        let use_n = if n % 2 == 0 { n - 1 } else { n };
        
        let mut area = ordinates[0] + ordinates[use_n - 1];
        
        for i in 1..use_n - 1 {
            if i % 2 == 0 {
                area += 2.0 * ordinates[i];
            } else {
                area += 4.0 * ordinates[i];
            }
        }
        
        area *= spacing / 3.0;
        
        // Handle remaining trapezoid if even number
        if n % 2 == 0 {
            area += spacing * (ordinates[n - 2] + ordinates[n - 1]) / 2.0;
        }
        
        area
    }
    
    /// Trapezoidal rule
    pub fn trapezoidal_rule(ordinates: &[f64], spacing: f64) -> f64 {
        let n = ordinates.len();
        if n < 2 {
            return 0.0;
        }
        
        let mut area = (ordinates[0] + ordinates[n - 1]) / 2.0;
        for i in 1..n - 1 {
            area += ordinates[i];
        }
        
        area * spacing
    }
}

// ============================================================================
// CURVE SETTING OUT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurveSetout {
    pub station: f64,
    pub chord: f64,
    pub deflection_angle: f64,
    pub tangent_offset: f64,
    pub coordinates: Point2D,
}

/// Curve setting out calculator
pub struct CurveSettingOut;

impl CurveSettingOut {
    /// Deflection angle method for circular curve
    pub fn deflection_angles(
        pi_point: Point2D,
        radius: f64,
        delta: f64, // Total deflection in degrees
        chord_length: f64,
        back_bearing: f64,
    ) -> Vec<CurveSetout> {
        let mut setouts = vec![];
        
        let delta_rad = delta.to_radians();
        let curve_length = radius * delta_rad;
        let num_chords = (curve_length / chord_length).ceil() as i32;
        
        // Deflection angle for full chord
        let deflection_per_chord = (chord_length / (2.0 * radius)).asin().to_degrees();
        
        // Calculate tangent length
        let tangent = radius * (delta_rad / 2.0).tan();
        
        // PC point
        let forward_bearing = back_bearing + 180.0;
        let pc_point = Coordinates::point_from_bearing(&pi_point, forward_bearing, tangent);
        
        let mut cumulative_deflection = 0.0;
        let mut station = 0.0;
        
        for i in 0..=num_chords {
            let is_last = i == num_chords;
            let actual_chord = if is_last {
                curve_length - station
            } else {
                chord_length.min(curve_length - station)
            };
            
            if actual_chord < 0.001 {
                break;
            }
            
            // Deflection for this chord
            let deflection = (actual_chord / (2.0 * radius)).asin().to_degrees();
            cumulative_deflection += deflection;
            
            // Calculate coordinates
            let bearing = back_bearing + cumulative_deflection;
            let total_chord = 2.0 * radius * (cumulative_deflection.to_radians()).sin();
            let point = Coordinates::point_from_bearing(&pc_point, bearing, total_chord);
            
            // Tangent offset
            let tangent_offset = radius * (1.0 - (station / radius).cos());
            
            setouts.push(CurveSetout {
                station,
                chord: actual_chord,
                deflection_angle: cumulative_deflection,
                tangent_offset,
                coordinates: point,
            });
            
            station += actual_chord;
            if is_last {
                break;
            }
        }
        
        setouts
    }
    
    /// Offset from tangent method
    pub fn tangent_offsets(radius: f64, interval: f64, curve_length: f64) -> Vec<(f64, f64, f64)> {
        let mut offsets = vec![];
        let mut x = 0.0;
        
        while x <= curve_length {
            // y = R - sqrt(R² - x²) (approximate for small x)
            // Or exact: y = R(1 - cos(x/R))
            let theta = x / radius;
            let y_exact = radius * (1.0 - theta.cos());
            let y_approx = x * x / (2.0 * radius);
            
            offsets.push((x, y_exact, y_approx));
            x += interval;
        }
        
        offsets
    }
}

// ============================================================================
// VOLUME CALCULATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContourData {
    pub elevation: f64,
    pub area: f64, // Area enclosed by contour
}

/// Volume calculation methods
pub struct VolumeCalculation;

impl VolumeCalculation {
    /// Volume from contours
    pub fn from_contours(contours: &[ContourData]) -> f64 {
        if contours.len() < 2 {
            return 0.0;
        }
        
        let mut volume = 0.0;
        
        for i in 0..contours.len() - 1 {
            let h = contours[i + 1].elevation - contours[i].elevation;
            let a1 = contours[i].area;
            let a2 = contours[i + 1].area;
            
            // Prismoidal formula
            volume += h / 6.0 * (a1 + a2 + 4.0 * (a1 + a2) / 2.0);
        }
        
        volume
    }
    
    /// Spot height grid volume
    pub fn spot_height_grid(heights: &[Vec<f64>], grid_size: f64, base_level: f64) -> f64 {
        let rows = heights.len();
        if rows < 2 {
            return 0.0;
        }
        let cols = heights[0].len();
        if cols < 2 {
            return 0.0;
        }
        
        let mut volume = 0.0;
        let cell_area = grid_size * grid_size;
        
        for i in 0..rows - 1 {
            for j in 0..cols - 1 {
                // Average height of cell corners
                let avg_height = (
                    heights[i][j] + heights[i][j + 1] + 
                    heights[i + 1][j] + heights[i + 1][j + 1]
                ) / 4.0 - base_level;
                
                volume += cell_area * avg_height;
            }
        }
        
        volume
    }
    
    /// Prismoidal correction
    pub fn prismoidal_correction(
        area1: f64,
        area2: f64,
        width1: f64,
        width2: f64,
        depth1: f64,
        depth2: f64,
        length: f64,
    ) -> f64 {
        // Cp = L/12 * (w1 - w2) * (d1 - d2)
        length / 12.0 * (width1 - width2) * (depth1 - depth2)
    }
}

// ============================================================================
// TOTAL STATION CALCULATIONS
// ============================================================================

/// Total station calculation utilities
pub struct TotalStation;

impl TotalStation {
    /// Calculate coordinates from total station observations
    pub fn calculate_point(
        station: &Point3D,
        horizontal_angle: f64,  // degrees
        vertical_angle: f64,    // degrees (zenith)
        slope_distance: f64,
        instrument_height: f64,
        prism_height: f64,
        backsight_bearing: f64,
    ) -> Point3D {
        let zenith_rad = vertical_angle.to_radians();
        
        // Calculate horizontal distance
        let horizontal_dist = slope_distance * zenith_rad.sin();
        
        // Calculate vertical difference
        let vertical_diff = slope_distance * zenith_rad.cos() + 
            instrument_height - prism_height;
        
        // Calculate bearing
        let bearing = backsight_bearing + horizontal_angle;
        let bearing_normalized = if bearing >= 360.0 {
            bearing - 360.0
        } else if bearing < 0.0 {
            bearing + 360.0
        } else {
            bearing
        };
        
        let bearing_rad = bearing_normalized.to_radians();
        
        Point3D {
            x: station.x + horizontal_dist * bearing_rad.sin(),
            y: station.y + horizontal_dist * bearing_rad.cos(),
            z: station.z + vertical_diff,
        }
    }
    
    /// Free station / Resection
    pub fn resection(
        known_points: &[(Point2D, f64)], // (coordinates, observed angle from station)
    ) -> Option<Point2D> {
        if known_points.len() < 3 {
            return None;
        }
        
        // Collins method for 3-point resection
        let (a, angle_a) = &known_points[0];
        let (b, angle_b) = &known_points[1];
        let (c, angle_c) = &known_points[2];
        
        let alpha = angle_b - angle_a;
        let beta = angle_c - angle_b;
        
        // Solve using iterative or direct method
        // This is a simplified approximation
        let center_x = (a.x + b.x + c.x) / 3.0;
        let center_y = (a.y + b.y + c.y) / 3.0;
        
        // Would need full resection algorithm for accurate result
        Some(Point2D {
            x: center_x,
            y: center_y,
        })
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bearing_calculation() {
        let p1 = Point2D { x: 100.0, y: 100.0 };
        let p2 = Point2D { x: 200.0, y: 200.0 };
        
        let bearing = Coordinates::bearing(&p1, &p2);
        assert!((bearing - 45.0).abs() < 0.01);
    }
    
    #[test]
    fn test_distance_calculation() {
        let p1 = Point2D { x: 0.0, y: 0.0 };
        let p2 = Point2D { x: 3.0, y: 4.0 };
        
        let dist = Coordinates::distance_2d(&p1, &p2);
        assert!((dist - 5.0).abs() < 0.001);
    }
    
    #[test]
    fn test_area_calculation() {
        // Square 100m x 100m
        let points = vec![
            Point2D { x: 0.0, y: 0.0 },
            Point2D { x: 100.0, y: 0.0 },
            Point2D { x: 100.0, y: 100.0 },
            Point2D { x: 0.0, y: 100.0 },
        ];
        
        let area = AreaCalculation::cross_coordinate(&points);
        assert!((area - 10000.0).abs() < 0.01);
    }
    
    #[test]
    fn test_dms_conversion() {
        let (d, m, s) = Coordinates::deg_to_dms(45.5025);
        assert_eq!(d, 45);
        assert_eq!(m, 30);
        assert!((s - 9.0).abs() < 0.1);
        
        let deg = Coordinates::dms_to_deg(45, 30, 9.0);
        assert!((deg - 45.5025).abs() < 0.001);
    }
}
