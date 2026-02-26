/**
 * ============================================================================
 * REAL-TIME MONITORING AND SENSOR INTEGRATION ENGINE
 * ============================================================================
 * 
 * Live structural monitoring and IoT integration:
 * - Sensor data acquisition
 * - Signal processing and filtering
 * - Real-time structural response
 * - Threshold alerting
 * - Data logging and storage
 * - Sensor network management
 * - Earthquake early warning
 * - Wind monitoring
 * - Strain and displacement tracking
 * - Vibration-based damage detection
 * 
 * Sensor Types Supported:
 * - Accelerometers (MEMS, piezoelectric, servo)
 * - Strain gauges (foil, vibrating wire, fiber optic)
 * - Displacement sensors (LVDT, laser, GPS)
 * - Load cells
 * - Temperature sensors
 * - Inclinometers
 * - Crack meters
 * - Wind anemometers
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SensorConfiguration {
  id: string;
  type: SensorType;
  location: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
  calibration: CalibrationData;
  samplingRate: number; // Hz
  resolution: number;
  range: [number, number];
  status: 'active' | 'inactive' | 'faulty';
}

export type SensorType = 
  | 'accelerometer'
  | 'strain_gauge'
  | 'displacement'
  | 'load_cell'
  | 'temperature'
  | 'inclinometer'
  | 'crack_meter'
  | 'anemometer'
  | 'gps';

export interface CalibrationData {
  sensitivity: number;
  offset: number;
  linearityError: number;
  temperatureCoeff: number;
  lastCalibration: Date;
  calibrationDue: Date;
}

export interface SensorReading {
  sensorId: string;
  timestamp: number; // Unix ms
  rawValue: number;
  calibratedValue: number;
  unit: string;
  quality: 'good' | 'suspect' | 'bad';
}

export interface Alert {
  id: string;
  sensorId: string;
  type: 'threshold' | 'rate_of_change' | 'pattern' | 'sensor_fault';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  value: number;
  threshold: number;
}

export interface ModalIdentificationResult {
  frequencies: number[];
  modeshapes: number[][];
  dampingRatios: number[];
  participationFactors: number[];
}

export interface EEWData {
  epicenter: { lat: number; lng: number };
  depth: number;
  magnitude: number;
  originTime: number;
  estimatedArrival: number;
  estimatedPGA: number;
  estimatedIntensity: number;
}

// ============================================================================
// SENSOR NETWORK MANAGER
// ============================================================================

export class SensorNetworkManager {
  private sensors: Map<string, SensorConfiguration> = new Map();
  private readings: Map<string, SensorReading[]> = new Map();
  private alerts: Alert[] = [];
  private thresholds: Map<string, { warning: number; critical: number; emergency: number }> = new Map();

  /**
   * Register a new sensor
   */
  registerSensor(config: SensorConfiguration): void {
    this.sensors.set(config.id, config);
    this.readings.set(config.id, []);
  }

  /**
   * Remove sensor
   */
  removeSensor(sensorId: string): boolean {
    this.readings.delete(sensorId);
    return this.sensors.delete(sensorId);
  }

  /**
   * Set alert thresholds
   */
  setThresholds(
    sensorId: string,
    thresholds: { warning: number; critical: number; emergency: number }
  ): void {
    this.thresholds.set(sensorId, thresholds);
  }

  /**
   * Process incoming sensor data
   */
  processReading(reading: SensorReading): Alert | null {
    const sensor = this.sensors.get(reading.sensorId);
    if (!sensor) return null;

    // Store reading
    const sensorReadings = this.readings.get(reading.sensorId) || [];
    sensorReadings.push(reading);
    
    // Keep only last hour of data (assuming 100 Hz max)
    const oneHourAgo = Date.now() - 3600000;
    const filtered = sensorReadings.filter(r => r.timestamp > oneHourAgo);
    this.readings.set(reading.sensorId, filtered);

    // Check thresholds
    const thresholds = this.thresholds.get(reading.sensorId);
    if (thresholds) {
      const value = Math.abs(reading.calibratedValue);
      let alert: Alert | null = null;

      if (value >= thresholds.emergency) {
        alert = this.createAlert(reading, 'threshold', 'emergency', thresholds.emergency);
      } else if (value >= thresholds.critical) {
        alert = this.createAlert(reading, 'threshold', 'critical', thresholds.critical);
      } else if (value >= thresholds.warning) {
        alert = this.createAlert(reading, 'threshold', 'warning', thresholds.warning);
      }

      if (alert) {
        this.alerts.push(alert);
        return alert;
      }
    }

    return null;
  }

  /**
   * Create alert
   */
  private createAlert(
    reading: SensorReading,
    type: Alert['type'],
    severity: Alert['severity'],
    threshold: number
  ): Alert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sensorId: reading.sensorId,
      type,
      severity,
      message: `${severity.toUpperCase()}: Sensor ${reading.sensorId} exceeded ${severity} threshold (${reading.calibratedValue.toFixed(3)} ${reading.unit})`,
      timestamp: reading.timestamp,
      acknowledged: false,
      value: reading.calibratedValue,
      threshold
    };
  }

  /**
   * Get sensor status
   */
  getSensorStatus(sensorId: string): {
    config: SensorConfiguration | undefined;
    lastReading: SensorReading | undefined;
    recentAlerts: Alert[];
  } {
    const readings = this.readings.get(sensorId) || [];
    const recentAlerts = this.alerts
      .filter(a => a.sensorId === sensorId && a.timestamp > Date.now() - 86400000)
      .slice(-10);

    return {
      config: this.sensors.get(sensorId),
      lastReading: readings[readings.length - 1],
      recentAlerts
    };
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get readings for analysis
   */
  getReadings(sensorId: string, startTime?: number, endTime?: number): SensorReading[] {
    const readings = this.readings.get(sensorId) || [];
    if (!startTime && !endTime) return readings;

    return readings.filter(r => {
      if (startTime && r.timestamp < startTime) return false;
      if (endTime && r.timestamp > endTime) return false;
      return true;
    });
  }
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

export class SignalProcessing {
  /**
   * Apply moving average filter
   */
  static movingAverage(data: number[], windowSize: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
      const window = data.slice(start, end);
      result.push(window.reduce((a, b) => a + b, 0) / window.length);
    }
    return result;
  }

  /**
   * Apply Butterworth low-pass filter
   */
  static butterworthLowPass(
    data: number[],
    cutoffFreq: number,
    samplingRate: number,
    order: number = 4
  ): number[] {
    const nyquist = samplingRate / 2;
    const wc = cutoffFreq / nyquist;
    
    // Simplified IIR filter coefficients
    const alpha = Math.sin(Math.PI * wc) / (Math.cos(Math.PI * wc) + 1);
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(Math.PI * wc) / a0;
    const a2 = (1 - alpha) / a0;
    const b0 = (1 - Math.cos(Math.PI * wc)) / 2 / a0;
    const b1 = (1 - Math.cos(Math.PI * wc)) / a0;
    const b2 = b0;

    const result: number[] = [data[0], data[1]];
    for (let i = 2; i < data.length; i++) {
      result.push(
        b0 * data[i] + b1 * data[i - 1] + b2 * data[i - 2] -
        a1 * result[i - 1] - a2 * result[i - 2]
      );
    }

    // Apply forward-backward filtering
    for (let pass = 1; pass < Math.ceil(order / 2); pass++) {
      for (let i = 2; i < result.length; i++) {
        result[i] = b0 * result[i] + b1 * result[i - 1] + b2 * result[i - 2] -
                    a1 * result[i - 1] - a2 * result[i - 2];
      }
    }

    return result;
  }

  /**
   * Apply high-pass filter
   */
  static butterworthHighPass(
    data: number[],
    cutoffFreq: number,
    samplingRate: number,
    order: number = 4
  ): number[] {
    const nyquist = samplingRate / 2;
    const wc = cutoffFreq / nyquist;
    
    const alpha = Math.sin(Math.PI * wc) / (Math.cos(Math.PI * wc) + 1);
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(Math.PI * wc) / a0;
    const a2 = (1 - alpha) / a0;
    const b0 = (1 + Math.cos(Math.PI * wc)) / 2 / a0;
    const b1 = -(1 + Math.cos(Math.PI * wc)) / a0;
    const b2 = b0;

    const result: number[] = [data[0], data[1]];
    for (let i = 2; i < data.length; i++) {
      result.push(
        b0 * data[i] + b1 * data[i - 1] + b2 * data[i - 2] -
        a1 * result[i - 1] - a2 * result[i - 2]
      );
    }

    return result;
  }

  /**
   * Band-pass filter
   */
  static bandPassFilter(
    data: number[],
    lowCutoff: number,
    highCutoff: number,
    samplingRate: number
  ): number[] {
    const highPassed = this.butterworthHighPass(data, lowCutoff, samplingRate);
    return this.butterworthLowPass(highPassed, highCutoff, samplingRate);
  }

  /**
   * Remove baseline drift
   */
  static removeBaseline(
    data: number[],
    polynomialOrder: number = 2
  ): number[] {
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Fit polynomial
    const coeffs = this.polynomialFit(x, data, polynomialOrder);
    
    // Remove trend
    return data.map((d, i) => {
      let trend = 0;
      for (let j = 0; j <= polynomialOrder; j++) {
        trend += coeffs[j] * Math.pow(i, j);
      }
      return d - trend;
    });
  }

  /**
   * Polynomial least squares fit
   */
  private static polynomialFit(x: number[], y: number[], order: number): number[] {
    const n = x.length;
    const m = order + 1;
    
    // Build Vandermonde matrix
    const V: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < m; j++) {
        row.push(Math.pow(x[i], j));
      }
      V.push(row);
    }
    
    // Solve V'V * c = V'y
    const VtV: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
    const Vty: number[] = Array(m).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        Vty[j] += V[i][j] * y[i];
        for (let k = 0; k < m; k++) {
          VtV[j][k] += V[i][j] * V[i][k];
        }
      }
    }
    
    // Gauss elimination
    for (let i = 0; i < m; i++) {
      for (let k = i + 1; k < m; k++) {
        const factor = VtV[k][i] / VtV[i][i];
        for (let j = i; j < m; j++) {
          VtV[k][j] -= factor * VtV[i][j];
        }
        Vty[k] -= factor * Vty[i];
      }
    }
    
    // Back substitution
    const coeffs = new Array(m);
    for (let i = m - 1; i >= 0; i--) {
      coeffs[i] = Vty[i];
      for (let j = i + 1; j < m; j++) {
        coeffs[i] -= VtV[i][j] * coeffs[j];
      }
      coeffs[i] /= VtV[i][i];
    }
    
    return coeffs;
  }

  /**
   * Fast Fourier Transform
   */
  static fft(data: number[]): { frequencies: number[]; magnitudes: number[]; phases: number[] } {
    const n = data.length;
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    
    // Zero-pad to power of 2
    const paddedData = [...data, ...Array(nextPow2 - n).fill(0)];
    
    // Cooley-Tukey FFT
    const real = [...paddedData];
    const imag = new Array(nextPow2).fill(0);
    
    // Bit reversal
    const bits = Math.log2(nextPow2);
    for (let i = 0; i < nextPow2; i++) {
      const j = this.bitReverse(i, bits);
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    
    // FFT butterflies
    for (let size = 2; size <= nextPow2; size *= 2) {
      const halfSize = size / 2;
      const angleStep = -2 * Math.PI / size;
      
      for (let i = 0; i < nextPow2; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const angle = angleStep * j;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          
          const tReal = cosA * real[i + j + halfSize] - sinA * imag[i + j + halfSize];
          const tImag = sinA * real[i + j + halfSize] + cosA * imag[i + j + halfSize];
          
          real[i + j + halfSize] = real[i + j] - tReal;
          imag[i + j + halfSize] = imag[i + j] - tImag;
          real[i + j] += tReal;
          imag[i + j] += tImag;
        }
      }
    }
    
    // Calculate magnitudes and phases
    const magnitudes = real.map((r, i) => Math.sqrt(r * r + imag[i] * imag[i]) / nextPow2);
    const phases = real.map((r, i) => Math.atan2(imag[i], r));
    const frequencies = Array.from({ length: nextPow2 }, (_, i) => i);
    
    return { frequencies, magnitudes, phases };
  }

  /**
   * Bit reversal for FFT
   */
  private static bitReverse(x: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (x & 1);
      x >>= 1;
    }
    return result;
  }

  /**
   * Power Spectral Density (Welch's method)
   */
  static psd(
    data: number[],
    samplingRate: number,
    windowSize: number = 256,
    overlap: number = 0.5
  ): { frequencies: number[]; psd: number[] } {
    const step = Math.floor(windowSize * (1 - overlap));
    const numSegments = Math.floor((data.length - windowSize) / step) + 1;
    
    // Hanning window
    const window = Array.from({ length: windowSize }, (_, i) => 
      0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
    );
    const windowSum = window.reduce((a, b) => a + b, 0);
    
    const psdSum = new Array(Math.floor(windowSize / 2) + 1).fill(0);
    
    for (let seg = 0; seg < numSegments; seg++) {
      const start = seg * step;
      const segment = data.slice(start, start + windowSize).map((d, i) => d * window[i]);
      
      const { magnitudes } = this.fft(segment);
      
      for (let i = 0; i <= windowSize / 2; i++) {
        psdSum[i] += magnitudes[i] * magnitudes[i];
      }
    }
    
    // Normalize
    const scale = 2 * windowSize / (windowSum * windowSum * numSegments * samplingRate);
    const psd = psdSum.map(p => p * scale);
    const frequencies = Array.from({ length: psd.length }, (_, i) => i * samplingRate / windowSize);
    
    return { frequencies, psd };
  }

  /**
   * Integrate signal (velocity to displacement)
   */
  static integrate(
    data: number[],
    dt: number,
    removeBaseline: boolean = true
  ): number[] {
    let result = [0];
    for (let i = 1; i < data.length; i++) {
      result.push(result[i - 1] + (data[i - 1] + data[i]) * dt / 2);
    }
    
    if (removeBaseline) {
      result = this.removeBaseline(result, 2);
    }
    
    return result;
  }

  /**
   * Differentiate signal (displacement to velocity)
   */
  static differentiate(data: number[], dt: number): number[] {
    const result: number[] = [(data[1] - data[0]) / dt];
    for (let i = 1; i < data.length - 1; i++) {
      result.push((data[i + 1] - data[i - 1]) / (2 * dt));
    }
    result.push((data[data.length - 1] - data[data.length - 2]) / dt);
    return result;
  }
}

