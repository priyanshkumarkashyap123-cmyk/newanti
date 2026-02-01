/**
 * ============================================================================
 * STRUCTURAL HEALTH MONITORING ENGINE
 * ============================================================================
 * 
 * Real-time and periodic structural health monitoring capabilities including:
 * - Sensor data processing
 * - Damage detection algorithms
 * - Modal parameter identification
 * - Structural condition assessment
 * - Predictive maintenance
 * 
 * Features:
 * - Vibration-based damage detection
 * - Strain and displacement monitoring
 * - Environmental effect correction
 * - Statistical pattern recognition
 * - Anomaly detection
 * - Remaining life estimation
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SensorData {
  sensorId: string;
  type: 'accelerometer' | 'strain-gauge' | 'displacement' | 'inclinometer' | 'temperature' | 'load-cell';
  location: { x: number; y: number; z: number };
  direction: 'X' | 'Y' | 'Z';
  data: TimeSeries;
  samplingRate: number; // Hz
  calibration?: {
    sensitivity: number;
    offset: number;
    units: string;
  };
}

export interface TimeSeries {
  timestamps: number[]; // Unix timestamps or indices
  values: number[];
}

export interface ModalParameters {
  frequency: number; // Hz
  damping: number; // Damping ratio
  modeShape: { nodeId: string; amplitude: number }[];
  mac?: number; // Modal Assurance Criterion (vs baseline)
}

export interface DamageIndicator {
  type: string;
  location: string;
  severity: number; // 0-1
  confidence: number; // 0-1
  description: string;
}

export interface HealthAssessment {
  overallCondition: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  conditionScore: number; // 0-100
  modalChanges: {
    mode: number;
    frequencyChange: number; // Percentage
    dampingChange: number;
  }[];
  damageIndicators: DamageIndicator[];
  anomalies: {
    timestamp: number;
    sensorId: string;
    type: string;
    severity: number;
  }[];
  recommendations: string[];
}

export interface BaselineModel {
  modalParameters: ModalParameters[];
  environmentalBaseline: {
    temperature: number;
    humidity: number;
    windSpeed: number;
  };
  statisticalProperties: {
    sensorId: string;
    mean: number;
    std: number;
    rms: number;
    peakValue: number;
  }[];
  timestamp: number;
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

export class SignalProcessor {
  /**
   * Apply Butterworth bandpass filter
   */
  static bandpassFilter(
    signal: number[],
    lowCut: number,
    highCut: number,
    samplingRate: number,
    order: number = 4
  ): number[] {
    // Simplified filter - in practice use proper digital filter design
    const nyquist = samplingRate / 2;
    const lowNorm = lowCut / nyquist;
    const highNorm = highCut / nyquist;

    // Apply moving average as simplified lowpass
    const windowSize = Math.round(samplingRate / highCut);
    let filtered = this.movingAverage(signal, windowSize);

    // Apply simple highpass by subtracting long-term trend
    const trendWindow = Math.round(samplingRate / lowCut);
    const trend = this.movingAverage(filtered, trendWindow);
    filtered = filtered.map((v, i) => v - trend[i]);

    return filtered;
  }

  /**
   * Apply moving average filter
   */
  static movingAverage(signal: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - halfWindow); j <= Math.min(signal.length - 1, i + halfWindow); j++) {
        sum += signal[j];
        count++;
      }
      result.push(sum / count);
    }

    return result;
  }

  /**
   * Remove linear trend from signal
   */
  static detrend(signal: number[]): number[] {
    const n = signal.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += signal[i];
      sumXY += i * signal[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return signal.map((v, i) => v - (slope * i + intercept));
  }

  /**
   * Calculate RMS value
   */
  static rms(signal: number[]): number {
    const sumSquares = signal.reduce((sum, v) => sum + v * v, 0);
    return Math.sqrt(sumSquares / signal.length);
  }

  /**
   * Calculate peak-to-peak value
   */
  static peakToPeak(signal: number[]): number {
    return Math.max(...signal) - Math.min(...signal);
  }

  /**
   * Calculate crest factor
   */
  static crestFactor(signal: number[]): number {
    const rms = this.rms(signal);
    const peak = Math.max(Math.abs(Math.max(...signal)), Math.abs(Math.min(...signal)));
    return peak / rms;
  }

  /**
   * Calculate kurtosis (peakedness indicator)
   */
  static kurtosis(signal: number[]): number {
    const n = signal.length;
    const mean = signal.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(signal.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n);

    const fourthMoment = signal.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / n;
    return fourthMoment - 3; // Excess kurtosis
  }
}

