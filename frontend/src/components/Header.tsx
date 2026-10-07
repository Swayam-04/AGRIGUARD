import React from 'react';
import {
  ShieldAlert,
  Cpu,
  Camera,
  Wifi,
  BatteryCharging,
  Radio,
  LayoutDashboard,
  Gamepad2,
  Stethoscope,
  Boxes,
  Leaf
} from 'lucide-react';
import { TelemetryData } from '../types';

interface HeaderProps {
  telemetry: TelemetryData | null;
  wsConnected: boolean;
  activeTab: 'dashboard' | 'remote' | 'simulation' | 'diagnostics' | 'environmental';
  setActiveTab: (tab: 'dashboard' | 'remote' | 'simulation' | 'diagnostics' | 'environmental') => void;
  onEmergencyStop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  wsConnected,
  activeTab,
  setActiveTab,
  onEmergencyStop
}) => {
  const esp32Connected = telemetry?.esp32_connected ?? false;
  const cameraConnected = telemetry?.camera_status?.connected ?? false;
  const isEStopActive = telemetry?.safety?.emergency_stop ?? false;
  const activeZone = telemetry?.active_zone_id ?? 'ZONE-R1C1';
  const batteryV = telemetry?.battery_voltage;
  const batteryPct = telemetry?.battery_percentage;
  const pingMs = telemetry?.esp32_ping_ms;

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'remote' as const, label: 'Field Remote', icon: Gamepad2 },
    { id: 'simulation' as const, label: 'Simulated View', icon: Boxes },
    { id: 'environmental' as const, label: 'Environmental Impact', icon: Leaf },
    { id: 'diagnostics' as const, label: 'Hardware Diagnostics', icon: Stethoscope }
  ];

  return (
    <div className="glass-panel sidebar-header-panel" style={{
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      borderRadius: '16px',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-glass)'
    }}>
      {/* 1. Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--emerald-500), #065f46)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px var(--emerald-glow)',
          flexShrink: 0
        }}>
          <Cpu size={24} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', margin: 0 }}>
              AgriGuard
            </h1>
            {telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION' ? (
              <span className="status-pill" style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--sky-400)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '0.62rem',
                padding: '0.15rem 0.45rem',
                fontWeight: 700
              }}>
                ● MODE: SIMULATION
              </span>
            ) : esp32Connected ? (
              <span className="status-pill status-online" style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem', fontWeight: 700 }}>
                ● ROBOT: CONNECTED
              </span>
            ) : (
              <span className="status-pill" style={{
                background: 'rgba(244, 63, 94, 0.15)',
                color: 'var(--rose-400)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                fontSize: '0.62rem',
                padding: '0.15rem 0.45rem',
                fontWeight: 700
              }}>
                ● ROBOT: DISCONNECTED
              </span>
            )}
          </div>
          <p style={{
            fontSize: '0.70rem',
            color: 'var(--emerald-400)',
            fontWeight: 600,
            margin: '2px 0 0 0',
            lineHeight: 1.25
          }}>
            Remote-controlled from the field site over a local Wi-Fi network
          </p>
        </div>
      </div>

      {/* 2. Full-Width Emergency Stop Button */}
      <button
        onClick={onEmergencyStop}
        className="btn btn-danger"
        style={{
          width: '100%',
          padding: '0.55rem 0.85rem',
          fontSize: '0.82rem',
          fontWeight: 800,
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: '0 0 16px rgba(244, 63, 94, 0.35)',
          borderRadius: '10px'
        }}
        title="Immediately trips motor PWM to 0, closes solenoid valve, and stops pump"
      >
        <ShieldAlert size={16} />
        <span>EMERGENCY STOP</span>
      </button>

      {/* Safety Warning Banner if E-Stop Triggered */}
      {isEStopActive && (
        <div style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          background: 'rgba(244, 63, 94, 0.2)',
          border: '1px solid var(--rose-500)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem'
        }}>
          <ShieldAlert size={16} color="var(--rose-500)" style={{ flexShrink: 0 }} />
          <span><strong>E-STOP ACTIVE:</strong> Interlock tripped. Actuators disabled.</span>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          marginBottom: '0.1rem'
        }}>
          Navigation Console
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.80rem',
                  borderRadius: '8px',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  background: isActive ? 'var(--emerald-500)' : 'transparent',
                  color: isActive ? '#05080f' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <Icon size={14} />
                  <span>{item.label}</span>
                </div>
                {isActive && <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>ACTIVE</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Live Hardware Status Badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          marginBottom: '0.1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>System Telemetry</span>
          <span className="mono" style={{ color: 'var(--emerald-400)' }}>{activeZone}</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.4rem'
        }}>
          {/* WebSocket Badge */}
          <div className={`status-pill ${wsConnected ? 'status-online' : 'status-offline'}`} style={{ fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
            <Radio size={11} />
            <span>Telemetry: {wsConnected ? 'LIVE' : 'OFF'}</span>
          </div>

          {/* Local Wi-Fi Badge */}
          <div className={`status-pill ${esp32Connected ? 'status-online' : 'status-offline'}`} style={{ fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
            <Wifi size={11} />
            <span>Wi-Fi: {esp32Connected ? 'CONNECTED' : 'OFF'}</span>
          </div>

          {/* Hardware Status Badge */}
          <div className={`status-pill ${esp32Connected ? 'status-online' : (telemetry?.hardware_mode === 'REAL_HARDWARE' ? 'status-offline' : 'status-warning')}`} style={{ fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
            <Radio size={11} />
            <span>Robot: {esp32Connected ? `CONNECTED ${pingMs ? `(${pingMs}ms)` : ''}` : (telemetry?.hardware_mode === 'REAL_HARDWARE' ? 'DISCONNECTED' : 'SIMULATION')}</span>
          </div>

          {/* Camera Badge */}
          <div className={`status-pill ${cameraConnected ? 'status-online' : 'status-offline'}`} style={{ fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
            <Camera size={11} />
            <span>Cam: {cameraConnected ? 'ONLINE' : 'OFF'}</span>
          </div>
        </div>

        {/* Battery & Zone Summary */}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
          <div className="status-pill" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Zone:</span>
            <span className="mono" style={{ fontWeight: 600 }}>{activeZone}</span>
          </div>

          {batteryV && (
            <div className="status-pill" style={{ flex: 1, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--sky-400)', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.66rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}>
              <BatteryCharging size={11} />
              <span>{batteryV.toFixed(1)}V ({batteryPct ?? 0}%)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
