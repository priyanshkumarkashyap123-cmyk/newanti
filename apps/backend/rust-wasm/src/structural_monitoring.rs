// ============================================================================
// STRUCTURAL MONITORING - Phase 22
// Load cells, strain gauges, inclinometers, settlement monitoring
// Standards: ISO 18674, ASTM E529, BS 5975
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// SENSOR TYPES
// ============================================================================

/// Sensor categories
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SensorType {
    LoadCell,
    StrainGauge,
    Inclinometer,
    SettlementPoint,
    Extensometer,
    Piezometer,
    Accelerometer,
    LVDT,
    CrackMeter,
    TemperatureSensor,
    TiltMeter,
    Surveying,
}

impl SensorType {
    /// Typical measurement unit
    pub fn unit(&self) -> &str {
        match self {
            SensorType::LoadCell => "kN",
            SensorType::StrainGauge => "με",
            SensorType::Inclinometer => "mm",
            SensorType::SettlementPoint => "mm",
            SensorType::Extensometer => "mm",
            SensorType::Piezometer => "kPa",
            SensorType::Accelerometer => "g",
            SensorType::LVDT => "mm",
            SensorType::CrackMeter => "mm",
            SensorType::TemperatureSensor => "°C",
            SensorType::TiltMeter => "°",
            SensorType::Surveying => "mm",
        }
    }
    
    /// Typical accuracy
    pub fn typical_accuracy(&self) -> f64 {
        match self {
            SensorType::LoadCell => 0.1, // % FS
            SensorType::StrainGauge => 1.0, // με
            SensorType::Inclinometer => 0.01, // mm/m
            SensorType::SettlementPoint => 0.5, // mm
            SensorType::Extensometer => 0.01, // mm
            SensorType::Piezometer => 0.1, // % FS
            SensorType::Accelerometer => 0.001, // g
            SensorType::LVDT => 0.001, // mm
            SensorType::CrackMeter => 0.01, // mm
            SensorType::TemperatureSensor => 0.1, // °C
            SensorType::TiltMeter => 0.001, // °
            SensorType::Surveying => 1.0, // mm
        }
    }
}

/// Sensor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sensor {
    /// Sensor ID
    pub id: String,
    /// Sensor type
    pub sensor_type: SensorType,
    /// Location description
    pub location: String,
    /// X coordinate (m)
    pub x: f64,
    /// Y coordinate (m)
    pub y: f64,
    /// Z coordinate (m)
    pub z: f64,
    /// Measurement range
    pub range: (f64, f64),
    /// Accuracy
    pub accuracy: f64,
    /// Calibration factor
    pub calibration_factor: f64,
    /// Alert thresholds (warning, alarm)
    pub thresholds: (f64, f64),
    /// Is active?
    pub is_active: bool,
}

impl Sensor {
    pub fn new(id: &str, sensor_type: SensorType, location: &str) -> Self {
        let typical_range = match sensor_type {
            SensorType::LoadCell => (-1000.0, 5000.0),
            SensorType::StrainGauge => (-2000.0, 2000.0),
            SensorType::Inclinometer => (-100.0, 100.0),
            SensorType::SettlementPoint => (-100.0, 100.0),
            _ => (-1000.0, 1000.0),
        };
        
        Self {
            id: id.to_string(),
            sensor_type,
            location: location.to_string(),
            x: 0.0, y: 0.0, z: 0.0,
            range: typical_range,
            accuracy: sensor_type.typical_accuracy(),
            calibration_factor: 1.0,
            thresholds: (typical_range.1 * 0.7, typical_range.1 * 0.9),
            is_active: true,
        }
    }
    
    /// Set position
    pub fn at_position(mut self, x: f64, y: f64, z: f64) -> Self {
        self.x = x;
        self.y = y;
        self.z = z;
        self
    }
    
    /// Set thresholds
    pub fn with_thresholds(mut self, warning: f64, alarm: f64) -> Self {
        self.thresholds = (warning, alarm);
        self
    }
    
    /// Apply calibration to raw reading
    pub fn calibrate(&self, raw_value: f64) -> f64 {
        raw_value * self.calibration_factor
    }
    
    /// Check reading against thresholds
    pub fn check_thresholds(&self, value: f64) -> AlertLevel {
        let abs_val = value.abs();
        if abs_val >= self.thresholds.1 {
            AlertLevel::Alarm
        } else if abs_val >= self.thresholds.0 {
            AlertLevel::Warning
        } else {
            AlertLevel::Normal
        }
    }
}

