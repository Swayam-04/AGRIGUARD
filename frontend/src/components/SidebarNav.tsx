import React from 'react';
import {
  LayoutDashboard,
  Map,
  Gamepad2,
  Stethoscope,
  Leaf,
  Activity,
  Cpu,
  ScrollText,
  MonitorPlay,
  Crosshair,
  Microscope
} from 'lucide-react';
import { TelemetryData } from '../types';

export type TabId =
  | 'dashboard'
  | 'remote'
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
}

const navItems: { id: TabId; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',             icon: LayoutDashboard, section: 'OPERATIONS' },
  { id: 'remote',        label: 'Field Remote Cockpit',   icon: Gamepad2 },
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
  wsConnected
}) => {
  const esp32Connected = telemetry?.esp32_connected ?? false;
  const isSimulation = telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION';
  const cameraOk = telemetry?.camera_status?.connected ?? false;
  const pingMs = telemetry?.esp32_ping_ms ?? null;

  const robotStatus = isSimulation ? 'warning'
    : esp32Connected ? 'online' : 'offline';
  const robotLabel = isSimulation ? 'Simulation'
    : esp32Connected ? (pingMs ? `${pingMs}ms` : 'Connected') : 'Disconnected';

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Leaf size={18} color="#FFFFFF" />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">AgriGuard</span>
          <span className="sidebar-brand-sub">Greenovators · v2.0</span>
        </div>
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
                onClick={() => setActiveTab(item.id)}
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
          <div className="sidebar-status-pill">
            <span className={`sidebar-status-dot ${robotStatus} ${robotStatus === 'online' ? 'pulse' : ''}`} />
            <span className="sidebar-status-label">Robot</span>
            <span className="sidebar-status-value">{robotLabel}</span>
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
  );
};
