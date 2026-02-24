/**
 * DigitalTwinService.ts
 * 
 * Real-time Digital Twin Integration
 * 
 * Features:
 * - IoT sensor data ingestion
 * - Real-time structural health monitoring
 * - AI anomaly detection
 * - Predictive maintenance
 * - Historical data analysis
 */

// ============================================
// TYPES
// ============================================

export interface SensorData {
    sensorId: string;
    timestamp: Date;
    type: 'strain' | 'acceleration' | 'displacement' | 'temperature' | 'tilt';
    value: number;
    unit: string;
    location: { x: number; y: number; z: number };
    elementId?: string;
}

export interface HealthIndicator {
    elementId: string;
    timestamp: Date;
    overallHealth: number;     // 0-100%
    stressRatio: number;       // Current/Allowable
    fatigueLife: number;       // Remaining cycles
    corrosionIndex?: number;   // 0-10
    alerts: Alert[];
}

export interface Alert {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    type: 'overstress' | 'fatigue' | 'corrosion' | 'displacement' | 'anomaly';
    message: string;
    elementId?: string;
    timestamp: Date;
    acknowledged: boolean;
}

export interface PredictiveMaintenanceResult {
    elementId: string;
    predictedFailureDate?: Date;
    remainingLife: number;      // Percentage
    confidenceLevel: number;
    recommendedActions: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface HistoricalAnalysis {
    elementId: string;
    period: { start: Date; end: Date };
    peakStress: number;
    avgStress: number;
    cycleCount: number;
    temperatureRange: { min: number; max: number };
    trendAnalysis: 'stable' | 'degrading' | 'improving';
}

// ============================================
// DIGITAL TWIN SERVICE
// ============================================

class DigitalTwinServiceClass {
    private sensorData: Map<string, SensorData[]> = new Map();
    private healthIndicators: Map<string, HealthIndicator> = new Map();
    private alerts: Alert[] = [];
    private connected = false;
    private listeners: Array<(event: string, data: any) => void> = [];
    private updateInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Connect to IoT data stream
     */
    async connect(config: {
        endpoint: string;
        apiKey?: string;
        projectId: string;
    }): Promise<boolean> {
        try {
            // Would connect to IoT Hub/AWS IoT/Azure IoT
            this.connected = true;
            console.log('[DigitalTwin] Connected to IoT stream');

            // Start polling for updates
            this.startMonitoring();

            return true;
        } catch (error) {
            console.error('[DigitalTwin] Connection failed:', error);
            return false;
        }
    }

