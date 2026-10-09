import React from 'react';
import {
  LayoutDashboard,
  Map,
  Stethoscope,
  Leaf,
  Activity,
  Cpu,
  ScrollText,
  MonitorPlay,
  Crosshair,
  Microscope,
  X
} from 'lucide-react';
import { TelemetryData } from '../types';

export type TabId =
  | 'dashboard'
  | 'disease'
  | 'heatmap'
  | 'simulation'
  | 'weeds'
  | 'environmental'
  | 'sensors'
  | 'devices'
  | 'diagnostics'
  | 'logs';

interface SidebarNavProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  telemetry: TelemetryData | null;
  wsConnected: boolean;
  operatingMode?: 'SIMULATION' | 'REAL_HARDWARE';
  onModeSwitch?: (mode: 'SIMULATION' | 'REAL_HARDWARE') => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems: { id: TabId; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',             icon: LayoutDashboard, section: 'OPERATIONS' },
  { id: 'disease',       label: 'Crop Disease AI & Lab',  icon: Microscope },
  { id: 'heatmap',       label: 'Field Monitor Camera',   icon: Map },
  { id: 'weeds',         label: 'Weed Management',        icon: Crosshair },
  { id: 'simulation',    label: '3D Simulation',          icon: MonitorPlay, section: 'SIMULATION & ECO' },
  { id: 'environmental', label: 'Environmental Impact',   icon: Leaf },
  { id: 'sensors',       label: 'Sensors',                icon: Activity, section: 'HARDWARE & SYSTEM' },
  { id: 'devices',       label: 'Device Health',          icon: Cpu },
  { id: 'diagnostics',   label: 'Hardware Diagnostics',   icon: Stethoscope },
  { id: 'logs',          label: 'System Logs',            icon: ScrollText },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  telemetry,
  wsConnected,
  operatingMode,
  onModeSwitch,
  mobileOpen,
  onCloseMobile
}) => {
  const esp32Connected = telemetry?.esp32_connected ?? false;
  const isSimulation = operatingMode
    ? operatingMode === 'SIMULATION'
    : (telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION' || (!telemetry?.hardware_mode && !telemetry?.esp32_connected));
  const cameraOk = telemetry?.camera_status?.connected ?? false;
  const pingMs = telemetry?.esp32_ping_ms ?? null;

  const robotStatus = isSimulation ? 'online' : (esp32Connected ? 'online' : 'offline');
  const robotLabel = isSimulation ? 'Simulation Mode' : (esp32Connected ? (pingMs ? `ESP32 · ${pingMs}ms` : 'Connected') : 'Hardware Offline');

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <div className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Leaf size={18} color="#FFFFFF" />
          </div>
          <div className="sidebar-brand-text" style={{ flex: 1 }}>
            <span className="sidebar-brand-name">AgriGuard</span>
            <span className="sidebar-brand-sub">Greenovators · v2.0</span>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              style={{
                display: mobileOpen ? 'inline-flex' : 'none',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Close Navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.section && (
                  <div className="sidebar-section-label">{item.section}</div>
                )}
                <button
                  id={`nav-${item.id}`}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile?.();
                  }}
                >
                  <span className="nav-item-icon"><Icon size={15} /></span>
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

      {/* Footer live status */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            className="sidebar-status-pill"
            style={{ cursor: onModeSwitch ? 'pointer' : 'default' }}
            onClick={() => onModeSwitch?.(isSimulation ? 'REAL_HARDWARE' : 'SIMULATION')}
            title="Click to toggle between Simulation Mode (Priority) and Real Hardware"
          >
            <span
              className={`sidebar-status-dot ${robotStatus} ${isSimulation || esp32Connected ? 'pulse' : ''}`}
              style={isSimulation ? { background: '#60A5FA', boxShadow: '0 0 6px #60A5FA' } : {}}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="sidebar-status-label" style={{ fontSize: '0.68rem' }}>Mode</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: isSimulation ? '#93C5FD' : (esp32Connected ? '#86EFAC' : '#FCA5A5'), letterSpacing: '0.04em' }}>
                  {isSimulation ? 'SIMULATION' : 'HARDWARE'}
                </span>
              </div>
              <span className="sidebar-status-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {robotLabel}
              </span>
            </div>
          </div>
          <div className="sidebar-status-pill">
            <span className={`sidebar-status-dot ${wsConnected ? 'online pulse' : 'offline'}`} />
            <span className="sidebar-status-label">Telemetry</span>
            <span className="sidebar-status-value">{wsConnected ? 'Live' : 'Offline'}</span>
          </div>
          <div className="sidebar-status-pill">
            <span className={`sidebar-status-dot ${cameraOk ? 'online' : 'offline'}`} />
            <span className="sidebar-status-label">Camera</span>
            <span className="sidebar-status-value">
              {cameraOk ? `${telemetry?.camera_status?.fps ?? '?'} FPS` : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </>
  );
};