/// Alert levels
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AlertLevel {
    Normal,
    Warning,
    Alarm,
    Fault,
}

// ============================================================================
// MONITORING DATA
// ============================================================================

/// Single measurement reading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reading {
    /// Sensor ID
    pub sensor_id: String,
    /// Timestamp (Unix epoch seconds)
    pub timestamp: u64,
    /// Raw value
    pub raw_value: f64,
    /// Calibrated value
    pub calibrated_value: f64,
    /// Quality flag (0-100%)
    pub quality: u8,
    /// Alert level
    pub alert_level: AlertLevel,
}

impl Reading {
    pub fn new(sensor: &Sensor, raw_value: f64, timestamp: u64) -> Self {
        let calibrated = sensor.calibrate(raw_value);
        let alert_level = sensor.check_thresholds(calibrated);
        
        Self {
            sensor_id: sensor.id.clone(),
            timestamp,
            raw_value,
            calibrated_value: calibrated,
            quality: 100, // Assume good quality
            alert_level,
        }
    }
    
    /// Is reading valid?
    pub fn is_valid(&self) -> bool {
        self.quality > 50 && 
        !self.calibrated_value.is_nan() &&
        !self.calibrated_value.is_infinite()
    }
}

/// Time series data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeries {
    /// Sensor ID
    pub sensor_id: String,
    /// Readings
    pub readings: Vec<Reading>,
    /// Start timestamp
    pub start_time: u64,
    /// End timestamp
    pub end_time: u64,
}

impl TimeSeries {
    pub fn new(sensor_id: &str) -> Self {
        Self {
            sensor_id: sensor_id.to_string(),
            readings: Vec::new(),
            start_time: u64::MAX,
            end_time: 0,
        }
    }
    
    /// Add reading
    pub fn add_reading(&mut self, reading: Reading) {
        if reading.timestamp < self.start_time {
            self.start_time = reading.timestamp;
        }
        if reading.timestamp > self.end_time {
            self.end_time = reading.timestamp;
        }
        self.readings.push(reading);
    }
    
    /// Number of readings
    pub fn count(&self) -> usize {
        self.readings.len()
    }
    
    /// Get values as vector
    pub fn values(&self) -> Vec<f64> {
        self.readings.iter().map(|r| r.calibrated_value).collect()
    }
    
    /// Get timestamps as vector
    pub fn timestamps(&self) -> Vec<u64> {
        self.readings.iter().map(|r| r.timestamp).collect()
    }
    
    /// Statistics
    pub fn statistics(&self) -> TimeSeriesStats {
        let values = self.values();
        if values.is_empty() {
            return TimeSeriesStats::default();
        }
        
        let n = values.len() as f64;
        let sum: f64 = values.iter().sum();
        let mean = sum / n;
        
        let min = values.iter().cloned().fold(f64::MAX, f64::min);
        let max = values.iter().cloned().fold(f64::MIN, f64::max);
        
        let variance: f64 = values.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / n;
        let std_dev = variance.sqrt();
        
        // Rate of change (if multiple readings)
        let rate = if values.len() >= 2 && self.end_time > self.start_time {
            let dt = (self.end_time - self.start_time) as f64 / 3600.0 / 24.0; // days
            if dt > 0.0 {
                (values.last().unwrap_or(&0.0) - values.first().unwrap_or(&0.0)) / dt
            } else {
                0.0
            }
        } else {
            0.0
        };
        
        TimeSeriesStats {
            count: values.len(),
            min, max, mean, std_dev,
            rate,
            latest: *values.last().unwrap_or(&0.0),
        }
    }
    
    /// Detect trend (linear regression)
    pub fn trend(&self) -> (f64, f64) {
        let values = self.values();
        let n = values.len() as f64;
        
        if n < 2.0 {
            return (0.0, 0.0);
        }
        
        // Simple linear regression
        let x: Vec<f64> = (0..values.len()).map(|i| i as f64).collect();
        let x_mean: f64 = x.iter().sum::<f64>() / n;
        let y_mean: f64 = values.iter().sum::<f64>() / n;
        
        let numerator: f64 = x.iter().zip(values.iter())
            .map(|(&xi, &yi)| (xi - x_mean) * (yi - y_mean))
            .sum();
        let denominator: f64 = x.iter()
            .map(|&xi| (xi - x_mean).powi(2))
            .sum();
        
        let slope = if denominator != 0.0 { numerator / denominator } else { 0.0 };
        let intercept = y_mean - slope * x_mean;
        
        (slope, intercept)
    }
    
