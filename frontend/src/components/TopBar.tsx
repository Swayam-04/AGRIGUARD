import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Wifi,
  Camera,
  Radio,
  Cpu,
  BatteryMedium,
  ChevronRight
} from 'lucide-react';
import { TelemetryData } from '../types';

interface TopBarProps {
  pageTitle: string;
  pageSection?: string;
  telemetry: TelemetryData | null;
  wsConnected: boolean;
  onEmergencyStop: () => void;
  operatingMode?: 'SIMULATION' | 'REAL_HARDWARE';
  onModeSwitch?: (mode: 'SIMULATION' | 'REAL_HARDWARE') => void;
  onOpenConnect?: () => void;
}

/** Real moving-average FPS counter */
function useSystemFPS(targetFPS: number = 160) {
  const [fps, setFps] = useState<number | null>(null);
  const frameTimestamps = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastDisplayRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      frameTimestamps.current.push(now);
      // Keep only last 60 frames
      const cutoff = now - 1000;
      while (frameTimestamps.current.length > 0 && frameTimestamps.current[0] < cutoff) {
        frameTimestamps.current.shift();
      }
      // Update display every 700ms to reduce jitter
      if (now - lastDisplayRef.current >= 700) {
        lastDisplayRef.current = now;
        const measured = frameTimestamps.current.length;
        setFps(measured);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const status: 'healthy' | 'degraded' | 'critical' =
    fps === null ? 'critical'
    : fps >= targetFPS * 0.85 ? 'healthy'
    : fps >= targetFPS * 0.5 ? 'degraded'
    : 'critical';

  return { fps, status };
}

export const TopBar: React.FC<TopBarProps> = ({
  pageTitle,
  pageSection,
  telemetry,
  wsConnected,
  onEmergencyStop,
  operatingMode,
  onModeSwitch,
  onOpenConnect
}) => {
  const { fps: systemFPS, status: sysFPSStatus } = useSystemFPS(160);

  const esp32Connected = telemetry?.esp32_connected ?? false;
  const cameraConnected = telemetry?.camera_status?.connected ?? false;
  const cameraFPS = telemetry?.camera_status?.fps ?? null;
  const isEStopActive = telemetry?.safety?.emergency_stop ?? false;
  const batteryPct = telemetry?.battery_percentage ?? null;
  const pingMs = telemetry?.esp32_ping_ms ?? null;

  // Simulation mode is prioritized by default
  const isSimulation = operatingMode
    ? operatingMode === 'SIMULATION'
    : (telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION' || (!telemetry?.hardware_mode && !telemetry?.esp32_connected));

  // Camera FPS quality
  const camFPSStatus: 'healthy' | 'degraded' | 'critical' =
    cameraFPS === null ? 'critical'
    : cameraFPS >= 100 ? 'healthy'
    : cameraFPS >= 60 ? 'degraded'
    : 'critical';

  // Robot chip status
  let robotChipClass = 'simulation';
  let robotChipLabel = 'Simulation · Active';
  if (!isSimulation) {
    if (esp32Connected) {
      robotChipClass = 'connected';
      robotChipLabel = pingMs ? `ESP32 · ${pingMs}ms` : 'ESP32 · Connected';
    } else {
      robotChipClass = 'disconnected';
      robotChipLabel = 'ESP32 · Offline';
    }
  }

  return (
    <div className="topbar">
      {/* Left: Breadcrumb */}
      <div className="topbar-breadcrumb">
        <span>Greenovators</span>
        <ChevronRight size={13} className="topbar-breadcrumb-sep" />
        {pageSection && (
          <>
            <span>{pageSection}</span>
            <ChevronRight size={13} className="topbar-breadcrumb-sep" />
          </>
        )}
        <span className="topbar-breadcrumb-current">{pageTitle}</span>
      </div>

      <div className="topbar-spacer" />

      {/* ── Mode Switcher: Simulation (Priority) vs Real Hardware ── */}
      <div className="topbar-mode-switcher">
        <button
          type="button"
          id="topbar-mode-sim-btn"
          onClick={() => onModeSwitch?.('SIMULATION')}
          className={`topbar-mode-btn ${isSimulation ? 'active-sim' : ''}`}
          title="Simulation Mode: Safe virtual test sandbox, 3D digital twin & live physics"
        >
          <span className={`mode-dot ${isSimulation ? 'sim-pulse' : ''}`} />
          <Radio size={12} />
          <span>SIMULATION</span>
          <span className="mode-pill-tag priority">PRIORITY</span>
        </button>

        <button
          type="button"
          id="topbar-mode-hw-btn"
          onClick={() => onModeSwitch?.('REAL_HARDWARE')}
          className={`topbar-mode-btn ${!isSimulation ? 'active-hw' : ''}`}
          title="Real Hardware Mode: Connect physical ESP32 rover via Wi-Fi or Web Bluetooth"
        >
          <Cpu size={12} />
          <span>REAL HARDWARE</span>
          {!isSimulation && (
            <span className={`mode-pill-tag ${esp32Connected ? 'online' : 'offline'}`}>
              {esp32Connected ? 'LIVE' : 'STANDBY'}
            </span>
          )}
        </button>
      </div>

      {/* FPS Indicators */}
      <div className="topbar-fps-group">
        <div className={`fps-badge ${sysFPSStatus}`}>
          <span className="fps-dot" />
          <span>SYS {systemFPS !== null ? `${systemFPS} FPS` : '-- FPS'}</span>
        </div>
        <div className={`fps-badge ${camFPSStatus}`}>
          <span className="fps-dot" />
          <Camera size={11} />
          <span>CAM {cameraFPS !== null ? `${cameraFPS} FPS` : cameraConnected ? '…' : '-- FPS'}</span>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          className={`topbar-chip ${robotChipClass}`}
          onClick={!isSimulation && !esp32Connected && onOpenConnect ? onOpenConnect : undefined}
          style={!isSimulation && !esp32Connected && onOpenConnect ? { cursor: 'pointer' } : {}}
          title={!isSimulation && !esp32Connected ? 'Physical ESP32 is offline. Click to connect or switch back to Simulation.' : undefined}
        >
          {isSimulation ? (
            <span className="sidebar-status-dot online pulse" style={{ width: 6, height: 6, background: '#2563EB', boxShadow: '0 0 6px #3B82F6' }} />
          ) : (
            <Radio size={11} />
          )}
          <span>{robotChipLabel}</span>
        </div>

        <div className={`topbar-chip ${wsConnected ? 'connected' : 'disconnected'}`}>
          <Wifi size={11} />
          <span>{wsConnected ? 'Live' : 'Offline'}</span>
        </div>

        {batteryPct !== null && (
          <div className="topbar-chip connected">
            <BatteryMedium size={11} />
            <span>{batteryPct}%</span>
          </div>
        )}
      </div>

      {/* E-Stop */}
      <button
        id="topbar-emergency-stop"
        onClick={onEmergencyStop}
        className="estop-btn"
        title="Immediately stops all motors, closes solenoid valve, halts pump"
        style={isEStopActive ? { background: '#991B1B', boxShadow: '0 0 0 2px #FCA5A5' } : {}}
      >
        <ShieldAlert size={13} />
        {isEStopActive ? 'E-STOP ACTIVE' : 'EMERGENCY STOP'}
      </button>
    </div>
  );
};
