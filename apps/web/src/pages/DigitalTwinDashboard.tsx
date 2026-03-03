/**
 * DigitalTwinDashboard.tsx
 *
 * Real-time Structural Health Monitoring dashboard that uses the
 * DigitalTwinService to ingest simulated sensor data, display health
 * indicators, surface alerts, and run predictive maintenance analysis.
 *
 * The service layer is fully functional — this page drives it with
 * simulated IoT sensor readings so the dashboard is usable without
 * a physical sensor network.
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Heart,
  Radio,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Wrench,
  XCircle,
  BarChart3,
  RefreshCw,
  Play,
  Pause,
  Settings,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  digitalTwin,
  type SensorData,
  type HealthIndicator,
  type Alert,
  type PredictiveMaintenanceResult,
} from "../services/digital-twin";
import { useModelStore } from "../store/model";

// ============================================
// SIMULATED SENSOR CONFIG
// ============================================

interface SimSensor {
  id: string;
  type: SensorData["type"];
  elementId: string;
  location: { x: number; y: number; z: number };
  unit: string;
  baseMean: number;
  baseAmp: number;
}

/** Build simulated sensors from the current model's members */
function buildSensorsFromModel(
  members: Map<string, any>,
  nodes: Map<string, any>,
): SimSensor[] {
  const sensors: SimSensor[] = [];
  let idx = 0;

  for (const member of members.values()) {
    const startNode = nodes.get(member.startNodeId);
    const endNode = nodes.get(member.endNodeId);
    if (!startNode || !endNode) continue;

    const mx = (startNode.x + endNode.x) / 2;
    const my = (startNode.y + endNode.y) / 2;
    const mz = (startNode.z + endNode.z) / 2;

    sensors.push({
      id: `strain-${idx}`,
      type: "strain",
      elementId: member.id,
      location: { x: mx, y: my, z: mz },
      unit: "με",
      baseMean: 200 + idx * 30,
      baseAmp: 40 + idx * 5,
    });

    sensors.push({
      id: `accel-${idx}`,
      type: "acceleration",
      elementId: member.id,
      location: { x: mx, y: my, z: mz },
      unit: "m/s²",
      baseMean: 0.1,
      baseAmp: 0.05,
    });

    idx++;
    if (idx >= 12) break; // Cap at 12 members
  }

  // If no model, create 4 demo sensors
  if (sensors.length === 0) {
    for (let i = 0; i < 4; i++) {
      sensors.push({
        id: `strain-demo-${i}`,
        type: "strain",
        elementId: `M${i + 1}`,
        location: { x: i * 3, y: 0, z: 0 },
        unit: "με",
        baseMean: 180 + i * 50,
        baseAmp: 35,
      });
      sensors.push({
        id: `temp-demo-${i}`,
        type: "temperature",
        elementId: `M${i + 1}`,
        location: { x: i * 3, y: 0, z: 0 },
        unit: "°C",
        baseMean: 25,
        baseAmp: 3,
      });
    }
  }

  return sensors;
}

/** Generate a simulated reading for a sensor */
function generateReading(sensor: SimSensor, tick: number): SensorData {
  const noise = (Math.random() - 0.5) * sensor.baseAmp * 0.4;
  const cyclic = Math.sin(tick * 0.05 + Math.random() * 0.1) * sensor.baseAmp;
  return {
    sensorId: sensor.id,
    timestamp: new Date(),
    type: sensor.type,
    value: sensor.baseMean + cyclic + noise,
    unit: sensor.unit,
    location: sensor.location,
    elementId: sensor.elementId,
  };
}

// ============================================
// SMALL UI HELPERS
// ============================================

const SeverityBadge: React.FC<{ severity: Alert["severity"] }> = ({
  severity,
}) => {
  const colors: Record<string, string> = {
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[severity] ?? colors.info}`}
    >
      {severity}
    </span>
  );
};

const PriorityBadge: React.FC<{
  priority: PredictiveMaintenanceResult["priority"];
}> = ({ priority }) => {
  const colors: Record<string, string> = {
    low: "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    high: "bg-orange-500/20 text-orange-400",
    urgent: "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[priority] ?? colors.low}`}
    >
      {priority.toUpperCase()}
    </span>
  );
};

const HealthGauge: React.FC<{ value: number; label: string }> = ({
  value,
  label,
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct > 70 ? "#22c55e" : pct > 40 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r="36"
          stroke="#334155"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="44"
          cy="44"
          r="36"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute mt-6 text-center">
        <span className="text-lg font-bold text-slate-900 dark:text-white">{pct.toFixed(0)}%</span>
      </div>
      <span className="text-slate-600 dark:text-slate-400 text-xs mt-1">{label}</span>
    </div>
  );
};