// ============================================================================
// FREQUENCY DOMAIN ANALYSIS
// ============================================================================

export class FrequencyAnalysis {
  /**
   * Compute FFT power spectrum
   */
  static computePowerSpectrum(
    signal: number[],
    samplingRate: number
  ): { frequency: number[]; power: number[] } {
    const n = signal.length;
    const frequencies: number[] = [];
    const power: number[] = [];

    // Simplified DFT (in practice use FFT)
    const nyquist = Math.floor(n / 2);
    
    for (let k = 0; k <= nyquist; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * k * t / n;
        real += signal[t] * Math.cos(angle);
        imag -= signal[t] * Math.sin(angle);
      }

      frequencies.push(k * samplingRate / n);
      power.push((real * real + imag * imag) / n);
    }

    return { frequency: frequencies, power };
  }

  /**
   * Find peak frequencies in spectrum
   */
  static findPeaks(
    spectrum: { frequency: number[]; power: number[] },
    numPeaks: number = 5,
    minSeparation: number = 0.5 // Hz
  ): { frequency: number; power: number; index: number }[] {
    const peaks: { frequency: number; power: number; index: number }[] = [];
    const { frequency, power } = spectrum;

    // Find local maxima
    for (let i = 1; i < power.length - 1; i++) {
      if (power[i] > power[i - 1] && power[i] > power[i + 1]) {
        // Check minimum separation from existing peaks
        const tooClose = peaks.some(p => Math.abs(frequency[i] - p.frequency) < minSeparation);
        if (!tooClose) {
          peaks.push({ frequency: frequency[i], power: power[i], index: i });
        }
      }
    }

    // Sort by power and take top N
    peaks.sort((a, b) => b.power - a.power);
    return peaks.slice(0, numPeaks);
  }

  /**
   * Estimate damping ratio using half-power bandwidth method
   */
  static estimateDamping(
    spectrum: { frequency: number[]; power: number[] },
    peakFrequency: number,
    peakPower: number
  ): number {
    const { frequency, power } = spectrum;
    const halfPower = peakPower / 2;

    // Find half-power points
    let f1 = peakFrequency;
    let f2 = peakFrequency;

    for (let i = 0; i < frequency.length; i++) {
      if (frequency[i] < peakFrequency && power[i] >= halfPower) {
        f1 = frequency[i];
      }
      if (frequency[i] > peakFrequency && power[i] >= halfPower && f2 === peakFrequency) {
        f2 = frequency[i];
        break;
      }
    }

    // Damping ratio
    return (f2 - f1) / (2 * peakFrequency);
  }
}

// ============================================================================
// MODAL IDENTIFICATION
// ============================================================================