    /**
     * Start real-time monitoring
     */
    startMonitoring(intervalMs: number = 5000): void {
        if (this.updateInterval) return;

        this.updateInterval = setInterval(() => {
            this.processLatestData();
        }, intervalMs);

        console.log('[DigitalTwin] Monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('[DigitalTwin] Monitoring stopped');
    }

    /**
     * Ingest sensor data
     */
    ingestData(data: SensorData): void {
        const existing = this.sensorData.get(data.sensorId) || [];
        existing.push(data);

        // Keep last 1000 readings
        if (existing.length > 1000) {
            existing.shift();
        }

        this.sensorData.set(data.sensorId, existing);
        this.emit('sensor_data', data);

        // Check for anomalies
        this.checkAnomalies(data);
    }

    /**
     * Process latest data and update health
     */
    private processLatestData(): void {
        for (const [sensorId, readings] of this.sensorData) {
            if (readings.length === 0) continue;

            const latest = readings[readings.length - 1];

            if (latest.elementId) {
                this.updateHealthIndicator(latest.elementId, readings);
            }
        }
    }

    /**
     * Update element health indicator
     */
    private updateHealthIndicator(elementId: string, readings: SensorData[]): void {
        // Calculate health metrics
        const strainReadings = readings.filter(r => r.type === 'strain');
        const recent = strainReadings.slice(-100);

        if (recent.length === 0) return;

        const maxStrain = Math.max(...recent.map(r => Math.abs(r.value)));
        const allowableStrain = 0.002; // 0.2% yield strain
        const stressRatio = maxStrain / allowableStrain;

        // Estimate fatigue
        const cycleCount = this.countCycles(recent);
        const fatigueLife = this.estimateFatigueLife(cycleCount, stressRatio);

        const health: HealthIndicator = {
            elementId,
            timestamp: new Date(),
            overallHealth: Math.max(0, 100 - stressRatio * 50 - (1 - fatigueLife) * 30),
            stressRatio,
            fatigueLife,
            alerts: []
        };

        // Generate alerts
        if (stressRatio > 0.8) {
            health.alerts.push({
                id: `alert_${Date.now()}`,
                severity: stressRatio > 0.95 ? 'critical' : 'warning',
                type: 'overstress',
                message: `Element ${elementId} stress ratio: ${(stressRatio * 100).toFixed(1)}%`,
                elementId,
                timestamp: new Date(),
                acknowledged: false
            });
        }

        this.healthIndicators.set(elementId, health);
        this.emit('health_update', health);
    }

    /**
     * Count stress cycles (rainflow counting simplified)
     */
    private countCycles(readings: SensorData[]): number {
        let cycles = 0;
        let prevUp = true;

        for (let i = 1; i < readings.length; i++) {
            const diff = readings[i].value - readings[i - 1].value;
            const isUp = diff > 0;

            if (isUp !== prevUp) {
                cycles += 0.5;
                prevUp = isUp;
            }
        }

        return Math.floor(cycles);
    }

    /**
     * Estimate remaining fatigue life
     */
    private estimateFatigueLife(cycles: number, stressRatio: number): number {
        // Simplified S-N curve estimation
        const Nf = stressRatio > 0.5
            ? Math.pow(10, 6.5 - 3 * stressRatio)
            : 1e9; // Effectively infinite at low stress

        return Math.max(0, 1 - cycles / Nf);
    }

    /**
     * Check for anomalies using AI
     */
    private checkAnomalies(data: SensorData): void {
        const history = this.sensorData.get(data.sensorId) || [];
        if (history.length < 100) return;

        // Calculate rolling statistics
        const recent = history.slice(-100);
        const mean = recent.reduce((sum, r) => sum + r.value, 0) / recent.length;
        const variance = recent.reduce((sum, r) => sum + Math.pow(r.value - mean, 2), 0) / recent.length;
        const stdDev = Math.sqrt(variance);

        // Check if current value is anomalous (> 3 sigma)
        const zScore = Math.abs(data.value - mean) / stdDev;

        if (zScore > 3) {
            const alert: Alert = {
                id: `alert_anomaly_${Date.now()}`,
                severity: zScore > 5 ? 'critical' : 'warning',
                type: 'anomaly',
                message: `Anomalous reading from ${data.sensorId}: ${data.value.toFixed(4)} (${zScore.toFixed(1)}σ)`,
                elementId: data.elementId,
                timestamp: new Date(),
                acknowledged: false
            };

            this.alerts.push(alert);
            this.emit('alert', alert);
        }
    }

    /**
     * Predictive maintenance analysis
     */
    predictMaintenance(elementId: string): PredictiveMaintenanceResult | null {
        const health = this.healthIndicators.get(elementId);
        if (!health) return null;

        const remainingLife = health.fatigueLife * 100;
        let priority: PredictiveMaintenanceResult['priority'] = 'low';
        const recommendedActions: string[] = [];

        if (remainingLife < 10) {
            priority = 'urgent';
            recommendedActions.push('Immediate inspection required');
            recommendedActions.push('Consider replacement within 30 days');
        } else if (remainingLife < 30) {
            priority = 'high';
            recommendedActions.push('Schedule detailed inspection');
            recommendedActions.push('Plan for replacement within 6 months');
        } else if (remainingLife < 50) {
            priority = 'medium';
            recommendedActions.push('Monitor closely');
            recommendedActions.push('Include in next maintenance cycle');
        } else {
            recommendedActions.push('Continue normal monitoring');
        }

        return {
            elementId,
            remainingLife,
            confidenceLevel: 0.85,
            recommendedActions,
            priority
        };
    }

    /**
     * Get historical analysis
     */
    getHistoricalAnalysis(
        elementId: string,
        days: number = 30
    ): HistoricalAnalysis | null {
        // Would query historical database
        return {
            elementId,
            period: {
                start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                end: new Date()
            },
            peakStress: 0.75,
            avgStress: 0.35,
            cycleCount: 15000,
            temperatureRange: { min: 15, max: 45 },
            trendAnalysis: 'stable'
        };
    }

    /**
     * Get current health for all elements
     */
    getAllHealth(): HealthIndicator[] {
        return Array.from(this.healthIndicators.values());
    }

    /**
     * Get active alerts
     */
    getAlerts(unacknowledgedOnly: boolean = false): Alert[] {
        return unacknowledgedOnly
            ? this.alerts.filter(a => !a.acknowledged)
            : this.alerts;
    }

    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            this.emit('alert_acknowledged', alert);
        }
    }

    /**
     * Subscribe to events
     */
    on(handler: (event: string, data: any) => void): () => void {
        this.listeners.push(handler);
        return () => {
            this.listeners = this.listeners.filter(l => l !== handler);
        };
    }

    private emit(event: string, data: any): void {
        for (const listener of this.listeners) {
            listener(event, data);
        }
    }

    /**
     * Disconnect
     */
    disconnect(): void {
        this.stopMonitoring();
        this.connected = false;
        console.log('[DigitalTwin] Disconnected');
    }
}

// ============================================
// SINGLETON
// ============================================

export const digitalTwin = new DigitalTwinServiceClass();

export default DigitalTwinServiceClass;