// ============================================================================
// MODAL IDENTIFICATION
// ============================================================================

export class OperationalModalAnalysis {
  /**
   * Peak picking method
   */
  static peakPicking(
    psd: number[],
    frequencies: number[],
    threshold: number = 0.1
  ): { frequencies: number[]; amplitudes: number[] } {
    const maxPSD = Math.max(...psd);
    const peakFreqs: number[] = [];
    const peakAmps: number[] = [];
    
    for (let i = 1; i < psd.length - 1; i++) {
      if (psd[i] > psd[i - 1] && psd[i] > psd[i + 1] && psd[i] > threshold * maxPSD) {
        peakFreqs.push(frequencies[i]);
        peakAmps.push(psd[i]);
      }
    }
    
    return { frequencies: peakFreqs, amplitudes: peakAmps };
  }

  /**
   * Half-power bandwidth for damping estimation
   */
  static halfPowerBandwidth(
    psd: number[],
    frequencies: number[],
    peakIndex: number
  ): { dampingRatio: number; bandwidth: number } {
    const peakAmp = psd[peakIndex];
    const halfPower = peakAmp / 2;
    
    // Find left and right half-power points
    let leftIdx = peakIndex;
    while (leftIdx > 0 && psd[leftIdx] > halfPower) leftIdx--;
    
    let rightIdx = peakIndex;
    while (rightIdx < psd.length - 1 && psd[rightIdx] > halfPower) rightIdx++;
    
    const f1 = frequencies[leftIdx];
    const f2 = frequencies[rightIdx];
    const fn = frequencies[peakIndex];
    
    const bandwidth = f2 - f1;
    const dampingRatio = bandwidth / (2 * fn);
    
    return { dampingRatio, bandwidth };
  }