    /// Moving average
    pub fn moving_average(&self, window: usize) -> Vec<f64> {
        let values = self.values();
        if values.len() < window {
            return values;
        }
        
        let mut result = Vec::new();
        for i in 0..=(values.len() - window) {
            let avg: f64 = values[i..i+window].iter().sum::<f64>() / window as f64;
            result.push(avg);
        }
        result
    }
}

/// Time series statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TimeSeriesStats {
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub std_dev: f64,
    pub rate: f64,
    pub latest: f64,
}

// ============================================================================
// INCLINOMETER ANALYSIS
// ============================================================================

/// Inclinometer profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InclinometerProfile {
    /// Borehole ID
    pub borehole_id: String,
    /// Depths (m from top)
    pub depths: Vec<f64>,
    /// A-direction deviations (mm)
    pub a_deviation: Vec<f64>,
    /// B-direction deviations (mm)
    pub b_deviation: Vec<f64>,
    /// Reference reading flag
    pub is_reference: bool,
    /// Timestamp
    pub timestamp: u64,
}

impl InclinometerProfile {
    pub fn new(borehole_id: &str, depths: Vec<f64>) -> Self {
        let n = depths.len();
        Self {
            borehole_id: borehole_id.to_string(),
            depths,
            a_deviation: vec![0.0; n],
            b_deviation: vec![0.0; n],
            is_reference: false,
            timestamp: 0,
        }
    }
    
    /// Set deviations
    pub fn set_deviations(&mut self, a: Vec<f64>, b: Vec<f64>) {
        self.a_deviation = a;
        self.b_deviation = b;
    }
    
    /// Resultant displacement at depth
    pub fn resultant_at(&self, index: usize) -> f64 {
        let a = self.a_deviation.get(index).unwrap_or(&0.0);
        let b = self.b_deviation.get(index).unwrap_or(&0.0);
        (a.powi(2) + b.powi(2)).sqrt()
    }
    
    /// Maximum displacement
    pub fn max_displacement(&self) -> (f64, f64) {
        let mut max_val = 0.0;
        let mut max_depth = 0.0;
        
        for i in 0..self.depths.len() {
            let r = self.resultant_at(i);
            if r > max_val {
                max_val = r;
                max_depth = self.depths[i];
            }
        }
        
        (max_val, max_depth)
    }
    
    /// Calculate incremental displacement from reference
    pub fn incremental_from(&self, reference: &InclinometerProfile) -> Vec<(f64, f64)> {
        let mut incremental = Vec::new();
        
        for i in 0..self.depths.len().min(reference.depths.len()) {
            let da = self.a_deviation[i] - reference.a_deviation[i];
            let db = self.b_deviation[i] - reference.b_deviation[i];
            incremental.push((da, db));
        }
        
        incremental
    }
    
    /// Displacement rate (mm/day) from previous reading
    pub fn rate_from(&self, previous: &InclinometerProfile) -> f64 {
        if self.timestamp <= previous.timestamp {
            return 0.0;
        }
        
        let (max_current, _) = self.max_displacement();
        let (max_prev, _) = previous.max_displacement();
        
        let dt = (self.timestamp - previous.timestamp) as f64 / 86400.0; // days
        (max_current - max_prev) / dt
    }
}

// ============================================================================
// SETTLEMENT ANALYSIS
// ============================================================================

/// Settlement point data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementPoint {
    /// Point ID
    pub point_id: String,
    /// X coordinate (m)
    pub x: f64,
    /// Y coordinate (m)
    pub y: f64,
    /// Initial elevation (m)
    pub initial_elevation: f64,
    /// Readings: (timestamp, elevation)
    pub readings: Vec<(u64, f64)>,
}

impl SettlementPoint {
    pub fn new(point_id: &str, x: f64, y: f64, initial_elevation: f64) -> Self {
        Self {
            point_id: point_id.to_string(),
            x, y,
            initial_elevation,
            readings: vec![(0, initial_elevation)],
        }
    }
    
    /// Add reading
    pub fn add_reading(&mut self, timestamp: u64, elevation: f64) {
        self.readings.push((timestamp, elevation));
    }
    
    /// Current settlement (mm, positive = downward)
    pub fn current_settlement(&self) -> f64 {
        let current = self.readings.last().map(|r| r.1).unwrap_or(self.initial_elevation);
        (self.initial_elevation - current) * 1000.0
    }
    
