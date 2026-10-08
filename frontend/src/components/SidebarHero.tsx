import React from 'react';
import { Scan, Activity, Droplets, Sparkles, Radio } from 'lucide-react';

export const SidebarHero: React.FC = () => {
  return (
    <div className="sidebar-hero-card">
      {/* Animated Subtle AI Laser Scan Line */}
      <div className="sidebar-hero-scanline" />

      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '160px',
        height: '160px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Top Badge: LIVE FIELD MONITORING */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.65rem'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0.22rem 0.65rem',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.15)'
        }}>
          <span className="pulse-indicator green" style={{ width: '6px', height: '6px' }} />
          <span style={{
            fontSize: '0.66rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--emerald-400)',
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            LIVE FIELD MONITORING
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.65rem',
          color: 'var(--text-dim)',
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          <Radio size={11} color="var(--emerald-400)" />
          <span>v2.0 4WD</span>
        </div>
      </div>

      {/* High-Tech AgriGuard Robot SVG Illustration */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        height: '115px',
        borderRadius: '12px',
        background: 'radial-gradient(ellipse at 50% 65%, rgba(16, 185, 129, 0.12) 0%, rgba(6, 12, 20, 0.6) 80%)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.85rem'
      }}>
        {/* Animated Laser Scanning Beam */}
        <div className="laser-sweep-beam" />

        {/* Robot SVG Graphic */}
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '92%', height: '92%', filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.6))' }}
        >
          {/* Ground Grid Reticle */}
          <path d="M40 95 L240 95" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M60 105 L220 105" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M80 85 L200 85" stroke="rgba(16, 185, 129, 0.12)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Holographic Scanning Cone */}
          <polygon
            points="140,38 75,98 205,98"
            fill="url(#scanBeamGrad)"
            opacity="0.35"
          />
          <line x1="75" y1="98" x2="205" y2="98" stroke="var(--emerald-400)" strokeWidth="1.5" strokeOpacity="0.8" />
          <circle cx="140" cy="98" r="16" stroke="var(--emerald-400)" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
          <circle cx="140" cy="98" r="3" fill="var(--emerald-400)" />

          {/* 4WD Heavy-Duty Wheels */}
          {/* Rear-Left Wheel */}
          <rect x="52" y="60" width="18" height="38" rx="4" fill="#0d1520" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <line x1="52" y1="70" x2="70" y2="70" stroke="#1f2937" strokeWidth="1.5" />
          <line x1="52" y1="80" x2="70" y2="80" stroke="#1f2937" strokeWidth="1.5" />
          <line x1="52" y1="90" x2="70" y2="90" stroke="#1f2937" strokeWidth="1.5" />

          {/* Front-Left Wheel */}
          <rect x="80" y="66" width="18" height="38" rx="4" fill="#0f1c2c" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.5" />
          <line x1="80" y1="76" x2="98" y2="76" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="80" y1="86" x2="98" y2="86" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="80" y1="96" x2="98" y2="96" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />

          {/* Rear-Right Wheel */}
          <rect x="210" y="60" width="18" height="38" rx="4" fill="#0d1520" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <line x1="210" y1="70" x2="228" y2="70" stroke="#1f2937" strokeWidth="1.5" />
          <line x1="210" y1="80" x2="228" y2="80" stroke="#1f2937" strokeWidth="1.5" />
          <line x1="210" y1="90" x2="228" y2="90" stroke="#1f2937" strokeWidth="1.5" />

          {/* Front-Right Wheel */}
          <rect x="182" y="66" width="18" height="38" rx="4" fill="#0f1c2c" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.5" />
          <line x1="182" y1="76" x2="200" y2="76" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="182" y1="86" x2="200" y2="86" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="182" y1="96" x2="200" y2="96" stroke="var(--emerald-500)" strokeWidth="1.5" strokeOpacity="0.6" />

          {/* 4WD Chassis Armor Hull */}
          <polygon
            points="76,68 94,48 186,48 204,68 196,82 84,82"
            fill="url(#chassisGrad)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
          />
          {/* Chassis Emerald Glow Trim */}
          <path d="M96 52 L184 52" stroke="var(--emerald-400)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="106" cy="64" r="2.5" fill="var(--sky-400)" />
          <circle cx="174" cy="64" r="2.5" fill="var(--sky-400)" />

          {/* Precision Spray Boom Arms */}
          <line x1="68" y1="62" x2="94" y2="62" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="186" y1="62" x2="212" y2="62" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Spray Nozzles */}
          <rect x="64" y="60" width="5" height="7" rx="1.5" fill="var(--emerald-400)" />
          <rect x="211" y="60" width="5" height="7" rx="1.5" fill="var(--emerald-400)" />
          {/* Fine Spray Particles */}
          <circle cx="66" cy="74" r="1.5" fill="var(--sky-400)" opacity="0.8" />
          <circle cx="64" cy="80" r="1.2" fill="var(--emerald-400)" opacity="0.7" />
          <circle cx="213" cy="74" r="1.5" fill="var(--sky-400)" opacity="0.8" />
          <circle cx="215" cy="80" r="1.2" fill="var(--emerald-400)" opacity="0.7" />

          {/* Central AI Sensor Mast / Turret */}
          <rect x="130" y="32" width="20" height="18" rx="3" fill="#132338" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1.2" />
          {/* Optical Camera Lens Eye */}
          <circle cx="140" cy="38" r="6" fill="#040b14" stroke="var(--emerald-400)" strokeWidth="1.5" />
          <circle cx="140" cy="38" r="3" fill="var(--emerald-400)" />
          <circle cx="142" cy="36" r="1" fill="#fff" />
          {/* LiDAR Ring Top */}
          <ellipse cx="140" cy="27" rx="9" ry="3.5" fill="#1f2937" stroke="var(--sky-400)" strokeWidth="1.2" />
          <circle cx="140" cy="26" r="2" fill="var(--sky-400)" />

          {/* Gradients */}
          <defs>
            <linearGradient id="chassisGrad" x1="140" y1="48" x2="140" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#09101c" />
            </linearGradient>
            <linearGradient id="scanBeamGrad" x1="140" y1="38" x2="140" y2="98" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Main Headlines */}
      <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.85rem' }}>
        <h2 style={{
          fontSize: '1.08rem',
          fontWeight: 800,
          lineHeight: 1.25,
          color: '#fff',
          letterSpacing: '-0.02em',
          margin: '0 0 0.25rem 0'
        }}>
          AI-Powered{' '}
          <span style={{
            background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Precision Farming
          </span>
        </h2>
        <p style={{
          fontSize: '0.74rem',
          fontWeight: 600,
          color: 'var(--emerald-400)',
          letterSpacing: '0.04em',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Detect</span>
          <span style={{ color: 'var(--text-dim)' }}>•</span>
          <span>Diagnose</span>
          <span style={{ color: 'var(--text-dim)' }}>•</span>
          <span>Treat</span>
          <span style={{ color: 'var(--text-dim)' }}>•</span>
          <span>Monitor</span>
        </p>
      </div>

      {/* Three Compact Feature Indicators */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }}>
        {/* Indicator 1: AI Disease Detection */}
        <div className="hero-feature-pill">
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: 'rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Scan size={13} color="var(--emerald-400)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
              AI Disease Detection
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
              Real-time Foliage Pathology
            </div>
          </div>
          <span className="feature-status-dot green" />
        </div>

        {/* Indicator 2: NPK Soil Intelligence */}
        <div className="hero-feature-pill">
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Activity size={13} color="var(--sky-400)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
              NPK Soil Intelligence
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
              RS485 Probe & Moisture Sync
            </div>
          </div>
          <span className="feature-status-dot sky" />
        </div>

        {/* Indicator 3: Precision Spraying */}
        <div className="hero-feature-pill">
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Droplets size={13} color="var(--amber-400)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
              Precision Spraying
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
              Targeted Chemical Dose Delivery
            </div>
          </div>
          <span className="feature-status-dot amber" />
        </div>
      </div>
    </div>
  );
};
