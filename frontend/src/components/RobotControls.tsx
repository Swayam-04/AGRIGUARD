import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Sliders,
  ShieldAlert,
  AlertTriangle,
  Wifi,
  Radio,
  Clock,
  Compass,
  Zap,
  Droplets,
  Lock,
  CheckCircle,
  HelpCircle,
  QrCode,
  Smartphone
} from 'lucide-react';
import { TelemetryData, NetworkStatus } from '../types';
import { sendRobotHeartbeat, fetchNetworkStatus, updateNetworkConfig, fetchHardwareMode, setHardwareMode } from '../services/api';

interface RobotControlsProps {
  telemetry: TelemetryData | null;
  onMove: (direction: string, speed: number, durationMs?: number) => Promise<any>;
  onStop: () => Promise<any>;
  onEmergencyStop: () => Promise<any>;
  onSprayApprove?: (decisionId: string, approved: boolean, operatorName: string) => Promise<any>;
}

export const RobotControls: React.FC<RobotControlsProps> = ({
  telemetry,
  onMove,
  onStop,
  onEmergencyStop,
  onSprayApprove
}) => {
  const [speed, setSpeed] = useState<number>(130);
  const [activeDirection, setActiveDirection] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkStatus | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState<boolean>(false);
  const [customEsp32Ip, setCustomEsp32Ip] = useState<string>('192.168.4.1');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [heartbeatActive, setHeartbeatActive] = useState<boolean>(false);
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState<string>('');
  const [hardwareMode, setHardwareModeState] = useState<'REAL_HARDWARE' | 'SIMULATION'>('REAL_HARDWARE');
  const activeDirectionRef = useRef<string | null>(null);
  const pointerStartTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<any>(null);

  useEffect(() => {
    fetchHardwareMode().then(res => {
      if (res && res.mode) setHardwareModeState(res.mode as any);
    }).catch(() => {});
  }, []);

  const esp32Connected = telemetry?.esp32_connected ?? false;
  const isEStopActive = telemetry?.safety?.emergency_stop ?? false;
  const obstacleDetected = telemetry?.ultrasonic?.obstacle_detected ?? false;
  const obstacleDistance = telemetry?.ultrasonic?.distance_cm ?? null;
  const motorState = telemetry?.actuators?.motor_state ?? 'STOPPED';
  const pumpActive = telemetry?.actuators?.pump_active ?? false;
  const valveOpen = telemetry?.actuators?.valve_open ?? false;
  const flowRate = telemetry?.actuators?.flow_rate_ml_s ?? 0.0;

  // Unified stop helper
  const executeStop = useCallback(async () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setActiveDirection(null);
    activeDirectionRef.current = null;
    try {
      await onStop();
    } catch (e) {
      console.error('Stop command error:', e);
    }
  }, [onStop]);

  // Unified movement helper
  const executeMove = useCallback(async (dir: string, pulseMs: number = 0) => {
    if (isEStopActive) return;
    if (hardwareMode === 'REAL_HARDWARE' && !esp32Connected) {
      console.warn('Real hardware is selected but ESP32 is offline. Motion command blocked.');
      return;
    }
    if (dir === 'stop') {
      await executeStop();
      return;
    }
    setActiveDirection(dir);
    activeDirectionRef.current = dir;
    try {
      await onMove(dir, speed, pulseMs);
    } catch (e) {
      console.error('Movement command error:', e);
    }
  }, [isEStopActive, speed, onMove, executeStop]);

  // Keyboard navigation support (W / A / S / D and Arrow Keys and Spacebar)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (isEStopActive) return;

      let dir: string | null = null;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'forward';
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dir = 'backward';
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'left';
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'right';
      else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        executeStop();
        return;
      }

      if (dir && activeDirectionRef.current !== dir) {
        e.preventDefault();
        executeMove(dir);
      }
    },
    [isEStopActive, executeMove, executeStop]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'];
      if (movementKeys.includes(e.key)) {
        e.preventDefault();
        executeStop();
      }
    },
    [executeStop]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Touch & Pointer command dispatchers (Supports both hold-to-move AND single-click pulse)
  const handlePointerDown = async (direction: string) => {
    if (isEStopActive) return;
    pointerStartTimeRef.current = Date.now();
    await executeMove(direction);
  };

  const handlePointerUp = async (direction?: string) => {
    const elapsed = Date.now() - pointerStartTimeRef.current;
    // If it was a quick click (< 220ms), sustain a 450ms movement pulse so robot visibly moves
    if (elapsed < 220 && direction && direction !== 'stop') {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        if (activeDirectionRef.current === direction) {
          executeStop();
        }
      }, 450);
    } else {
      await executeStop();
    }
  };

  // Nudge / Fine-pulse maneuvering (moves for exact pulse e.g. 250ms)
  const handleNudge = async (direction: string, durationMs: number = 250) => {
    if (isEStopActive) return;
    setActiveDirection(direction);
    activeDirectionRef.current = direction;
    try {
      await onMove(direction, Math.min(speed, 140), durationMs);
      setTimeout(() => {
        if (activeDirectionRef.current === direction) {
          setActiveDirection(null);
          activeDirectionRef.current = null;
        }
      }, durationMs);
    } catch (e) {
      console.error('Nudge command error:', e);
    }
  };

  // Network reconfiguration
  const handleSaveNetworkConfig = async () => {
    try {
      const res = await updateNetworkConfig(customEsp32Ip);
      if (res.ok) {
        setShowNetworkModal(false);
        const updated = await fetchNetworkStatus();
        setNetworkInfo(updated);
      }
    } catch (err) {
      alert('Failed to update ESP32 IP address.');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      
      {/* 1. Header & Operating Mode */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={20} color="var(--emerald-400)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Field Remote Controller
            </h2>
            <span className="status-pill status-online" style={{ fontSize: '0.65rem' }}>
              4WD CHASSIS
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            <strong>Operating Mode:</strong> Remote-controlled from the field site over a local Wi-Fi network.
          </p>
        </div>

        {/* Network & Heartbeat Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Explicit Hardware Mode Switcher */}
          <button
            onClick={async () => {
              const nextMode = hardwareMode === 'REAL_HARDWARE' ? 'SIMULATION' : 'REAL_HARDWARE';
              try {
                await setHardwareMode(nextMode);
                setHardwareModeState(nextMode);
              } catch (e) {
                console.error('Mode switch error:', e);
              }
            }}
            className="btn btn-outline"
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              borderColor: hardwareMode === 'REAL_HARDWARE' ? 'var(--emerald-500)' : 'var(--amber-500)',
              color: hardwareMode === 'REAL_HARDWARE' ? 'var(--emerald-400)' : 'var(--amber-400)'
            }}
            title="Toggle between Real ESP32 Hardware and Simulation Sandbox"
          >
            <span>{hardwareMode === 'REAL_HARDWARE' ? 'REAL HARDWARE' : 'SIMULATION'}</span>
          </button>

          <button
            onClick={() => setShowNetworkModal(true)}
            className="btn btn-outline"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
            title="Configure Local Field Wi-Fi (Option A / Option B)"
          >
            <Wifi size={13} color="var(--emerald-400)" />
            <span>Wi-Fi Setup</span>
          </button>

          <div className={`status-pill ${
            hardwareMode === 'REAL_HARDWARE'
              ? (esp32Connected ? 'status-online' : 'status-offline')
              : 'status-warning'
          }`} style={{ fontSize: '0.7rem' }}>
            <Radio size={12} className={heartbeatActive ? 'animate-pulse' : ''} />
            <span>
              {hardwareMode === 'REAL_HARDWARE'
                ? (esp32Connected ? `CONNECTED ${pingMs ? `(${pingMs}ms)` : ''}` : 'ROBOT OFFLINE')
                : 'SIMULATED ROBOT'}
            </span>
          </div>
        </div>
      </div>

      {/* Minimal Connectivity & Sensor Health Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        padding: '0.4rem 0.75rem',
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1rem',
        fontSize: '0.72rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
          <Wifi size={12} color="var(--emerald-400)" />
          <span>Wi-Fi:</span>
          <strong className="mono" style={{ color: '#fff' }}>{customEsp32Ip || '192.168.4.1'}</strong>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            NPK:{' '}
            <strong style={{ color: telemetry?.npk?.valid ? 'var(--emerald-400)' : 'var(--text-dim)' }}>
              {telemetry?.npk?.valid ? 'ONLINE' : 'OFFLINE'}
            </strong>
          </span>
          <span>
            Soil:{' '}
            <strong style={{ color: ((typeof telemetry?.soil_moisture === 'number' ? telemetry.soil_moisture : telemetry?.soil_moisture?.moisture_pct) != null) ? 'var(--emerald-400)' : 'var(--text-dim)' }}>
              {((typeof telemetry?.soil_moisture === 'number' ? telemetry.soil_moisture : telemetry?.soil_moisture?.moisture_pct) != null) ? 'ONLINE' : 'OFFLINE'}
            </strong>
          </span>
          <span>
            IMU:{' '}
            <strong style={{ color: (telemetry?.imu?.pitch_deg !== null && telemetry?.imu?.valid !== false) ? 'var(--emerald-400)' : 'var(--text-dim)' }}>
              {(telemetry?.imu?.pitch_deg !== null && telemetry?.imu?.valid !== false) ? 'ONLINE' : 'OFFLINE'}
            </strong>
          </span>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            Pump:{' '}
            <strong style={{ color: pumpActive ? 'var(--amber-400)' : 'var(--text-dim)' }}>
              {pumpActive ? 'ON' : 'OFF'}
            </strong>
          </span>
          <span>
            Valve:{' '}
            <strong style={{ color: valveOpen ? 'var(--amber-400)' : 'var(--text-dim)' }}>
              {valveOpen ? 'OPEN' : 'CLOSED'}
            </strong>
          </span>
        </div>
      </div>

      {/* 2. Hardware Safety & Proximity Banners */}
      {isEStopActive && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid var(--rose-500)',
          color: '#fff',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <ShieldAlert size={20} color="var(--rose-500)" />
          <div>
            <strong>PHYSICAL EMERGENCY STOP ENGAGED:</strong>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)' }}>
              Hardware safety switch is tripped. All motor PWM and chemical pump actuation are hardware locked.
            </div>
          </div>
        </div>
      )}

      {obstacleDetected && !isEStopActive && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.6rem 0.85rem',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid var(--amber-400)',
          color: '#fff',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <AlertTriangle size={18} color="var(--amber-400)" />
          <div>
            <strong>Obstacle Detected ({obstacleDistance ? `${obstacleDistance.toFixed(1)} cm` : '< 25 cm'}):</strong>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginLeft: '4px' }}>
              Forward motion proximity limit reached. Steer clear or reverse.
            </span>
          </div>
        </div>
      )}

      {/* 3. Ergonomic Touch D-Pad & Instant Stop */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* State strip */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '320px',
          marginBottom: '0.85rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>
            Active State:{' '}
            <strong className="mono" style={{
              color: activeDirection ? 'var(--emerald-400)' : (motorState !== 'STOPPED' ? 'var(--emerald-400)' : '#fff'),
              textShadow: activeDirection ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
            }}>
              {activeDirection ? activeDirection.toUpperCase() : motorState}
            </strong>
          </span>
          <span>Watchdog: <strong className="mono" style={{ color: 'var(--sky-400)' }}>1500ms Active</strong></span>
        </div>

        {/* 3x3 D-Pad Matrix (Touch-action optimized for smartphones) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 80px)',
            gridTemplateRows: 'repeat(3, 80px)',
            gap: '12px',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          {/* Top Left Empty */}
          <div />

          {/* FORWARD */}
          <button
            onPointerDown={() => handlePointerDown('forward')}
            onPointerUp={() => handlePointerUp('forward')}
            onPointerLeave={() => handlePointerUp()}
            onPointerCancel={() => handlePointerUp()}
            onClick={(e) => {
              e.preventDefault();
              if (!activeDirectionRef.current) {
                handleNudge('forward', 450);
              }
            }}
            disabled={isEStopActive}
            style={{
              background: activeDirection === 'forward' ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.08)',
              color: activeDirection === 'forward' ? '#000' : '#fff',
              border: `2px solid ${activeDirection === 'forward' ? 'var(--emerald-400)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEStopActive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeDirection === 'forward' ? '0 0 20px var(--emerald-glow)' : 'none',
              touchAction: 'none'
            }}
            title="Drive Forward (Click or Hold W / Up Arrow)"
          >
            <ArrowUp size={30} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>FWD</span>
          </button>

          {/* Top Right Empty */}
          <div />

          {/* LEFT */}
          <button
            onPointerDown={() => handlePointerDown('left')}
            onPointerUp={() => handlePointerUp('left')}
            onPointerLeave={() => handlePointerUp()}
            onPointerCancel={() => handlePointerUp()}
            onClick={(e) => {
              e.preventDefault();
              if (!activeDirectionRef.current) {
                handleNudge('left', 450);
              }
            }}
            disabled={isEStopActive}
            style={{
              background: activeDirection === 'left' ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.08)',
              color: activeDirection === 'left' ? '#000' : '#fff',
              border: `2px solid ${activeDirection === 'left' ? 'var(--emerald-400)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEStopActive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeDirection === 'left' ? '0 0 20px var(--emerald-glow)' : 'none',
              touchAction: 'none'
            }}
            title="Turn Left (Click or Hold A / Left Arrow)"
          >
            <ArrowLeft size={30} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>LEFT</span>
          </button>

          {/* CENTER HARD STOP */}
          <button
            onClick={(e) => {
              e.preventDefault();
              executeStop();
            }}
            disabled={isEStopActive}
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.4) 0%, rgba(185, 28, 28, 0.6) 100%)',
              color: '#fff',
              border: '2px solid var(--rose-500)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEStopActive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
            }}
            title="Instant Stop (Click or Spacebar)"
          >
            <Square size={26} color="#fff" />
            <span style={{ fontSize: '0.75rem', fontWeight: 900, marginTop: '2px', letterSpacing: '0.05em' }}>STOP</span>
          </button>

          {/* RIGHT */}
          <button
            onPointerDown={() => handlePointerDown('right')}
            onPointerUp={() => handlePointerUp('right')}
            onPointerLeave={() => handlePointerUp()}
            onPointerCancel={() => handlePointerUp()}
            onClick={(e) => {
              e.preventDefault();
              if (!activeDirectionRef.current) {
                handleNudge('right', 450);
              }
            }}
            disabled={isEStopActive}
            style={{
              background: activeDirection === 'right' ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.08)',
              color: activeDirection === 'right' ? '#000' : '#fff',
              border: `2px solid ${activeDirection === 'right' ? 'var(--emerald-400)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEStopActive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeDirection === 'right' ? '0 0 20px var(--emerald-glow)' : 'none',
              touchAction: 'none'
            }}
            title="Turn Right (Click or Hold D / Right Arrow)"
          >
            <ArrowRight size={30} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>RIGHT</span>
          </button>

          {/* Bottom Left Empty */}
          <div />

          {/* REVERSE */}
          <button
            onPointerDown={() => handlePointerDown('backward')}
            onPointerUp={() => handlePointerUp('backward')}
            onPointerLeave={() => handlePointerUp()}
            onPointerCancel={() => handlePointerUp()}
            onClick={(e) => {
              e.preventDefault();
              if (!activeDirectionRef.current) {
                handleNudge('backward', 450);
              }
            }}
            disabled={isEStopActive}
            style={{
              background: activeDirection === 'backward' ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.08)',
              color: activeDirection === 'backward' ? '#000' : '#fff',
              border: `2px solid ${activeDirection === 'backward' ? 'var(--emerald-400)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEStopActive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeDirection === 'backward' ? '0 0 20px var(--emerald-glow)' : 'none',
              touchAction: 'none'
            }}
            title="Drive Backward (Click or Hold S / Down Arrow)"
          >
            <ArrowDown size={30} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>REV</span>
          </button>

          {/* Bottom Right Empty */}
          <div />
        </div>

        {/* Laptop keyboard hint */}
        <div style={{ marginTop: '0.85rem', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center' }}>
          Keyboard controls: <span className="mono">W / A / S / D</span> or <span className="mono">Arrow Keys</span> &bull; <span className="mono">Space</span> for STOP
        </div>
      </div>

      {/* 4. Fine-Movement Pulse Controls (For precision field crop alignment) */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        padding: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Fine Pulse Maneuvering (250ms Precision Nudge):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button
            onClick={() => handleNudge('forward', 250)}
            disabled={isEStopActive}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
          >
            Nudge FWD
          </button>
          <button
            onClick={() => handleNudge('backward', 250)}
            disabled={isEStopActive}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
          >
            Nudge REV
          </button>
          <button
            onClick={() => handleNudge('left', 250)}
            disabled={isEStopActive}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
          >
            Nudge LEFT
          </button>
          <button
            onClick={() => handleNudge('right', 250)}
            disabled={isEStopActive}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
          >
            Nudge RIGHT
          </button>
        </div>
      </div>

      {/* 5. Speed Throttle Slider & Presets */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Motor Drive Speed (PWM):</span>
          <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
            {speed} / 255 PWM
          </span>
        </div>

        <input
          type="range"
          min="80"
          max="255"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          disabled={!esp32Connected || isEStopActive}
          style={{ width: '100%', accentColor: 'var(--emerald-500)', cursor: 'pointer' }}
        />

        {/* Speed Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '0.5rem' }}>
          <button
            onClick={() => setSpeed(90)}
            className="btn btn-outline"
            style={{ padding: '0.25rem', fontSize: '0.65rem', background: speed === 90 ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            Creep (90)
          </button>
          <button
            onClick={() => setSpeed(130)}
            className="btn btn-outline"
            style={{ padding: '0.25rem', fontSize: '0.65rem', background: speed === 130 ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            Scout (130)
          </button>
          <button
            onClick={() => setSpeed(180)}
            className="btn btn-outline"
            style={{ padding: '0.25rem', fontSize: '0.65rem', background: speed === 180 ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            Transit (180)
          </button>
          <button
            onClick={() => setSpeed(255)}
            className="btn btn-outline"
            style={{ padding: '0.25rem', fontSize: '0.65rem', background: speed === 255 ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}
          >
            Max (255)
          </button>
        </div>
      </div>

      {/* 6. Protected Chemical Spray Actuation Gate */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Droplets size={16} color="var(--amber-400)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
              Precision Spray Actuation (Protected)
            </span>
          </div>
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: pumpActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            color: pumpActive ? 'var(--emerald-400)' : 'var(--text-dim)',
            fontWeight: 700
          }}>
            {pumpActive ? 'ACTUATING' : 'LOCKED'}
          </span>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
          Chemical spray requires formal AI diagnosis and on-site farmer approval. Spray buttons cannot be triggered in driving mode without verified prescription.
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.7rem',
          color: 'var(--text-dim)',
          paddingTop: '0.4rem',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <span>Pump State: <strong style={{ color: pumpActive ? 'var(--emerald-400)' : '#fff' }}>{pumpActive ? 'ACTIVE' : 'OFF'}</strong></span>
          <span>Solenoid Valve: <strong style={{ color: valveOpen ? 'var(--emerald-400)' : '#fff' }}>{valveOpen ? 'OPEN' : 'CLOSED'}</strong></span>
          <span>Flow Rate: <strong className="mono" style={{ color: flowRate > 0 ? 'var(--emerald-400)' : '#fff' }}>{flowRate.toFixed(1)} mL/s</strong></span>
        </div>
      </div>

      {/* 7. Local Field Wi-Fi Configuration Modal */}
      {showNetworkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '1.5rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-active)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wifi size={20} color="var(--emerald-400)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Field-Site Local Wi-Fi Setup
                </h3>
              </div>
              <button
                onClick={() => setShowNetworkModal(false)}
                className="btn btn-outline"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              AgriGuard operates <strong>without internet connectivity</strong> over a local wireless network in the field.
            </div>

            {/* Option A: Direct SoftAP */}
            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              marginBottom: '0.75rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--emerald-400)', fontSize: '0.82rem', marginBottom: '4px' }}>
                Option A: Connect to Robot Wi-Fi Hotspot (Direct SoftAP)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fff' }}>
                <div>Network SSID: <strong className="mono" style={{ color: 'var(--emerald-400)' }}>AgriGuard-Robot</strong></div>
                <div>Password: <strong className="mono">agri12345</strong></div>
                <div>Default ESP32 IP: <strong className="mono">192.168.4.1</strong></div>
              </div>
            </div>

            {/* Option B: Field Local Router */}
            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginBottom: '1rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--sky-400)', fontSize: '0.82rem', marginBottom: '4px' }}>
                Option B: Local Field Router / Phone Mobile Hotspot
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fff' }}>
                <div>Laptop LAN IP: <strong className="mono" style={{ color: 'var(--sky-400)' }}>{networkInfo?.laptop_lan_ip ?? '192.168.1.x'}</strong></div>
                <div>Smartphone Dashboard URL: <strong className="mono" style={{ color: '#fff' }}>{networkInfo?.dashboard_mobile_url ?? 'http://192.168.1.x:8000'}</strong></div>
              </div>
            </div>

            {/* Custom IP Configuration */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Target ESP32 IP Address:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={customEsp32Ip}
                  onChange={(e) => setCustomEsp32Ip(e.target.value)}
                  placeholder="192.168.4.1"
                  className="mono"
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  onClick={handleSaveNetworkConfig}
                  className="btn btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                >
                  Save & Connect
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNetworkModal(false)}
                className="btn btn-outline"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