    /// Settlement at time
    pub fn settlement_at(&self, timestamp: u64) -> Option<f64> {
        for (t, elev) in &self.readings {
            if *t == timestamp {
                return Some((self.initial_elevation - elev) * 1000.0);
            }
        }
        None
    }
    
    /// Settlement rate (mm/day)
    pub fn settlement_rate(&self) -> f64 {
        if self.readings.len() < 2 {
            return 0.0;
        }
        
        let (t1, e1) = &self.readings[self.readings.len() - 2];
        let (t2, e2) = &self.readings[self.readings.len() - 1];
        
        if t2 <= t1 {
            return 0.0;
        }
        
        let ds = (e1 - e2) * 1000.0; // mm (positive = downward)
        let dt = (*t2 - *t1) as f64 / 86400.0; // days
        
        ds / dt
    }
    
    /// Predict settlement using Asaoka method
    pub fn predict_ultimate(&self, interval: usize) -> f64 {
        let settlements: Vec<f64> = self.readings.iter()
            .map(|(_, e)| (self.initial_elevation - e) * 1000.0)
            .collect();
        
        if settlements.len() < interval * 3 {
            return self.current_settlement();
        }
        
        // Asaoka plot: s(n) vs s(n-1)
        let mut x_vals = Vec::new();
        let mut y_vals = Vec::new();
        
        for i in (interval..settlements.len()).step_by(interval) {
            x_vals.push(settlements[i - interval]);
            y_vals.push(settlements[i]);
        }
        
        // Linear regression for Asaoka line
        let n = x_vals.len() as f64;
        if n < 2.0 {
            return self.current_settlement();
        }
        
        let x_mean: f64 = x_vals.iter().sum::<f64>() / n;
        let y_mean: f64 = y_vals.iter().sum::<f64>() / n;
        
        let numerator: f64 = x_vals.iter().zip(y_vals.iter())
            .map(|(&xi, &yi)| (xi - x_mean) * (yi - y_mean))
            .sum();
        let denominator: f64 = x_vals.iter()
            .map(|&xi| (xi - x_mean).powi(2))
            .sum();
        
        let beta = if denominator != 0.0 { numerator / denominator } else { 0.0 };
        let alpha = y_mean - beta * x_mean;
        
        // Ultimate settlement = alpha / (1 - beta)
        if (1.0 - beta).abs() > 0.01 {
            alpha / (1.0 - beta)
        } else {
            self.current_settlement()
        }
    }
}

/// Settlement array analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementArray {
    /// Array name
    pub name: String,
    /// Settlement points
    pub points: Vec<SettlementPoint>,
}

impl SettlementArray {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            points: Vec::new(),
        }
    }
    
    /// Add point
    pub fn add_point(&mut self, point: SettlementPoint) {
        self.points.push(point);
    }
    
    /// Maximum settlement
    pub fn max_settlement(&self) -> (f64, &str) {
        let mut max_val = 0.0;
        let mut max_id = "";
        
        for point in &self.points {
            let s = point.current_settlement();
            if s > max_val {
                max_val = s;
                max_id = &point.point_id;
            }
        }
        
        (max_val, max_id)
    }
    
    /// Differential settlement between two points
    pub fn differential_settlement(&self, id1: &str, id2: &str) -> Option<f64> {
        let p1 = self.points.iter().find(|p| p.point_id == id1)?;
        let p2 = self.points.iter().find(|p| p.point_id == id2)?;
        
        Some((p1.current_settlement() - p2.current_settlement()).abs())
    }
    
    /// Angular distortion between two points
    pub fn angular_distortion(&self, id1: &str, id2: &str) -> Option<f64> {
        let p1 = self.points.iter().find(|p| p.point_id == id1)?;
        let p2 = self.points.iter().find(|p| p.point_id == id2)?;
        
        let diff = (p1.current_settlement() - p2.current_settlement()).abs();
        let dist = ((p2.x - p1.x).powi(2) + (p2.y - p1.y).powi(2)).sqrt() * 1000.0; // mm
        
        if dist > 0.0 {
            Some(diff / dist)
        } else {
            None
        }
    }
}

// ============================================================================
// MONITORING SYSTEM
// ============================================================================