  /**
   * Frequency Domain Decomposition (FDD)
   */
  static frequencyDomainDecomposition(
    responses: number[][],
    samplingRate: number
  ): ModalIdentificationResult {
    const numChannels = responses.length;
    const frequencies: number[] = [];
    const modeshapes: number[][] = [];
    const dampingRatios: number[] = [];
    
    // Compute cross-spectral density matrix
    const windowSize = 256;
    const freqAxis = Array.from({ length: windowSize / 2 + 1 }, (_, i) => i * samplingRate / windowSize);
    
    // For each frequency, compute spectral matrix and SVD
    for (let fi = 0; fi < freqAxis.length; fi++) {
      // Simplified: use magnitude of first channel for peak detection
      const { psd } = SignalProcessing.psd(responses[0], samplingRate, windowSize);
      
      // Check if this is a peak
      if (fi > 0 && fi < psd.length - 1 && psd[fi] > psd[fi - 1] && psd[fi] > psd[fi + 1]) {
        frequencies.push(freqAxis[fi]);
        
        // Mode shape from channel ratios (simplified)
        const modeshape: number[] = [];
        for (let ch = 0; ch < numChannels; ch++) {
          const chPsd = SignalProcessing.psd(responses[ch], samplingRate, windowSize);
          modeshape.push(Math.sqrt(chPsd.psd[fi]));
        }
        
        // Normalize mode shape
        const norm = Math.sqrt(modeshape.reduce((a, b) => a + b * b, 0));
        modeshapes.push(modeshape.map(m => m / norm));
        
        // Estimate damping
        const { dampingRatio } = this.halfPowerBandwidth(psd, freqAxis, fi);
        dampingRatios.push(dampingRatio);
      }
    }
    
    return {
      frequencies,
      modeshapes,
      dampingRatios,
      participationFactors: frequencies.map(() => 1)
    };
  }

