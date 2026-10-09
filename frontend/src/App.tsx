import React, { useState, useEffect } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { TopBar } from './components/TopBar';
import { SidebarNav, TabId } from './components/SidebarNav';
import { CameraView } from './components/CameraView';
import { TelemetryCard } from './components/TelemetryCard';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SensorsPage } from './pages/SensorsPage';
import { DeviceHealthPage } from './pages/DeviceHealthPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { ConnectPanel } from './components/ConnectPanel';
import { connectionManager, OperatingMode } from './services/connectionManager';
import { AgriGuardTwin } from './digitalTwin/AgriGuardTwin';
import { SimulatedViewPage } from './simulator/SimulatedViewPage';
import { WeedManagementPage } from './pages/WeedManagementPage';
import { EnvironmentalImpactCard } from './components/EnvironmentalImpactCard';
import { DiseaseDetectPage } from './pages/DiseaseDetectPage';
import { AIDetection, TreatmentDecision } from './types';
import {
  runCropScan,
  approveTreatment,
  sendRobotMove,
  sendRobotStop,
  sendEmergencyStop
} from './services/api';
import {
  Cpu,
  Activity,
  Camera,
  Leaf,
  ShieldCheck,
  Radio,
  Map,
  Zap,
  AlertTriangle,
  ShieldAlert,
  Droplets,
  Microscope
} from 'lucide-react';

// ─── Page meta ─────────────────────────────────────────────────────────────
const PAGE_META: Record<TabId, { title: string; section: string }> = {
  dashboard:     { title: 'Dashboard',             section: 'Operations' },
  disease:       { title: 'Crop Disease AI & Lab',  section: 'AI & Vision' },
  heatmap:       { title: 'Field Monitor Camera',   section: 'Operations' },
  weeds:         { title: 'Weed Management',        section: 'Field Operations' },
  simulation:    { title: '3D Simulation',          section: 'Simulation & Eco' },
  environmental: { title: 'Environmental Impact',   section: 'Simulation & Eco' },
  sensors:       { title: 'Sensors',                section: 'Hardware' },
  devices:       { title: 'Device Health',          section: 'Hardware' },
  diagnostics:   { title: 'Hardware Diagnostics',   section: 'System' },
  logs:          { title: 'System Logs',            section: 'System' },
};

