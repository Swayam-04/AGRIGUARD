import React from 'react';
import { LayoutDashboard, Gamepad2, Map, Stethoscope, ChevronRight, Wifi, ShieldAlert, Cpu, Microscope } from 'lucide-react';
import { TelemetryData } from '../types';

interface SidebarNavProps {
  activeTab: 'dashboard' | 'remote' | 'diagnostics' | 'heatmap';
  setActiveTab: (tab: 'dashboard' | 'remote' | 'diagnostics' | 'heatmap') => void;
  telemetry: TelemetryData | null;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  telemetry
}) => {
  const esp32Connected = telemetry?.esp32_connected ?? false;
  const isEStopActive = telemetry?.safety?.emergency_stop ?? false;
  const activeZone = telemetry?.active_zone_id ?? 'ZONE-R1C1';

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard Cockpit',
      desc: 'Live Camera & Diagnostics',
      icon: LayoutDashboard,
      badge: 'MAIN'
    },
    {
      id: 'remote' as const,
      label: 'Field Remote & Crop AI',
      desc: 'Teleoperation & Leaf Pathology',
      icon: Gamepad2,
      badge: esp32Connected ? 'READY' : 'OFFLINE'
    },

    {
      id: 'heatmap' as const,
      label: 'Field Heatmap',
      desc: '24-Zone Spatial Grid',
      icon: Map,
      badge: 'GRID'
    },
    {
      id: 'diagnostics' as const,
      label: 'Diagnostics',
      desc: 'Hardware Self-Test Bus',
      icon: Stethoscope,
      badge: 'HIL'
    }
  ];


  return (
    <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-dim)',
        marginBottom: '0.15rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>Navigation Console</span>
        <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--emerald-400)' }}>
          {activeZone}
        </span>
      </div>

      {/* Nav List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                borderRadius: '10px',
                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 78, 59, 0.25) 100%)'
                  : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: isActive ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#000' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IconComponent size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? '#fff' : '#f1f5f9' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                    {item.desc}
                  </div>
                </div>
              </div>

              <ChevronRight
                size={14}
                color={isActive ? 'var(--emerald-400)' : 'var(--text-dim)'}
                style={{ transform: isActive ? 'translateX(2px)' : 'none', transition: 'transform 0.2s ease' }}
              />
            </button>
          );
        })}
      </nav>

      {/* Mini Robot Telemetry Status in Sidebar */}
      <div style={{
        marginTop: '0.4rem',
        padding: '0.65rem 0.75rem',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Robot Chassis</span>
          <span style={{
            color: esp32Connected ? 'var(--emerald-400)' : 'var(--rose-500)',
            fontWeight: 700,
            fontSize: '0.7rem'
          }}>
            {esp32Connected ? '● CONNECTED' : '○ DISCONNECTED'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Safety Interlock</span>
          <span style={{
            color: isEStopActive ? 'var(--rose-500)' : 'var(--emerald-400)',
            fontWeight: 700,
            fontSize: '0.7rem'
          }}>
            {isEStopActive ? 'TRIPPED' : 'ARMED (OK)'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Current Zone</span>
          <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>
            {activeZone}
          </span>
        </div>
      </div>
    </div>
  );
};
