/**
 * SidebarHero.tsx
 * In the new layout this is no longer shown in a sidebar (which is now dark/green).
 * It has been repurposed as the Dashboard "About This System" info card
 * shown below the KPI row, providing mission context.
 */
import React from 'react';
import { Scan, Activity, Droplets, Leaf } from 'lucide-react';

export const SidebarHero: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <div className="card-icon"><Leaf size={14} /></div>
          AgriGuard Platform
        </div>
        <span className="badge badge-green">AI-Powered</span>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.6 }}>
          Autonomous precision agricultural robot with real-time disease detection, NPK soil analysis, and targeted chemical treatment delivery.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="hero-feature-pill">
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Scan size={13} color="var(--green-700)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Disease Detection</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Real-time foliage pathology analysis</div>
            </div>
            <span className="feature-status-dot green" />
          </div>

          <div className="hero-feature-pill">
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={13} color="var(--sky-400)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>NPK Soil Intelligence</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RS485 probe & moisture sync</div>
            </div>
            <span className="feature-status-dot sky" />
          </div>

          <div className="hero-feature-pill">
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Droplets size={13} color="var(--warning)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Precision Spraying</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Targeted chemical dose delivery</div>
            </div>
            <span className="feature-status-dot amber" />
          </div>
        </div>
      </div>
    </div>
  );
};