// ─── App ────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const { telemetry, wsConnected } = useTelemetry();
  const [operatingMode, setOperatingMode] = useState<OperatingMode>(connectionManager.getMode());
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [activeZoneId, setActiveZoneId] = useState<string>('ZONE-R1C1');
  const [lastDetection, setLastDetection] = useState<AIDetection | null>(null);
  const [lastDecision, setLastDecision] = useState<TreatmentDecision | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Sync mode with connectionManager updates
  useEffect(() => {
    const unsub = connectionManager.subscribeStatus((st) => {
      setOperatingMode(st.mode);
    });
    return () => unsub();
  }, []);

  const handleModeSwitch = (mode: OperatingMode) => {
    connectionManager.setMode(mode);
    setOperatingMode(mode);
  };

  // AI Scan
  const handleTriggerScan = async (frameBase64?: string) => {
    setIsScanning(true);
    setScanNotification(null);
    try {
      const res = await runCropScan(frameBase64);
      setLastDetection(res.detection);
      setLastDecision(res.decision);
      setScanNotification(`Analysis complete: ${res.detection.display_name} (${(res.detection.confidence * 100).toFixed(0)}%)`);
    } catch (err: any) {
      setScanNotification(`Scan error: ${err.message || 'Camera capture failed'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Treatment approval
  const handleApproveTreatment = async (decisionId: string, approved: boolean, operatorName: string) => {
    const res = await approveTreatment(decisionId, approved, operatorName);
    if (lastDecision) {
      setLastDecision({
        ...lastDecision,
        approved,
        status: approved ? 'FARMER_APPROVED_EXECUTED' : 'REJECTED_BY_FARMER'
      });
    }
    return res;
  };

  // Robot commands
  const handleMove = async (direction: string, speed: number, durationMs: number = 0) =>
    sendRobotMove(direction, speed, durationMs);
  const handleStop = async () => sendRobotStop();
  const handleEmergencyStop = async () => sendEmergencyStop();

  const { title, section } = PAGE_META[activeTab];
  const esp32Connected = telemetry?.esp32_connected ?? false;
  const isSimulation = operatingMode
    ? operatingMode === 'SIMULATION'
    : (telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION' || (!telemetry?.hardware_mode && !telemetry?.esp32_connected));
  const isEStopActive = telemetry?.safety?.emergency_stop ?? false;
  const batteryPct = telemetry?.battery_percentage ?? null;
  const soilPct = typeof telemetry?.soil_moisture === 'number'
    ? telemetry.soil_moisture
    : (telemetry?.soil_moisture as any)?.moisture_pct ?? null;
  const tempC = telemetry?.dht22?.temperature ?? telemetry?.environment?.temperature_c ?? null;
  const humidity = telemetry?.dht22?.humidity ?? telemetry?.environment?.humidity_pct ?? null;
  const robotStatus = isSimulation ? 'Simulation Mode · Active' : esp32Connected ? 'ESP32 Connected' : 'Hardware Disconnected';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* ── Left Sidebar ── */}
      <SidebarNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        telemetry={telemetry}
        wsConnected={wsConnected}
        operatingMode={operatingMode}
        onModeSwitch={handleModeSwitch}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* ── Main Area ── */}
      <div className="main-area">
        {/* Top Bar */}
        <TopBar
          pageTitle={title}
          pageSection={section}
          telemetry={telemetry}
          wsConnected={wsConnected}
          onEmergencyStop={handleEmergencyStop}
          operatingMode={operatingMode}
          onModeSwitch={handleModeSwitch}
          onOpenConnect={() => setActiveTab('devices')}
          onToggleSidebar={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Page Content */}
        <div className="page-content">

          {/* Scan notification banner */}
          {scanNotification && (
            <div className={`notification-banner ${scanNotification.includes('error') ? 'error' : 'success'}`}>
              {scanNotification.includes('error')
                ? <AlertTriangle size={15} />
                : <ShieldCheck size={15} />}
              <span>{scanNotification}</span>
              <button
                onClick={() => setScanNotification(null)}
                className="btn btn-ghost"
                style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* E-Stop active warning */}
          {isEStopActive && (
            <div className="estop-banner">
              <ShieldAlert size={18} />
              <div>
                <strong>EMERGENCY STOP ACTIVE</strong>
                <div style={{ fontSize: '0.76rem', fontWeight: 500, opacity: 0.85, marginTop: '2px' }}>
                  All motor PWM and chemical pump actuation are hardware locked. Clear the interlock to resume.
                </div>
              </div>
            </div>
          )}

          {/* ━━━ DASHBOARD ━━━ */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* KPI Summary Row */}
              <div className="grid-4">
                <div className="stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div className="stat-label" style={{ marginBottom: 0 }}>Robot Status</div>
                    <span
                      className={`badge ${isSimulation ? 'badge-blue' : esp32Connected ? 'badge-green' : 'badge-red'}`}
                      style={{ fontSize: '0.62rem', padding: '2px 7px' }}
                    >
                      {isSimulation ? 'PRIORITY · SIMULATION' : esp32Connected ? 'HARDWARE · LIVE' : 'HARDWARE · OFFLINE'}
                    </span>
                  </div>
                  <div className="stat-value" style={{
                    fontSize: '1.15rem',
                    color: isSimulation ? 'var(--info)' : esp32Connected ? 'var(--green-700)' : 'var(--danger)'
                  }}>
                    {robotStatus}
                  </div>
                  <div className="stat-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', gap: '8px' }}>
                    <span>
                      {isSimulation ? 'Safe test sandbox · 3D twin live' : esp32Connected ? '4WD chassis active' : 'Waiting for ESP32 on Wi-Fi/BLE'}
                    </span>
                    <button
                      type="button"
                      id="dashboard-switch-mode-btn"
                      onClick={() => handleModeSwitch(isSimulation ? 'REAL_HARDWARE' : 'SIMULATION')}
                      style={{
                        background: isSimulation ? 'var(--bg-subtle)' : 'var(--green-50)',
                        border: `1px solid ${isSimulation ? 'var(--border)' : 'var(--green-300)'}`,
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: isSimulation ? 'var(--text-primary)' : 'var(--green-700)',
                        whiteSpace: 'nowrap'
                      }}
                      title={isSimulation ? 'Switch to physical ESP32 hardware mode' : 'Switch back to safe Simulation mode'}
                    >
                      {isSimulation ? 'Switch to Hardware ⚡' : '🎮 Simulation Mode'}
                    </button>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">AI System</div>
                  <div className="stat-value" style={{ fontSize: '1.15rem', color: 'var(--green-700)' }}>
                    Ready
                  </div>
                  <div className="stat-meta">
                    {lastDetection
                      ? `Last: ${lastDetection.display_name}`
                      : 'Awaiting scan'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Soil Moisture</div>
                  <div className="stat-value">
                    {soilPct !== null ? `${soilPct.toFixed(0)}%` : '--'}
                  </div>
                  <div className="stat-meta">
                    {soilPct === null ? 'Sensor offline'
                      : soilPct >= 70 ? 'WET — reduce irrigation'
                      : soilPct >= 40 ? 'NORMAL — optimal range'
                      : 'DRY — irrigation recommended'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Battery</div>
                  <div className="stat-value" style={{
                    color: batteryPct !== null && batteryPct < 20 ? 'var(--danger)'
                      : batteryPct !== null && batteryPct < 50 ? 'var(--warning)' : 'var(--text-primary)'
                  }}>
                    {batteryPct !== null ? `${batteryPct}%` : '--'}
                  </div>
                  <div className="stat-meta">
                    {batteryPct !== null
                      ? (batteryPct < 20 ? 'Low — charge soon' : batteryPct < 50 ? 'Moderate' : 'Healthy')
                      : 'Not reported'}
                  </div>
                </div>
              </div>

              {/* Quick environment strip */}
              {(tempC !== null || humidity !== null) && (
                <div className="card" style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Environment
                    </span>
                    {tempC !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Temperature</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tempC.toFixed(1)}°C</span>
                      </div>
                    )}
                    {humidity !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Humidity</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{humidity.toFixed(0)}%</span>
                      </div>
                    )}
                    {telemetry?.active_zone_id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Zone</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--green-700)', fontFamily: 'monospace' }}>{telemetry.active_zone_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hardware Connection Panel (Web Bluetooth & Wi-Fi) */}
              <ConnectPanel telemetry={telemetry} />

              {/* Live Digital Twin 3D Rover */}
              <AgriGuardTwin telemetry={telemetry} />

              {/* Sensor Telemetry */}
              <TelemetryCard telemetry={telemetry} />
            </div>
          )}

          {/* ━━━ CROP DISEASE AI & UPLOAD LAB ━━━ */}
          {activeTab === 'disease' && (
            <div style={{ width: '100%' }}>
              <DiseaseDetectPage />
            </div>
          )}

          {/* ━━━ FIELD MONITOR (Camera) ━━━ */}
          {activeTab === 'heatmap' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <CameraView
                cameraStatus={telemetry?.camera_status}
                lastDetection={lastDetection}
                isScanning={isScanning}
                onTriggerScan={handleTriggerScan}
                activeZoneId={telemetry?.active_zone_id ?? activeZoneId}
                telemetry={telemetry}
                onMove={handleMove}
                onStop={handleStop}
              />
            </div>
          )}

          {/* ━━━ WEED MANAGEMENT ━━━ */}
          {activeTab === 'weeds' && (
            <WeedManagementPage />
          )}

          {/* ━━━ SIMULATION (3D Multi-Tank Farm) ━━━ */}
          {activeTab === 'simulation' && (
            <SimulatedViewPage />
          )}

          {/* ━━━ ENVIRONMENTAL IMPACT & CARBON INTELLIGENCE ━━━ */}
          {activeTab === 'environmental' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
              <EnvironmentalImpactCard telemetry={telemetry} />
            </div>
          )}

          {/* ━━━ SENSORS ━━━ */}
          {activeTab === 'sensors' && (
            <SensorsPage telemetry={telemetry} />
          )}

          {/* ━━━ DEVICES ━━━ */}
          {activeTab === 'devices' && (
            <DeviceHealthPage />
          )}

          {/* ━━━ HARDWARE DIAGNOSTICS ━━━ */}
          {activeTab === 'diagnostics' && (
            <DiagnosticsPage />
          )}

          {/* ━━━ SYSTEM LOGS ━━━ */}
          {activeTab === 'logs' && (
            <SystemLogsPage />
          )}

        </div>
      </div>
    </div>
  );
};