export class ModalIdentifier {
  /**
   * Identify modal parameters from acceleration data
   */
  static identifyModes(
    sensorData: SensorData[],
    options: {
      frequencyRange: [number, number];
      numModes: number;
      dampingMethod: 'half-power' | 'log-decrement';
    }
  ): ModalParameters[] {
    const { frequencyRange, numModes, dampingMethod } = options;
    const modes: ModalParameters[] = [];

    // Combine data from all sensors
    const accelerometers = sensorData.filter(s => s.type === 'accelerometer');
    if (accelerometers.length === 0) return modes;

    // Compute average spectrum
    let combinedPower: number[] | null = null;
    let frequencies: number[] = [];

    for (const sensor of accelerometers) {
      const filtered = SignalProcessor.bandpassFilter(
        sensor.data.values,
        frequencyRange[0],
        frequencyRange[1],
        sensor.samplingRate
      );

      const spectrum = FrequencyAnalysis.computePowerSpectrum(filtered, sensor.samplingRate);
      
      if (!combinedPower) {
        combinedPower = spectrum.power;
        frequencies = spectrum.frequency;
      } else {
        for (let i = 0; i < spectrum.power.length; i++) {
          combinedPower[i] += spectrum.power[i];
        }
      }
    }

    if (!combinedPower) return modes;

    // Normalize
    combinedPower = combinedPower.map(p => p / accelerometers.length);

    // Find peaks
    const peaks = FrequencyAnalysis.findPeaks(
      { frequency: frequencies, power: combinedPower },
      numModes,
      0.5
    );

    // Extract mode shapes and damping
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      
      // Estimate damping
      const damping = dampingMethod === 'half-power' ?
        FrequencyAnalysis.estimateDamping(
          { frequency: frequencies, power: combinedPower },
          peak.frequency,
          peak.power
        ) : 0.02; // Default damping

      // Extract mode shape from individual sensors
      const modeShape: { nodeId: string; amplitude: number }[] = [];
      let maxAmplitude = 0;

      for (const sensor of accelerometers) {
        const spectrum = FrequencyAnalysis.computePowerSpectrum(
          sensor.data.values,
          sensor.samplingRate
        );
        
        const amplitude = spectrum.power[peak.index] || 0;
        maxAmplitude = Math.max(maxAmplitude, amplitude);
        
        modeShape.push({
          nodeId: sensor.sensorId,
          amplitude
        });
      }

      // Normalize mode shape
      for (const shape of modeShape) {
        shape.amplitude /= maxAmplitude;
      }

      modes.push({
        frequency: peak.frequency,
        damping,
        modeShape
      });
    }

    return modes;
  }

  /**
   * Calculate Modal Assurance Criterion (MAC)
   */
  static calculateMAC(
    mode1: ModalParameters,
    mode2: ModalParameters
  ): number {
    // Ensure same nodes
    const commonNodes = mode1.modeShape.filter(
      m1 => mode2.modeShape.some(m2 => m2.nodeId === m1.nodeId)
    );

    if (commonNodes.length === 0) return 0;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (const node of commonNodes) {
      const amp1 = node.amplitude;
      const amp2 = mode2.modeShape.find(m => m.nodeId === node.nodeId)?.amplitude || 0;

      numerator += amp1 * amp2;
      denom1 += amp1 * amp1;
      denom2 += amp2 * amp2;
    }

    return Math.pow(numerator, 2) / (denom1 * denom2);
  }
}

// ============================================================================
// DAMAGE DETECTION
// ============================================================================

export class DamageDetector {
  private baseline: BaselineModel;

  constructor(baseline: BaselineModel) {
    this.baseline = baseline;
  }

  /**
   * Detect damage using frequency shift
   */
  detectFrequencyShift(
    currentModes: ModalParameters[],
    threshold: number = 0.05 // 5% shift threshold
  ): DamageIndicator[] {
    const indicators: DamageIndicator[] = [];

    for (let i = 0; i < Math.min(currentModes.length, this.baseline.modalParameters.length); i++) {
      const baseFreq = this.baseline.modalParameters[i].frequency;
      const currentFreq = currentModes[i].frequency;
      
      const shift = (baseFreq - currentFreq) / baseFreq;

      if (Math.abs(shift) > threshold) {
        indicators.push({
          type: 'frequency-shift',
          location: 'global',
          severity: Math.min(1, Math.abs(shift) / 0.2), // Normalize to 0-1
          confidence: 0.7,
          description: `Mode ${i + 1} frequency shifted by ${(shift * 100).toFixed(1)}% ` +
                       `(from ${baseFreq.toFixed(2)} Hz to ${currentFreq.toFixed(2)} Hz)`
        });
      }
    }

    return indicators;
  }