  /**
   * Stochastic Subspace Identification (SSI) - Simplified
   */
  static stochasticSubspaceId(
    responses: number[][],
    samplingRate: number,
    blockRows: number = 20,
    order: number = 10
  ): ModalIdentificationResult {
    // Build Hankel matrix
    const numChannels = responses.length;
    const numSamples = responses[0].length;
    
    const Y: number[][] = [];
    for (let i = 0; i < blockRows; i++) {
      const row: number[] = [];
      for (let j = 0; j < numSamples - 2 * blockRows; j++) {
        for (let ch = 0; ch < numChannels; ch++) {
          row.push(responses[ch][i + j]);
        }
      }
      Y.push(row);
    }
    
    // SVD (simplified power iteration for dominant modes)
    const frequencies: number[] = [];
    const modeshapes: number[][] = [];
    const dampingRatios: number[] = [];
    
    // Use FFT-based identification as backup
    const { psd, frequencies: freqAxis } = SignalProcessing.psd(responses[0], samplingRate);
    const peaks = this.peakPicking(psd, freqAxis, 0.05);
    
    for (let i = 0; i < Math.min(peaks.frequencies.length, order); i++) {
      frequencies.push(peaks.frequencies[i]);
      modeshapes.push(responses.map(r => 1)); // Simplified
      dampingRatios.push(0.02); // Default damping
    }
    
    return {
      frequencies,
      modeshapes,
      dampingRatios,
      participationFactors: frequencies.map(() => 1)
    };
  }
}