// ============================================
// MAIN DASHBOARD
// ============================================

const DigitalTwinDashboard: React.FC = () => {
  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);

  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [tick, setTick] = useState(0);
  const [healthData, setHealthData] = useState<HealthIndicator[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [maintenance, setMaintenance] = useState<PredictiveMaintenanceResult[]>(
    [],
  );
  const [latestReadings, setLatestReadings] = useState<Map<string, SensorData>>(
    new Map(),
  );
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const tickRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build sensor list from model
  const sensors = useMemo(
    () => buildSensorsFromModel(members, nodes),
    [members, nodes],
  );

  // Connect to digital twin service
  const connect = useCallback(async () => {
    const wsBase = import.meta.env.VITE_PYTHON_API_URL
      ? import.meta.env.VITE_PYTHON_API_URL.replace('http://', 'ws://').replace('https://', 'wss://')
      : (import.meta.env.PROD ? 'wss://beamlab-backend-python.azurewebsites.net' : 'ws://localhost:4001');
    const ok = await digitalTwin.connect({
      endpoint: `${wsBase}/iot`,
      projectId: "beamlab-live",
    });
    setConnected(ok);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    digitalTwin.disconnect();
    setConnected(false);
    setSimulating(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start / stop simulated sensor loop
  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSimulating(false);
      return;
    }

    setSimulating(true);
    intervalRef.current = setInterval(() => {
      tickRef.current += 1;

      // Collect all sensor readings in a single pass (avoid N Map copies)
      const newReadings = new Map<string, any>();
      for (const sensor of sensors) {
        const reading = generateReading(sensor, tickRef.current);
        digitalTwin.ingestData(reading);
        newReadings.set(sensor.id, reading);
      }

      // Compute derived data before any setState
      const allHealth = digitalTwin.getAllHealth();
      const alertsList = digitalTwin.getAlerts().slice(-30);
      const maint: PredictiveMaintenanceResult[] = [];
      for (const h of allHealth) {
        const pm = digitalTwin.predictMaintenance(h.elementId);
        if (pm) maint.push(pm);
      }

      // React 18 with createRoot batches these automatically
      setTick(tickRef.current);
      setLatestReadings(newReadings);
      setHealthData(allHealth);
      setAlerts(alertsList);
      setMaintenance(maint);
    }, 1200);
  }, [simulating, sensors]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((id: string) => {
    digitalTwin.acknowledgeAlert(id);
    setAlerts(digitalTwin.getAlerts().slice(-30));
  }, []);

  // Aggregate stats
  const avgHealth = useMemo(() => {
    if (healthData.length === 0) return 100;
    return (
      healthData.reduce((sum, h) => sum + h.overallHealth, 0) /
      healthData.length
    );
  }, [healthData]);

  const criticalAlerts = useMemo(
    () =>
      alerts.filter((a) => a.severity === "critical" && !a.acknowledged).length,
    [alerts],
  );
  const warningAlerts = useMemo(
    () =>
      alerts.filter((a) => a.severity === "warning" && !a.acknowledged).length,
    [alerts],
  );

  useEffect(() => {
    document.title = "Digital Twin | BeamLab";
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-lg">Digital Twin</span>
            <span className="text-slate-500 text-xs ml-2">
              Structural Health Monitoring
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              connected
                ? "bg-green-500/20 text-green-400"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            {connected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {connected ? "Connected" : "Disconnected"}
          </div>

          {/* Connect / disconnect */}
          {!connected ? (
            <button type="button"
              onClick={connect}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
            >
              Connect
            </button>
          ) : (
            <button type="button"
              onClick={disconnect}
              className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white text-sm rounded-lg transition-colors"
            >
              Disconnect
            </button>
          )}

          {/* Sim toggle */}
          <button type="button"
            onClick={toggleSimulation}
            disabled={!connected}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors ${
              simulating
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {simulating ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {simulating ? "Pause Sim" : "Start Sim"}
          </button>
        </div>
      </header>

      {/* Main grid */}
      <div className="p-6 grid grid-cols-12 gap-5">
        {/* ---- KPI Cards ---- */}
        <div className="col-span-12 grid grid-cols-4 gap-4">
          {/* Overall Health */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-5 flex items-center gap-4 border border-slate-300 dark:border-slate-700">
            <div className="relative">
              <HealthGauge value={avgHealth} label="" />
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Overall Health</p>
              <p className="text-2xl font-bold">{avgHealth.toFixed(1)}%</p>
            </div>
          </div>

          {/* Active Sensors */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-5 border border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Active Sensors
            </div>
            <p className="text-2xl font-bold">{sensors.length}</p>
            <p className="text-slate-500 text-xs mt-1">
              {latestReadings.size} reporting · tick #{tick}
            </p>
          </div>

          {/* Critical Alerts */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-5 border border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Critical Alerts
            </div>
            <p className="text-2xl font-bold">{criticalAlerts}</p>
            <p className="text-slate-500 text-xs mt-1">
              {warningAlerts} warnings
            </p>
          </div>

          {/* Monitored Elements */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-5 border border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm mb-1">
              <Heart className="w-4 h-4" />
              Monitored Elements
            </div>
            <p className="text-2xl font-bold">{healthData.length}</p>
            <p className="text-slate-500 text-xs mt-1">
              {maintenance.filter((m) => m.priority === "urgent").length} urgent
              actions
            </p>
          </div>
        </div>

        {/* ---- Left: Live Sensor Feed ---- */}
        <div className="col-span-5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col max-h-[520px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 dark:border-slate-700">
            <span className="font-medium text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Live Sensor Feed
            </span>
            {simulating && (
              <span className="flex items-center gap-1 text-xs text-green-400 animate-pulse">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Live
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
            {sensors.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No sensors configured. Load a model to generate sensors.
              </div>
            )}
            {sensors.map((sensor) => {
              const reading = latestReadings.get(sensor.id);
              return (
                <div
                  key={sensor.id}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-700/30"
                >
                  <div>
                    <p className="text-sm font-medium">{sensor.id}</p>
                    <p className="text-xs text-slate-500">
                      {sensor.type} · {sensor.elementId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {reading ? reading.value.toFixed(2) : "—"}{" "}
                      <span className="text-slate-500">{sensor.unit}</span>
                    </p>
                    {reading && (
                      <p className="text-[10px] text-slate-600">
                        {reading.timestamp.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Right: Health Indicators ---- */}
        <div className="col-span-7 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col max-h-[520px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 dark:border-slate-700">
            <span className="font-medium text-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-green-400" />
              Element Health Indicators
            </span>
            <span className="text-xs text-slate-500">
              {healthData.length} elements
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {healthData.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Start the simulation to see health data.
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr className="text-slate-600 dark:text-slate-400 text-xs border-b border-slate-300 dark:border-slate-700">
                  <th className="text-left px-4 py-2">Element</th>
                  <th className="text-right px-4 py-2">Health</th>
                  <th className="text-right px-4 py-2">Stress Ratio</th>
                  <th className="text-right px-4 py-2">Fatigue Life</th>
                  <th className="text-center px-4 py-2">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {healthData.map((h) => {
                  const healthColor =
                    h.overallHealth > 70
                      ? "text-green-400"
                      : h.overallHealth > 40
                        ? "text-amber-400"
                        : "text-red-400";
                  return (
                    <tr key={h.elementId} className="hover:bg-slate-200 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2 font-medium">{h.elementId}</td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${healthColor}`}
                      >
                        {h.overallHealth.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {(h.stressRatio * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {(h.fatigueLife * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        {h.alerts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                            <AlertTriangle className="w-3 h-3" />{" "}
                            {h.alerts.length}
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Alerts ---- */}
        <div className="col-span-6 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col max-h-[380px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 dark:border-slate-700">
            <span className="font-medium text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Alert Log
            </span>
            <span className="text-xs text-slate-500">
              {alerts.length} total
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
            {alerts.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No alerts yet.
              </div>
            )}
            {[...alerts].reverse().map((alert) => (
              <div
                key={alert.id}
                className={`px-4 py-2.5 ${alert.acknowledged ? "opacity-50" : ""} hover:bg-slate-200 dark:hover:bg-slate-700/30`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  {!alert.acknowledged && (
                    <button type="button"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Ack
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {alert.timestamp.toLocaleTimeString()} · {alert.type}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Predictive Maintenance ---- */}
        <div className="col-span-6 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col max-h-[380px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 dark:border-slate-700">
            <span className="font-medium text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-400" />
              Predictive Maintenance
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
            {maintenance.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Run the simulation to generate maintenance predictions.
              </div>
            )}
            {maintenance.map((pm) => (
              <div
                key={pm.elementId}
                className="px-4 py-3 hover:bg-slate-200 dark:hover:bg-slate-700/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{pm.elementId}</span>
                  <PriorityBadge priority={pm.priority} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <span>
                    Remaining life:{" "}
                    <span className="text-slate-900 dark:text-white font-mono">
                      {pm.remainingLife.toFixed(1)}%
                    </span>
                  </span>
                  <span>
                    Confidence:{" "}
                    <span className="text-slate-900 dark:text-white font-mono">
                      {(pm.confidenceLevel * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {pm.recommendedActions.map((action, i) => (
                    <li
                      key={i}
                      className="text-xs text-slate-500 flex items-start gap-1.5"
                    >
                      <span className="text-slate-600 mt-0.5">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinDashboard;