  /**
   * Detect damage using mode shape change (MAC)
   */
  detectModeShapeChange(
    currentModes: ModalParameters[],
    macThreshold: number = 0.9
  ): DamageIndicator[] {
    const indicators: DamageIndicator[] = [];

    for (let i = 0; i < Math.min(currentModes.length, this.baseline.modalParameters.length); i++) {
      const mac = ModalIdentifier.calculateMAC(
        this.baseline.modalParameters[i],
        currentModes[i]
      );

      if (mac < macThreshold) {
        // Identify likely damage location from mode shape change
        const location = this.identifyDamageLocation(
          this.baseline.modalParameters[i].modeShape,
          currentModes[i].modeShape
        );

        indicators.push({
          type: 'mode-shape-change',
          location,
          severity: 1 - mac,
          confidence: 0.6,
          description: `Mode ${i + 1} shape changed significantly (MAC = ${mac.toFixed(3)})`
        });
      }
    }

    return indicators;
  }

  /**
   * Detect anomalies using statistical methods
   */
  detectStatisticalAnomalies(
    sensorData: SensorData[],
    numStd: number = 3
  ): DamageIndicator[] {
    const indicators: DamageIndicator[] = [];

    for (const sensor of sensorData) {
      const baseline = this.baseline.statisticalProperties.find(
        s => s.sensorId === sensor.sensorId
      );
      if (!baseline) continue;

      const currentRMS = SignalProcessor.rms(sensor.data.values);
      const currentPeak = Math.max(...sensor.data.values.map(Math.abs));

      // Check RMS deviation
      if (Math.abs(currentRMS - baseline.rms) > numStd * baseline.std) {
        indicators.push({
          type: 'rms-anomaly',
          location: sensor.sensorId,
          severity: Math.min(1, Math.abs(currentRMS - baseline.rms) / (3 * baseline.std)),
          confidence: 0.8,
          description: `Sensor ${sensor.sensorId}: RMS changed from ${baseline.rms.toFixed(4)} to ${currentRMS.toFixed(4)}`
        });
      }

      // Check peak deviation
      if (currentPeak > 1.5 * baseline.peakValue) {
        indicators.push({
          type: 'peak-anomaly',
          location: sensor.sensorId,
          severity: Math.min(1, (currentPeak - baseline.peakValue) / baseline.peakValue),
          confidence: 0.7,
          description: `Sensor ${sensor.sensorId}: Peak value ${currentPeak.toFixed(4)} exceeds baseline`
        });
      }

      // Check kurtosis (sudden impacts)
      const kurtosis = SignalProcessor.kurtosis(sensor.data.values);
      if (kurtosis > 5) {
        indicators.push({
          type: 'impact-detected',
          location: sensor.sensorId,
          severity: Math.min(1, (kurtosis - 3) / 10),
          confidence: 0.6,
          description: `Sensor ${sensor.sensorId}: High kurtosis (${kurtosis.toFixed(2)}) indicates impulsive loading`
        });
      }
    }

    return indicators;
  }

  /**
   * Apply environmental correction to frequencies
   */
  applyEnvironmentalCorrection(
    measuredFrequency: number,
    currentTemp: number,
    baselineTemp: number,
    tempCoefficient: number = -0.001 // Typical: -0.1% per °C
  ): number {
    const tempDiff = currentTemp - baselineTemp;
    const correction = 1 / (1 + tempCoefficient * tempDiff);
    return measuredFrequency * correction;
  }

  private identifyDamageLocation(
    baseShape: { nodeId: string; amplitude: number }[],
    currentShape: { nodeId: string; amplitude: number }[]
  ): string {
    let maxChange = 0;
    let location = 'unknown';

    for (const baseNode of baseShape) {
      const currentNode = currentShape.find(n => n.nodeId === baseNode.nodeId);
      if (!currentNode) continue;

      const change = Math.abs(currentNode.amplitude - baseNode.amplitude);
      if (change > maxChange) {
        maxChange = change;
        location = baseNode.nodeId;
      }
    }

    return location;
  }
}

// ============================================================================
// CONDITION ASSESSMENT
// ============================================================================

export class ConditionAssessor {
  private baseline: BaselineModel;
  private damageDetector: DamageDetector;

  constructor(baseline: BaselineModel) {
    this.baseline = baseline;
    this.damageDetector = new DamageDetector(baseline);
  }