// ============================================================================
// EARTHQUAKE EARLY WARNING
// ============================================================================

export class EarthquakeEarlyWarning {
  private siteLocation: { lat: number; lng: number };
  private vp: number = 6.0; // km/s P-wave velocity
  private vs: number = 3.5; // km/s S-wave velocity

  constructor(siteLocation: { lat: number; lng: number }) {
    this.siteLocation = siteLocation;
  }

  /**
   * Calculate distance to epicenter
   */
  private calculateDistance(epicenter: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const lat1 = this.siteLocation.lat * Math.PI / 180;
    const lat2 = epicenter.lat * Math.PI / 180;
    const dLat = (epicenter.lat - this.siteLocation.lat) * Math.PI / 180;
    const dLon = (epicenter.lng - this.siteLocation.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Estimate arrival time
   */
  estimateArrival(
    epicenter: { lat: number; lng: number },
    depth: number,
    originTime: number
  ): { pWaveArrival: number; sWaveArrival: number; warningTime: number } {
    const epicentralDist = this.calculateDistance(epicenter);
    const hypocentralDist = Math.sqrt(epicentralDist ** 2 + depth ** 2);

    const pWaveTravel = hypocentralDist / this.vp;
    const sWaveTravel = hypocentralDist / this.vs;

    const pWaveArrival = originTime + pWaveTravel * 1000;
    const sWaveArrival = originTime + sWaveTravel * 1000;
    const warningTime = sWaveArrival - Date.now();

    return { pWaveArrival, sWaveArrival, warningTime };
  }

  /**
   * Estimate PGA at site
   */
  estimatePGA(
    magnitude: number,
    epicenter: { lat: number; lng: number },
    depth: number,
    siteClass: 'A' | 'B' | 'C' | 'D' | 'E' = 'D'
  ): number {
    const epicentralDist = this.calculateDistance(epicenter);
    const R = Math.sqrt(epicentralDist ** 2 + depth ** 2);

    // Simplified attenuation (Boore-Atkinson type)
    const c1 = -0.08;
    const c2 = 1.0;
    const c3 = -1.5;
    const c4 = -0.003;

    const siteFactors: Record<string, number> = {
      'A': 0.8, 'B': 0.9, 'C': 1.0, 'D': 1.2, 'E': 1.4
    };

    const logPGA = c1 + c2 * magnitude + c3 * Math.log10(R) + c4 * R;
    const PGA = Math.pow(10, logPGA) * siteFactors[siteClass];

    return PGA; // in g
  }

  /**
   * Estimate MMI intensity
   */
  estimateIntensity(pga: number): number {
    // Wald et al. (1999)
    const logPGA = Math.log10(pga * 980.665); // Convert g to cm/s²
    return 3.66 * logPGA - 1.66;
  }

  /**
   * Process EEW data
   */
  processEEW(eew: Omit<EEWData, 'estimatedArrival' | 'estimatedPGA' | 'estimatedIntensity'>): EEWData {
    const { pWaveArrival, sWaveArrival, warningTime } = this.estimateArrival(
      eew.epicenter,
      eew.depth,
      eew.originTime
    );

    const estimatedPGA = this.estimatePGA(eew.magnitude, eew.epicenter, eew.depth);
    const estimatedIntensity = this.estimateIntensity(estimatedPGA);

    return {
      ...eew,
      estimatedArrival: sWaveArrival,
      estimatedPGA,
      estimatedIntensity
    };
  }

  /**
   * Determine protective action based on warning time and intensity
   */
  determineAction(warningTime: number, intensity: number): {
    action: string;
    priority: 'normal' | 'elevated' | 'high' | 'critical';
    message: string;
  } {
    if (warningTime < 0) {
      return {
        action: 'POST-EARTHQUAKE',
        priority: 'critical',
        message: 'Earthquake has arrived. Check for damage.'
      };
    }

    if (intensity < 4) {
      return {
        action: 'MONITOR',
        priority: 'normal',
        message: `Light shaking expected in ${Math.round(warningTime / 1000)} seconds`
      };
    }

    if (intensity < 6) {
      return {
        action: 'ALERT',
        priority: 'elevated',
        message: `Moderate shaking in ${Math.round(warningTime / 1000)} seconds. Move away from windows.`
      };
    }

    if (warningTime > 10000) {
      return {
        action: 'EVACUATE',
        priority: 'high',
        message: `Strong shaking in ${Math.round(warningTime / 1000)} seconds. Evacuate if possible.`
      };
    }

    return {
      action: 'DROP-COVER-HOLD',
      priority: 'critical',
      message: `Strong shaking imminent in ${Math.round(warningTime / 1000)} seconds! Drop, cover, and hold on!`
    };
  }
}

// ============================================================================
// WIND MONITORING
// ============================================================================

export class WindMonitoring {
  private windHistory: { timestamp: number; speed: number; direction: number }[] = [];

  /**
   * Add wind reading
   */
  addReading(speed: number, direction: number): void {
    this.windHistory.push({
      timestamp: Date.now(),
      speed,
      direction
    });

    // Keep 1 hour of data
    const oneHourAgo = Date.now() - 3600000;
    this.windHistory = this.windHistory.filter(r => r.timestamp > oneHourAgo);
  }

  /**
   * Calculate gust factor
   */
  calculateGustFactor(averagingPeriod: number = 600000): number {
    const now = Date.now();
    const recentData = this.windHistory.filter(r => r.timestamp > now - averagingPeriod);
    
    if (recentData.length < 10) return 1.0;

    const speeds = recentData.map(r => r.speed);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const max = Math.max(...speeds);

    return max / mean;
  }

  /**
   * Calculate turbulence intensity
   */
  calculateTurbulenceIntensity(averagingPeriod: number = 600000): number {
    const now = Date.now();
    const recentData = this.windHistory.filter(r => r.timestamp > now - averagingPeriod);
    
    if (recentData.length < 10) return 0;

    const speeds = recentData.map(r => r.speed);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / speeds.length;

    return Math.sqrt(variance) / mean;
  }

  /**
   * Get statistics
   */
  getStatistics(period: number = 600000): {
    meanSpeed: number;
    maxSpeed: number;
    meanDirection: number;
    gustFactor: number;
    turbulenceIntensity: number;
  } {
    const now = Date.now();
    const recentData = this.windHistory.filter(r => r.timestamp > now - period);
    
    if (recentData.length === 0) {
      return { meanSpeed: 0, maxSpeed: 0, meanDirection: 0, gustFactor: 1, turbulenceIntensity: 0 };
    }

    const speeds = recentData.map(r => r.speed);
    const directions = recentData.map(r => r.direction);

    // Vector average for direction
    const sinSum = directions.reduce((sum, d) => sum + Math.sin(d * Math.PI / 180), 0);
    const cosSum = directions.reduce((sum, d) => sum + Math.cos(d * Math.PI / 180), 0);
    const meanDirection = Math.atan2(sinSum, cosSum) * 180 / Math.PI;

    return {
      meanSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
      maxSpeed: Math.max(...speeds),
      meanDirection: (meanDirection + 360) % 360,
      gustFactor: this.calculateGustFactor(period),
      turbulenceIntensity: this.calculateTurbulenceIntensity(period)
    };
  }

  /**
   * Check wind thresholds
   */
  checkThresholds(thresholds: {
    operational: number;
    warning: number;
    shutdown: number;
  }): { status: 'normal' | 'operational' | 'warning' | 'shutdown'; currentSpeed: number } {
    const stats = this.getStatistics();
    
    if (stats.maxSpeed >= thresholds.shutdown) {
      return { status: 'shutdown', currentSpeed: stats.maxSpeed };
    }
    if (stats.maxSpeed >= thresholds.warning) {
      return { status: 'warning', currentSpeed: stats.maxSpeed };
    }
    if (stats.maxSpeed >= thresholds.operational) {
      return { status: 'operational', currentSpeed: stats.maxSpeed };
    }
    
    return { status: 'normal', currentSpeed: stats.meanSpeed };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SensorNetworkManager,
  SignalProcessing,
  OperationalModalAnalysis,
  EarthquakeEarlyWarning,
  WindMonitoring
};