/// Complete monitoring system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringSystem {
    /// Project name
    pub project_name: String,
    /// Sensors
    pub sensors: HashMap<String, Sensor>,
    /// Time series data
    pub time_series: HashMap<String, TimeSeries>,
    /// Active alerts
    pub alerts: Vec<Alert>,
}

/// Alert record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    /// Alert ID
    pub id: String,
    /// Sensor ID
    pub sensor_id: String,
    /// Alert level
    pub level: AlertLevel,
    /// Value that triggered alert
    pub value: f64,
    /// Threshold exceeded
    pub threshold: f64,
    /// Timestamp
    pub timestamp: u64,
    /// Acknowledged
    pub acknowledged: bool,
    /// Notes
    pub notes: String,
}

impl MonitoringSystem {
    pub fn new(project_name: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            sensors: HashMap::new(),
            time_series: HashMap::new(),
            alerts: Vec::new(),
        }
    }
    
    /// Add sensor
    pub fn add_sensor(&mut self, sensor: Sensor) {
        let id = sensor.id.clone();
        self.sensors.insert(id.clone(), sensor);
        self.time_series.insert(id.clone(), TimeSeries::new(&id));
    }
    
    /// Record reading
    pub fn record_reading(&mut self, sensor_id: &str, raw_value: f64, timestamp: u64) -> Option<Reading> {
        let sensor = self.sensors.get(sensor_id)?;
        let reading = Reading::new(sensor, raw_value, timestamp);
        
        // Check for alerts
        if matches!(reading.alert_level, AlertLevel::Warning | AlertLevel::Alarm) {
            let alert = Alert {
                id: format!("A{}", self.alerts.len() + 1),
                sensor_id: sensor_id.to_string(),
                level: reading.alert_level,
                value: reading.calibrated_value,
                threshold: if reading.alert_level == AlertLevel::Warning {
                    sensor.thresholds.0
                } else {
                    sensor.thresholds.1
                },
                timestamp,
                acknowledged: false,
                notes: String::new(),
            };
            self.alerts.push(alert);
        }
        
        // Store reading
        if let Some(ts) = self.time_series.get_mut(sensor_id) {
            ts.add_reading(reading.clone());
        }
        
        Some(reading)
    }
    
    /// Get sensor statistics
    pub fn sensor_stats(&self, sensor_id: &str) -> Option<TimeSeriesStats> {
        self.time_series.get(sensor_id).map(|ts| ts.statistics())
    }
    
    /// Get active alerts
    pub fn active_alerts(&self) -> Vec<&Alert> {
        self.alerts.iter()
            .filter(|a| !a.acknowledged)
            .collect()
    }
    
    /// System health summary
    pub fn health_summary(&self) -> MonitoringHealth {
        let total_sensors = self.sensors.len();
        let active_sensors = self.sensors.values().filter(|s| s.is_active).count();
        
        let alarm_count = self.alerts.iter()
            .filter(|a| !a.acknowledged && a.level == AlertLevel::Alarm)
            .count();
        let warning_count = self.alerts.iter()
            .filter(|a| !a.acknowledged && a.level == AlertLevel::Warning)
            .count();
        
        MonitoringHealth {
            total_sensors,
            active_sensors,
            alarm_count,
            warning_count,
            status: if alarm_count > 0 {
                "ALARM"
            } else if warning_count > 0 {
                "WARNING"
            } else {
                "NORMAL"
            }.to_string(),
        }
    }
}