  /**
   * Perform comprehensive health assessment
   */
  assess(
    sensorData: SensorData[],
    environmentalData: {
      temperature: number;
      humidity: number;
      windSpeed: number;
    }
  ): HealthAssessment {
    const recommendations: string[] = [];
    const anomalies: HealthAssessment['anomalies'] = [];

    // Identify current modal parameters
    const currentModes = ModalIdentifier.identifyModes(sensorData, {
      frequencyRange: [0.5, 20],
      numModes: 5,
      dampingMethod: 'half-power'
    });

    // Apply environmental correction
    const tempDiff = environmentalData.temperature - this.baseline.environmentalBaseline.temperature;
    for (const mode of currentModes) {
      mode.frequency = this.damageDetector.applyEnvironmentalCorrection(
        mode.frequency,
        environmentalData.temperature,
        this.baseline.environmentalBaseline.temperature
      );
    }

    // Detect various damage types
    const freqShiftDamage = this.damageDetector.detectFrequencyShift(currentModes);
    const modeShapeDamage = this.damageDetector.detectModeShapeChange(currentModes);
    const statisticalDamage = this.damageDetector.detectStatisticalAnomalies(sensorData);

    const allDamageIndicators = [...freqShiftDamage, ...modeShapeDamage, ...statisticalDamage];

    // Calculate modal changes
    const modalChanges: HealthAssessment['modalChanges'] = [];
    for (let i = 0; i < Math.min(currentModes.length, this.baseline.modalParameters.length); i++) {
      const baseFreq = this.baseline.modalParameters[i].frequency;
      const currentFreq = currentModes[i].frequency;
      const baseDamping = this.baseline.modalParameters[i].damping;
      const currentDamping = currentModes[i].damping;

      modalChanges.push({
        mode: i + 1,
        frequencyChange: ((currentFreq - baseFreq) / baseFreq) * 100,
        dampingChange: ((currentDamping - baseDamping) / baseDamping) * 100
      });
    }

    // Calculate condition score
    let conditionScore = 100;
    
    // Deduct for frequency shifts
    for (const change of modalChanges) {
      conditionScore -= Math.abs(change.frequencyChange) * 5;
    }

    // Deduct for damage indicators
    for (const indicator of allDamageIndicators) {
      conditionScore -= indicator.severity * 10 * indicator.confidence;
    }

    conditionScore = Math.max(0, Math.min(100, conditionScore));

    // Determine overall condition
    let overallCondition: HealthAssessment['overallCondition'];
    if (conditionScore >= 90) overallCondition = 'Excellent';
    else if (conditionScore >= 75) overallCondition = 'Good';
    else if (conditionScore >= 50) overallCondition = 'Fair';
    else if (conditionScore >= 25) overallCondition = 'Poor';
    else overallCondition = 'Critical';

    // Generate recommendations
    if (allDamageIndicators.length > 0) {
      recommendations.push('Visual inspection recommended at identified locations');
    }

    for (const indicator of allDamageIndicators) {
      if (indicator.severity > 0.5) {
        recommendations.push(`Investigate ${indicator.type} at ${indicator.location}`);
      }
    }

    if (Math.abs(tempDiff) > 20) {
      recommendations.push('Large temperature difference from baseline - verify environmental correction');
    }

    for (const change of modalChanges) {
      if (change.dampingChange > 50) {
        recommendations.push(`Mode ${change.mode}: Significant damping increase may indicate cracking`);
      }
    }

    if (overallCondition === 'Poor' || overallCondition === 'Critical') {
      recommendations.push('Comprehensive structural evaluation recommended');
      recommendations.push('Consider load restrictions until assessment complete');
    }

    return {
      overallCondition,
      conditionScore,
      modalChanges,
      damageIndicators: allDamageIndicators,
      anomalies,
      recommendations
    };
  }

