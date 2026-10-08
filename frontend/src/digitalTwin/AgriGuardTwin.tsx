import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Eye,
  RotateCcw,
  Compass,
  Move,
  Droplets,
  AlertTriangle,
  Radio,
  Zap,
  Layers,
  Thermometer,
  Droplet,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { TwinSceneManager } from './TwinScene';
import { CameraViewPreset, TWIN_LEGEND, SAFETY_THRESHOLDS } from './types';
import { TelemetryData } from '../types';

interface AgriGuardTwinProps {
  telemetry: TelemetryData | null;
}

export const AgriGuardTwin: React.FC<AgriGuardTwinProps> = ({ telemetry }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<TwinSceneManager | null>(null);
  const queryPreset = (new URLSearchParams(window.location.search).get('view') as CameraViewPreset) || 'isometric';
  const [activeView, setActiveView] = useState<CameraViewPreset>(queryPreset);
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // Initialize Three.js WebGL Scene on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new TwinSceneManager(containerRef.current);
    sceneManagerRef.current = manager;

    if (queryPreset !== 'isometric') {
      manager.setView(queryPreset);
    }

    // Handle responsive window resize
    const handleResize = () => {
      manager.resize();
    };
    window.addEventListener('resize', handleResize);

    // Initial telemetry feed
    manager.updateTelemetry(telemetry);

    return () => {
      window.removeEventListener('resize', handleResize);
      manager.destroy();
      sceneManagerRef.current = null;
    };
  }, []);

  // Pass latest telemetry directly to Three.js loop without re-instantiating scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateTelemetry(telemetry);
    }
  }, [telemetry]);

  const handleSetView = (preset: CameraViewPreset) => {
    setActiveView(preset);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setView(preset);
    }
  };

  // Derive High-Level Telemetry States
  const isSimulation = telemetry?.mode === 'SIMULATION' || telemetry?.hardware_mode === 'SIMULATION';
  const isConnected = isSimulation ? true : Boolean(telemetry?.esp32_connected);

  const movement = (telemetry?.movement || telemetry?.actuators?.motor_state || 'STOP').toUpperCase();

  const us = telemetry?.ultrasonic;
  const centerDist = us?.center != null ? Number(us.center) : (us?.distance_cm != null ? us.distance_cm : (isConnected ? 50 : null));
  const leftDist = us?.left != null ? Number(us.left) : (isConnected ? 70 : null);
  const rightDist = us?.right != null ? Number(us.right) : (isConnected ? 80 : null);

  const minDistance = centerDist != null ? Math.min(centerDist, leftDist ?? 999, rightDist ?? 999) : 999;
  const isObstacleDetected = isConnected && minDistance < SAFETY_THRESHOLDS.OBSTACLE_CM;

  const pumpState = telemetry?.pump?.state || (telemetry?.actuators?.pump_active ? 'ON' : 'OFF');
  const isSpraying = isConnected && pumpState === 'ON';

  const mpu = telemetry?.mpu6050 || telemetry?.imu;
  const pitchDeg = mpu?.pitch_deg != null ? Number(mpu.pitch_deg).toFixed(1) : (isConnected ? '0.0' : '--');
  const rollDeg = mpu?.roll_deg != null ? Number(mpu.roll_deg).toFixed(1) : (isConnected ? '0.0' : '--');

  const soilMoisture = telemetry?.soil_moisture != null
    ? (typeof telemetry.soil_moisture === 'number' ? telemetry.soil_moisture.toFixed(1) : (telemetry.soil_moisture.moisture_pct?.toFixed(1) ?? '--'))
    : '--';

  const tempC = telemetry?.dht22?.temperature ?? telemetry?.environment?.temperature_c;
  const humPct = telemetry?.dht22?.humidity ?? telemetry?.environment?.humidity_pct;

  const npk = telemetry?.npk;
  const npkN = npk?.n ?? npk?.nitrogen_mg_kg;
  const npkP = npk?.p ?? npk?.phosphorus_mg_kg;
  const npkK = npk?.k ?? npk?.potassium_mg_kg;

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ── Header Row ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.85rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)'
          }}>
            <Boxes size={20} color="var(--emerald-400)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.01em' }}>
                AGRI GUARD DIGITAL TWIN
              </h2>
              {isSimulation ? (
                <span className="status-pill" style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--sky-400)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  fontSize: '0.64rem',
                  padding: '0.15rem 0.45rem',
                  fontWeight: 800
                }}>
                  SIMULATION DATA
                </span>
              ) : isConnected ? (
                <span className="status-pill status-online" style={{ fontSize: '0.64rem', padding: '0.15rem 0.45rem', fontWeight: 800 }}>
                  REAL HARDWARE LIVE
                </span>
              ) : (
                <span className="status-pill status-offline" style={{ fontSize: '0.64rem', padding: '0.15rem 0.45rem', fontWeight: 800 }}>
                  DIGITAL TWIN OFFLINE
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
              Live 3D Engineering Representation & Kinematic Twin of the Physical Prototype
            </p>
          </div>
        </div>

        {/* View Presets & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, marginRight: '0.2rem' }}>
            View:
          </span>
          {([
            { id: 'isometric', label: 'Isometric' },
            { id: 'top', label: 'Top (Deck)' },
            { id: 'front', label: 'Front (Gantry)' },
            { id: 'side', label: 'Side (Profile)' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSetView(id)}
              className="btn"
              style={{
                padding: '0.25rem 0.65rem',
                fontSize: '0.7rem',
                fontWeight: activeView === id ? 800 : 600,
                borderRadius: '6px',
                background: activeView === id ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.05)',
                color: activeView === id ? '#05080f' : 'var(--text-muted)',
                border: activeView === id ? '1px solid var(--emerald-400)' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleSetView('isometric')}
            title="Reset to default camera orientation"
            className="btn btn-outline"
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'var(--text-muted)'
            }}
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* ── 3D Viewport Box ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '460px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(5, 8, 15, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.6)'
      }}>

        {/* Three.js Canvas Container */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'grab'
          }}
        />

        {/* ── Top-Left HUD: Movement & Kinematics ─────────────────────────────── */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          pointerEvents: 'none'
        }}>
          {/* Movement Badge */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: movement !== 'STOP' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: movement !== 'STOP' ? 'var(--emerald-400)' : 'var(--text-muted)'
            }}>
              {movement === 'FORWARD' && <ArrowUp size={15} />}
              {movement === 'BACKWARD' && <ArrowDown size={15} />}
              {movement === 'LEFT' && <ArrowLeft size={15} />}
              {movement === 'RIGHT' && <ArrowRight size={15} />}
              {movement === 'STOP' && <Square size={13} />}
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Mobility State
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: movement !== 'STOP' ? 'var(--emerald-400)' : '#fff' }}>
                {movement}
              </div>
            </div>
          </div>

          {/* Precision Sprayer Badge */}
          <div style={{
            background: isSpraying ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 23, 42, 0.85)',
            
            border: `1px solid ${isSpraying ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isSpraying ? '0 0 15px rgba(6, 182, 212, 0.3)' : '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            <Droplets size={16} color={isSpraying ? 'var(--cyan-400)' : 'var(--text-dim)'} className={isSpraying ? 'pulse' : ''} />
            <div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Spray Nozzle
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: isSpraying ? 'var(--cyan-400)' : 'var(--text-muted)' }}>
                {isSpraying ? 'SPRAY ACTIVE (Atomizing)' : 'SPRAY READY (Idle)'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Top-Right HUD: Proximity Radar & Obstacle Warning ───────────────── */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          pointerEvents: 'none'
        }}>
          {/* Obstacle Alert Banner if triggered */}
          {isObstacleDetected && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.25)',
              
              border: '1px solid var(--rose-500)',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontSize: '0.74rem',
              fontWeight: 800,
              boxShadow: '0 0 18px rgba(244, 63, 94, 0.4)'
            }}>
              <AlertTriangle size={15} color="var(--rose-400)" />
              <span>OBSTACLE DETECTED ({minDistance.toFixed(0)} cm)</span>
            </div>
          )}

          {/* Ultrasonic Tri-Zone Proximity HUD */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            gap: '12px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.60rem', color: 'var(--text-dim)', fontWeight: 700 }}>LEFT</div>
              <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>
                {leftDist != null ? `${leftDist.toFixed(0)}cm` : '--'}
              </div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
              <div style={{ fontSize: '0.60rem', color: isObstacleDetected ? 'var(--rose-400)' : 'var(--text-dim)', fontWeight: 800 }}>CENTER</div>
              <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 800, color: isObstacleDetected ? 'var(--rose-400)' : 'var(--amber-400)' }}>
                {centerDist != null ? `${centerDist.toFixed(0)}cm` : '--'}
              </div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
              <div style={{ fontSize: '0.60rem', color: 'var(--text-dim)', fontWeight: 700 }}>RIGHT</div>
              <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>
                {rightDist != null ? `${rightDist.toFixed(0)}cm` : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom-Left HUD: IMU Incline & Battery ──────────────────────────── */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          display: 'flex',
          gap: '8px',
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '5px 9px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem'
          }}>
            <Compass size={14} color="var(--emerald-400)" />
            <span style={{ color: 'var(--text-dim)' }}>IMU Tilt:</span>
            <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
              P: {pitchDeg}° | R: {rollDeg}°
            </span>
          </div>

          {telemetry?.battery_voltage && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '5px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem'
            }}>
              <Zap size={14} color="var(--sky-400)" />
              <span className="mono" style={{ color: 'var(--sky-400)', fontWeight: 800 }}>
                {telemetry.battery_voltage.toFixed(1)}V
              </span>
            </div>
          )}
        </div>

        {/* ── Bottom-Right HUD: Microclimate & Agronomic Sensors ──────────────── */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          gap: '8px',
          pointerEvents: 'none'
        }}>
          {/* Soil Moisture */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '5px 9px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem'
          }}>
            <Droplet size={13} color="var(--sky-400)" />
            <span style={{ color: 'var(--text-dim)' }}>Soil:</span>
            <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>{soilMoisture}%</span>
          </div>

          {/* Microclimate Temp / Humidity */}
          {tempC != null && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '5px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem'
            }}>
              <Thermometer size={13} color="var(--amber-400)" />
              <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                {Number(tempC).toFixed(1)}°C · {humPct != null ? `${Number(humPct).toFixed(0)}%` : ''}
              </span>
            </div>
          )}

          {/* RS485 NPK Sensor */}
          {npkN != null && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '5px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem'
            }}>
              <Activity size={13} color="var(--pink-400)" />
              <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                NPK: {npkN}-{npkP}-{npkK}
              </span>
            </div>
          )}
        </div>

        {/* Offline Overlay if Disconnected in Real Hardware Mode */}
        {!isConnected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.75)',
            
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Radio size={28} color="var(--rose-400)" />
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--rose-400)' }}>
              DIGITAL TWIN OFFLINE
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, maxWidth: '320px', textAlign: 'center' }}>
              Physical robot communication is disconnected. Reconnect via Wi-Fi or Bluetooth in the Connectivity Panel to resume live kinematic streaming.
            </p>
          </div>
        )}
      </div>

      {/* ── Engineering Subsystem Legend ────────────────────────────────────── */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.55rem 0.85rem',
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>
          <Layers size={14} color="var(--emerald-400)" />
          <span>PROTOTYPE SUBSYSTEMS:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {TWIN_LEGEND.map((item) => (
            <div
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.70rem' }}
              title={item.description}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: item.color,
                boxShadow: `0 0 6px ${item.color}`
              }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