/// Monitoring system health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringHealth {
    pub total_sensors: usize,
    pub active_sensors: usize,
    pub alarm_count: usize,
    pub warning_count: usize,
    pub status: String,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sensor_creation() {
        let sensor = Sensor::new("LC01", SensorType::LoadCell, "Column A1");
        
        assert_eq!(sensor.id, "LC01");
        assert_eq!(sensor.sensor_type.unit(), "kN");
    }

    #[test]
    fn test_sensor_thresholds() {
        let sensor = Sensor::new("LC01", SensorType::LoadCell, "Column A1")
            .with_thresholds(100.0, 150.0);
        
        assert_eq!(sensor.check_thresholds(50.0), AlertLevel::Normal);
        assert_eq!(sensor.check_thresholds(120.0), AlertLevel::Warning);
        assert_eq!(sensor.check_thresholds(180.0), AlertLevel::Alarm);
    }

    #[test]
    fn test_time_series_stats() {
        let mut ts = TimeSeries::new("S01");
        let sensor = Sensor::new("S01", SensorType::SettlementPoint, "Point 1");
        
        for (i, val) in [10.0, 12.0, 11.0, 13.0, 12.0].iter().enumerate() {
            ts.add_reading(Reading::new(&sensor, *val, i as u64 * 86400));
        }
        
        let stats = ts.statistics();
        assert_eq!(stats.count, 5);
        assert!((stats.mean - 11.6).abs() < 0.1);
    }

    #[test]
    fn test_time_series_trend() {
        let mut ts = TimeSeries::new("S01");
        let sensor = Sensor::new("S01", SensorType::SettlementPoint, "Point 1");
        
        for i in 0..5 {
            ts.add_reading(Reading::new(&sensor, i as f64 * 2.0, i as u64 * 86400));
        }
        
        let (slope, _) = ts.trend();
        assert!((slope - 2.0).abs() < 0.1);
    }

    #[test]
    fn test_inclinometer_profile() {
        let mut profile = InclinometerProfile::new("BH01", vec![0.0, 1.0, 2.0, 3.0, 4.0]);
        profile.set_deviations(
            vec![0.0, 3.0, 6.0, 4.0, 2.0],
            vec![0.0, 4.0, 8.0, 6.0, 3.0],
        );
        
        let (max_val, max_depth) = profile.max_displacement();
        assert!((max_depth - 2.0).abs() < 0.1);
        assert!(max_val > 9.0);
    }

    #[test]
    fn test_settlement_point() {
        let mut point = SettlementPoint::new("SP01", 0.0, 0.0, 100.0);
        
        point.add_reading(86400, 99.99);
        point.add_reading(86400 * 2, 99.97);
        
        let settlement = point.current_settlement();
        assert!((settlement - 30.0).abs() < 1.0);
    }

    #[test]
    fn test_settlement_rate() {
        let mut point = SettlementPoint::new("SP01", 0.0, 0.0, 100.0);
        
        point.add_reading(86400, 99.99);      // Day 1: 10mm
        point.add_reading(86400 * 2, 99.97);  // Day 2: 30mm
        
        let rate = point.settlement_rate();
        assert!((rate - 20.0).abs() < 1.0); // 20 mm/day
    }

    #[test]
    fn test_settlement_array() {
        let mut array = SettlementArray::new("Foundation");
        
        let mut p1 = SettlementPoint::new("SP01", 0.0, 0.0, 100.0);
        p1.add_reading(86400, 99.98); // 20mm settlement
        
        let mut p2 = SettlementPoint::new("SP02", 10.0, 0.0, 100.0);
        p2.add_reading(86400, 99.99); // 10mm settlement
        
        array.add_point(p1);
        array.add_point(p2);
        
        let diff = array.differential_settlement("SP01", "SP02").unwrap();
        assert!((diff - 10.0).abs() < 1.0);
    }

    #[test]
    fn test_angular_distortion() {
        let mut array = SettlementArray::new("Foundation");
        
        let mut p1 = SettlementPoint::new("SP01", 0.0, 0.0, 100.0);
        p1.add_reading(86400, 99.97); // 30mm
        
        let mut p2 = SettlementPoint::new("SP02", 10.0, 0.0, 100.0);
        p2.add_reading(86400, 99.99); // 10mm
        
        array.add_point(p1);
        array.add_point(p2);
        
        let distortion = array.angular_distortion("SP01", "SP02").unwrap();
        assert!((distortion - 0.002).abs() < 0.0005); // 20mm / 10000mm = 1/500
    }

    #[test]
    fn test_monitoring_system() {
        let mut system = MonitoringSystem::new("Test Project");
        
        let sensor = Sensor::new("LC01", SensorType::LoadCell, "Column A1")
            .with_thresholds(100.0, 150.0);
        system.add_sensor(sensor);
        
        system.record_reading("LC01", 50.0, 1000);
        system.record_reading("LC01", 120.0, 2000); // Warning
        
        let health = system.health_summary();
        assert_eq!(health.warning_count, 1);
    }

    #[test]
    fn test_moving_average() {
        let mut ts = TimeSeries::new("S01");
        let sensor = Sensor::new("S01", SensorType::SettlementPoint, "Point 1");
        
        for (i, val) in [10.0, 12.0, 14.0, 16.0, 18.0].iter().enumerate() {
            ts.add_reading(Reading::new(&sensor, *val, i as u64 * 86400));
        }
        
        let ma = ts.moving_average(3);
        assert_eq!(ma.len(), 3);
        assert!((ma[0] - 12.0).abs() < 0.1);
    }
}