  /**
   * Estimate remaining service life
   */
  estimateRemainingLife(
    historicalAssessments: HealthAssessment[],
    designLife: number = 50 // years
  ): {
    estimatedRemainingLife: number;
    degradationRate: number;
    confidence: number;
    projection: { year: number; score: number }[];
  } {
    if (historicalAssessments.length < 2) {
      return {
        estimatedRemainingLife: designLife * 0.5,
        degradationRate: 0,
        confidence: 0.1,
        projection: []
      };
    }

    // Calculate degradation rate from historical data
    const scores = historicalAssessments.map(a => a.conditionScore);
    const n = scores.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += scores[i];
      sumXY += i * scores[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // degradation rate per year (assuming annual assessments)
    const degradationRate = -slope;
    
    // Years until score reaches 50 (Fair/Poor threshold)
    const currentScore = scores[scores.length - 1];
    const yearsToThreshold = degradationRate > 0 ? (currentScore - 50) / degradationRate : designLife;

    // Projection
    const projection: { year: number; score: number }[] = [];
    for (let y = 0; y <= Math.min(30, yearsToThreshold + 5); y++) {
      const projectedScore = Math.max(0, currentScore - degradationRate * y);
      projection.push({ year: y, score: projectedScore });
    }

    // Confidence based on R² of linear fit
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    for (let i = 0; i < n; i++) {
      ssTotal += Math.pow(scores[i] - yMean, 2);
      ssResidual += Math.pow(scores[i] - (intercept + slope * i), 2);
    }
    const r2 = 1 - ssResidual / ssTotal;

    return {
      estimatedRemainingLife: Math.max(0, yearsToThreshold),
      degradationRate,
      confidence: Math.max(0.1, r2),
      projection
    };
  }
}

// ============================================================================
// ALERT SYSTEM
// ============================================================================

export class AlertSystem {
  private thresholds: {
    rmsMultiplier: number;
    frequencyShift: number;
    macLimit: number;
    peakMultiplier: number;
  };

  constructor(thresholds?: Partial<AlertSystem['thresholds']>) {
    this.thresholds = {
      rmsMultiplier: 3,
      frequencyShift: 0.1,
      macLimit: 0.8,
      peakMultiplier: 2,
      ...thresholds
    };
  }

  /**
   * Check for alert conditions
   */
  checkAlerts(
    assessment: HealthAssessment
  ): {
    level: 'info' | 'warning' | 'critical';
    alerts: {
      type: string;
      message: string;
      timestamp: number;
    }[];
  }[] {
    const alerts: {
      level: 'info' | 'warning' | 'critical';
      alerts: { type: string; message: string; timestamp: number }[];
    }[] = [];

    const timestamp = Date.now();

    // Critical alerts
    if (assessment.overallCondition === 'Critical') {
      alerts.push({
        level: 'critical',
        alerts: [{
          type: 'condition',
          message: 'Structure in CRITICAL condition - immediate action required',
          timestamp
        }]
      });
    }

    // Warning alerts from damage indicators
    const severeIndicators = assessment.damageIndicators.filter(d => d.severity > 0.6);
    if (severeIndicators.length > 0) {
      alerts.push({
        level: 'warning',
        alerts: severeIndicators.map(ind => ({
          type: ind.type,
          message: ind.description,
          timestamp
        }))
      });
    }

    // Modal change alerts
    for (const change of assessment.modalChanges) {
      if (Math.abs(change.frequencyChange) > this.thresholds.frequencyShift * 100) {
        alerts.push({
          level: change.frequencyChange > 20 ? 'critical' : 'warning',
          alerts: [{
            type: 'frequency-change',
            message: `Mode ${change.mode} frequency changed by ${change.frequencyChange.toFixed(1)}%`,
            timestamp
          }]
        });
      }
    }

    // Info alerts for anomalies
    if (assessment.anomalies.length > 0) {
      alerts.push({
        level: 'info',
        alerts: assessment.anomalies.map(a => ({
          type: a.type,
          message: `Anomaly detected at sensor ${a.sensorId}`,
          timestamp: a.timestamp
        }))
      });
    }

    return alerts;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SignalProcessor,
  FrequencyAnalysis,
  ModalIdentifier,
  DamageDetector,
  ConditionAssessor,
  AlertSystem
};
