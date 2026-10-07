/**
 * AgriGuard Digital Twin & 3D Farm Simulator — SimulatedViewPage
 *
 * Visually & ergonomically designed to match the realistic working agricultural field reference:
 * - Full-height 3D farm viewport with AgriGuard prototype rover & volumetric radar cones
 * - Top Bar: Simulated Farm View, Scenario presets, Simulation speed pills (0.5x, 1x, 2x), Reset Field
 * - Top-Left: Ultrasonic Proximity card (Left / Center / Right with warning banner)
 * - Middle-Left: Robot Camera View (Live simulated FPV feed from front bumper)
 * - Bottom-Left: AI Crop Analysis card (Plant Detected, Early Blight 92.4%, View Details, Request Treatment)
 * - Top-Right: 2D Field Map (6 structured crop rows, color-coded health dots, robot position & heading cone)
 * - Bottom-Row:
 *   - Robot Controls (D-Pad + Pump / Relay indicators)
 *   - Robot Telemetry (Live Soil Moisture, NPK, Temperature, Humidity, IMU)
 *   - Environmental Impact (Conventional vs AgriGuard comparison, Avoided CO2e, SIMULATION / ESTIMATE)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Leaf,
  RotateCcw,
  Compass,
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
  ShieldAlert,
  Volume2,
  VolumeX,
  Camera,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  Info,
  Scan,
  Maximize2,
  Eye,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { FarmScene, SimCameraMode } from './FarmScene';
import { SimulatorManager, SIMULATOR_ZONES } from './SimulatorManager';
import {
  FarmPlant,
  ScenarioPresetId,
  SimulationMovementCommand,
  SimulatorLogEvent,
  SimulatorTelemetry,
  CarbonImpactModel,
} from './types';
import { carbonCalculator } from './CarbonEngine';
import { buzzerAudio } from './BuzzerAudio';
import { SAFETY_THRESHOLDS } from '../digitalTwin/types';

export const SimulatedViewPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bumperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<FarmScene | null>(null);
  const managerRef = useRef<SimulatorManager | null>(null);

  // Live Simulation State
  const [telemetry, setTelemetry] = useState<SimulatorTelemetry | null>(null);
  const [logs, setLogs] = useState<SimulatorLogEvent[]>([]);
  const [activePreset, setActivePreset] = useState<ScenarioPresetId>('NORMAL_FIELD');
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [operatorName, setOperatorName] = useState<string>('Swayam-Lead');
  const [cameraMode, setCameraMode] = useState<SimCameraMode>('FOLLOW');

  // Modals & Panels
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedPlant, setSelectedPlant] = useState<FarmPlant | null>(null);

  // Carbon Intelligence State
  const [carbonImpact, setCarbonImpact] = useState<CarbonImpactModel>(() => carbonCalculator.calculate());

  useEffect(() => {
    const unsub = carbonCalculator.subscribe((newImpact) => {
      setCarbonImpact(newImpact);
    });
    return () => unsub();
  }, []);

  // Initialize Simulator on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new FarmScene(containerRef.current);
    const manager = new SimulatorManager(scene);

    sceneRef.current = scene;
    managerRef.current = manager;

    // Connect Bumper Camera canvas if available
    if (bumperCanvasRef.current) {
      scene.setBumperCanvas(bumperCanvasRef.current);
    }

    manager.setCallbacks(
      (newTel) => setTelemetry(newTel),
      (newLogs) => setLogs(newLogs)
    );

    const handleResize = () => scene.resize();
    window.addEventListener('resize', handleResize);

    // Keyboard Movement Listener (W/A/S/D and Arrow Keys) with active keys tracking
    const activeKeys = new Set<string>();

    const updateMovementFromKeys = () => {
      const linearSpeedMps = (manager.getSpeedPwm() / 255.0) * 1.35;
      const angularSpeedRps = 1.35;

      const isUp = activeKeys.has('w') || activeKeys.has('W') || activeKeys.has('ArrowUp');
      const isDown = activeKeys.has('s') || activeKeys.has('S') || activeKeys.has('ArrowDown');
      const isLeft = activeKeys.has('a') || activeKeys.has('A') || activeKeys.has('ArrowLeft');
      const isRight = activeKeys.has('d') || activeKeys.has('D') || activeKeys.has('ArrowRight');

      let linear = 0;
      let turn = 0;

      if (isUp && !isDown) linear = linearSpeedMps;
      else if (isDown && !isUp) linear = -linearSpeedMps * 0.75;

      if (isLeft && !isRight) {
        // If driving forward/backward, turn smoothly along an arc (0.8x rate)
        turn = linear !== 0 ? -angularSpeedRps * 0.8 : -angularSpeedRps;
      } else if (isRight && !isLeft) {
        turn = linear !== 0 ? angularSpeedRps * 0.8 : angularSpeedRps;
      }

      if (linear === 0 && turn === 0) {
        manager.move('STOP');
      } else if (linear !== 0 && turn === 0) {
        manager.move(linear > 0 ? 'FORWARD' : 'BACKWARD');
      } else if (linear === 0 && turn !== 0) {
        manager.move(turn < 0 ? 'LEFT' : 'RIGHT');
      } else {
        // Combined arc steering
        manager.steerCombined(linear, turn);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      buzzerAudio.unlockAudio();
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const movementKeys = ['w', 'W', 's', 'S', 'a', 'A', 'd', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (movementKeys.includes(e.key)) {
        e.preventDefault();
        activeKeys.add(e.key);
        updateMovementFromKeys();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        activeKeys.clear();
        manager.move('STOP');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const movementKeys = ['w', 'W', 's', 'S', 'a', 'A', 'd', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (movementKeys.includes(e.key)) {
        e.preventDefault();
        activeKeys.delete(e.key);
        activeKeys.delete(e.key.toLowerCase());
        activeKeys.delete(e.key.toUpperCase());
        updateMovementFromKeys();
      }
    };

    const handleBlur = () => {
      activeKeys.clear();
      manager.move('STOP');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      manager.dispose();
      scene.destroy();
      sceneRef.current = null;
      managerRef.current = null;
    };
  }, []);

  // Update Bumper Canvas ref when element mounts
  useEffect(() => {
    if (bumperCanvasRef.current && sceneRef.current) {
      sceneRef.current.setBumperCanvas(bumperCanvasRef.current);
    }
  }, [bumperCanvasRef.current]);

  // Render 2D Top-Down Aerial Field Map
  useEffect(() => {
    const canvas = fieldMapCanvasRef.current;
    if (!canvas || !sceneRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Field bounds: X from -13 to +13 (26m), Z from -20 to +20 (40m)
    const fieldW = 26.0;
    const fieldL = 40.0;

    const toMapX = (worldX: number) => ((worldX + 13.0) / fieldW) * w;
    const toMapY = (worldZ: number) => ((worldZ + 20.0) / fieldL) * h;

    // 1. Draw Field Soil Background
    ctx.fillStyle = '#1e140d';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Tilled Crop Row Furrow Lines
    const rowXCoords = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    ctx.strokeStyle = 'rgba(74, 53, 37, 0.65)';
    ctx.lineWidth = 14;
    rowXCoords.forEach((rx) => {
      const mx = toMapX(rx);
      ctx.beginPath();
      ctx.moveTo(mx, toMapY(-16.0));
      ctx.lineTo(mx, toMapY(16.0));
      ctx.stroke();
    });

    // 3. Draw Plants as Color-Coded Dots
    const plants = sceneRef.current.plants;
    plants.forEach((p) => {
      const px = toMapX(p.position.x);
      const py = toMapY(p.position.z);

      let color = '#22c55e'; // Green Healthy
      if (p.state === 'WARNING') color = '#eab308'; // Yellow Warning
      if (p.state === 'DISEASED') color = '#ef4444'; // Red Diseased
      if (p.state === 'TREATED') color = '#a855f7'; // Purple Treated

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw Obstacles (Grey Dots)
    ctx.fillStyle = '#94a3b8';
    // Boulder at X: 0.92, Z: -2.2
    ctx.beginPath();
    ctx.arc(toMapX(0.92), toMapY(-2.2), 5.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Robot Marker & Heading Flashlight Cone
    if (telemetry) {
      const rx = toMapX(telemetry.position.x);
      const ry = toMapY(telemetry.position.z);
      const headingRad = (telemetry.headingDeg * Math.PI) / 180;

      // Heading forward direction: (sin(h), -cos(h))
      const fwdX = Math.sin(headingRad);
      const fwdY = -Math.cos(headingRad);

      // Flashlight Field of View Cone
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      const coneLen = 32;
      const spread = 0.5;
      ctx.lineTo(rx + Math.sin(headingRad - spread) * coneLen, ry - Math.cos(headingRad - spread) * coneLen);
      ctx.lineTo(rx + Math.sin(headingRad + spread) * coneLen, ry - Math.cos(headingRad + spread) * coneLen);
      ctx.closePath();
      ctx.fill();

      // Robot Body Dot
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 6.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Nose Pointer
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + fwdX * 9, ry + fwdY * 9);
      ctx.stroke();
    }
  }, [telemetry]);

  // Audio Toggle
  const handleToggleMute = () => {
    buzzerAudio.unlockAudio();
    const muted = buzzerAudio.toggleMute();
    setIsAudioMuted(muted);
  };

  const pointerStartTimeRef = useRef<number>(0);
  const clickPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Movement Helper (supports hold-to-move, click pulse, and immediate stop)
  const handleMove = (cmd: SimulationMovementCommand) => {
    buzzerAudio.unlockAudio();
    if (clickPulseTimerRef.current) {
      clearTimeout(clickPulseTimerRef.current);
      clickPulseTimerRef.current = null;
    }
    managerRef.current?.move(cmd);
  };

  const handlePointerDown = (cmd: SimulationMovementCommand) => {
    buzzerAudio.unlockAudio();
    if (clickPulseTimerRef.current) {
      clearTimeout(clickPulseTimerRef.current);
      clickPulseTimerRef.current = null;
    }
    if (cmd === 'STOP') {
      managerRef.current?.move('STOP');
      return;
    }
    pointerStartTimeRef.current = Date.now();
    managerRef.current?.move(cmd);
  };

  const handlePointerUp = (cmd: SimulationMovementCommand) => {
    if (cmd === 'STOP') return;
    const elapsed = Date.now() - pointerStartTimeRef.current;
    if (elapsed < 200) {
      // Quick tap/click: sustain a visible 450ms movement pulse then stop
      if (clickPulseTimerRef.current) clearTimeout(clickPulseTimerRef.current);
      clickPulseTimerRef.current = setTimeout(() => {
        managerRef.current?.move('STOP');
      }, 450);
    } else {
      // Held down: stop immediately on release
      managerRef.current?.move('STOP');
    }
  };

  const handlePointerLeave = (cmd: SimulationMovementCommand) => {
    if (cmd === 'STOP') return;
    const elapsed = Date.now() - pointerStartTimeRef.current;
    if (elapsed >= 200) {
      managerRef.current?.move('STOP');
    }
  };

  // Scenario Changer
  const handleSelectPreset = (preset: ScenarioPresetId) => {
    setActivePreset(preset);
    managerRef.current?.applyScenarioPreset(preset);
  };

  // Reset Field
  const handleResetField = () => {
    managerRef.current?.resetField();
  };

  // Camera Perspective Management
  const handleSelectCameraMode = (mode: SimCameraMode) => {
    setCameraMode(mode);
    sceneRef.current?.setCameraMode(mode);
  };

  const handleResetCamera = () => {
    sceneRef.current?.resetCameraView();
  };

  // Farmer Approval Spray Execution
  const handleApproveSpray = () => {
    if (!managerRef.current) return;
    const success = managerRef.current.approveAndSpray(operatorName);
    if (success) {
      setIsApprovalModalOpen(false);
    }
  };

  // Target plant dynamically acquired by AI camera inspection
  const targetPlant = telemetry?.detectedPlant ?? managerRef.current?.getDetectedPlant() ?? null;

  // Environmental Metrics
  const envImpact = managerRef.current?.getEnvironmentalImpact() || {
    conventionalBaselineMl: 1000,
    agriguardPrecisionMl: 240,
    volumeSavedMl: 760,
    percentageReduction: 76.0,
    areaTreatedM2: 18,
    robotEnergyKwh: 0.18,
    conventionalFootprintKgCO2e: 1.84,
    agriguardFootprintKgCO2e: 0.62,
    estimatedAvoidedCO2eKg: 1.22,
  };

  const usLeft = telemetry?.ultrasonic.left ?? 48;
  const usCenter = telemetry?.ultrasonic.center ?? 72;
  const usRight = telemetry?.ultrasonic.right ?? 18;

  const isLeftObstacle = usLeft < SAFETY_THRESHOLDS.OBSTACLE_CM;
  const isCenterObstacle = usCenter < SAFETY_THRESHOLDS.OBSTACLE_CM;
  const isRightObstacle = usRight < SAFETY_THRESHOLDS.OBSTACLE_CM;

  const isAnyObstacle = isLeftObstacle || isCenterObstacle || isRightObstacle;
  const isAnyWarning = usLeft <= SAFETY_THRESHOLDS.WARNING_CM || usCenter <= SAFETY_THRESHOLDS.WARNING_CM || usRight <= SAFETY_THRESHOLDS.WARNING_CM;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      width: '100%',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* ── 1. Top Simulation Header & Control Bar ────────────────────────────── */}
      <div className="glass-panel" style={{
        padding: '0.75rem 1.25rem',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        border: '1px solid var(--border-subtle)',
        background: 'rgba(11, 19, 32, 0.85)',
        backdropFilter: 'blur(12px)'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--emerald-500), #065f46)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px var(--emerald-glow)'
          }}>
            <Leaf size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              Simulated Farm View
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Interactive simulation of AgriGuard in a realistic farm environment
            </div>
          </div>
        </div>

        {/* Right Controls: Scenario Dropdown, Speed Pills, Reset Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {/* Scenario Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>Scenario:</span>
            <select
              value={activePreset}
              onChange={(e) => handleSelectPreset(e.target.value as ScenarioPresetId)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="NORMAL_FIELD" style={{ background: '#0b1320' }}>Mixed Field (Normal)</option>
              <option value="OBSTACLE_AHEAD" style={{ background: '#0b1320' }}>Obstacle Ahead (Rock)</option>
              <option value="DISEASED_ZONE" style={{ background: '#0b1320' }}>Diseased Zone (Early Blight)</option>
              <option value="DRY_SOIL_ZONE" style={{ background: '#0b1320' }}>Dry Soil Zone</option>
              <option value="PRECISION_SPRAY" style={{ background: '#0b1320' }}>Precision Spray Demo</option>
              <option value="FULL_DEMO" style={{ background: '#0b1320' }}>Full Interactive Demo</option>
            </select>
          </div>

          {/* Simulation Speed Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>Simulation Speed:</span>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[0.5, 1.0, 2.0].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSimSpeed(spd)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: simSpeed === spd ? 'var(--emerald-500)' : 'transparent',
                    color: simSpeed === spd ? '#05080f' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Camera Perspective Mode Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>Camera:</span>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { id: 'FOLLOW', label: 'Follow' },
                { id: 'FREE', label: 'Free' },
                { id: 'CHASE', label: 'Chase' },
                { id: 'OVERHEAD', label: 'Top-Down' },
                { id: 'ISOMETRIC', label: 'Iso' },
              ].map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => handleSelectCameraMode(cam.id as SimCameraMode)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: cameraMode === cam.id ? 'var(--sky-500)' : 'transparent',
                    color: cameraMode === cam.id ? '#05080f' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  title={cam.id === 'FOLLOW' ? 'Follow rover maintaining your custom orbit angle' : cam.id === 'FREE' ? 'Free orbit camera stays stationary in field' : cam.label}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Camera Button */}
          <button
            type="button"
            onClick={handleResetCamera}
            className="btn btn-outline"
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontWeight: 600
            }}
            title="Reset 3D camera to elevated crop row perspective"
          >
            <Camera size={13} />
            <span>Reset Cam</span>
          </button>

          {/* Reset Field Button */}
          <button
            type="button"
            onClick={handleResetField}
            className="btn btn-outline"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontWeight: 600
            }}
          >
            <RotateCcw size={14} />
            <span>Reset Field</span>
          </button>

          {/* Audio Mute Toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="btn btn-outline"
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              color: isAudioMuted ? 'var(--rose-400)' : 'var(--emerald-400)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
            title={isAudioMuted ? 'Unmute Audio Buzzer' : 'Mute Audio Buzzer'}
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── 2. Main 3D Simulation Viewport with Overlaid HUD Panels ──────────── */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '780px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
      }}>
        {/* Full-Canvas Three.js Mount */}
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

        {/* ── Overlaid HUD Cards (Positioned exactly matching reference image) ── */}

        {/* Card 1: Top-Left Ultrasonic Proximity */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          width: '275px',
          background: 'rgba(11, 19, 32, 0.88)',
          backdropFilter: 'blur(14px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
            <Radio size={15} color="var(--emerald-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Ultrasonic Proximity</span>
          </div>

          {/* 3 Metric Value Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {/* Left */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${usLeft < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-500)' : usLeft <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-500)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '0.45rem 0.3rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Left</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: usLeft < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usLeft <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)' }}>
                {usLeft}<span style={{ fontSize: '0.65rem', fontWeight: 600 }}>cm</span>
              </div>
              <div style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: usLeft < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usLeft <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)',
                marginTop: '2px'
              }}>
                {usLeft < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'OBSTACLE' : usLeft <= SAFETY_THRESHOLDS.WARNING_CM ? 'WARNING' : 'SAFE'}
              </div>
            </div>

            {/* Center */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${usCenter < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-500)' : usCenter <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-500)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '0.45rem 0.3rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Center</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: usCenter < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usCenter <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)' }}>
                {usCenter}<span style={{ fontSize: '0.65rem', fontWeight: 600 }}>cm</span>
              </div>
              <div style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: usCenter < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usCenter <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)',
                marginTop: '2px'
              }}>
                {usCenter < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'OBSTACLE' : usCenter <= SAFETY_THRESHOLDS.WARNING_CM ? 'WARNING' : 'SAFE'}
              </div>
            </div>

            {/* Right */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${usRight < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-500)' : usRight <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-500)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '0.45rem 0.3rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Right</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: usRight < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usRight <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)' }}>
                {usRight}<span style={{ fontSize: '0.65rem', fontWeight: 600 }}>cm</span>
              </div>
              <div style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: usRight < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'var(--rose-400)' : usRight <= SAFETY_THRESHOLDS.WARNING_CM ? 'var(--amber-400)' : 'var(--emerald-400)',
                marginTop: '2px'
              }}>
                {usRight < SAFETY_THRESHOLDS.OBSTACLE_CM ? 'OBSTACLE' : usRight <= SAFETY_THRESHOLDS.WARNING_CM ? 'WARNING' : 'SAFE'}
              </div>
            </div>
          </div>

          {/* Obstacle Warning Box */}
          {isAnyObstacle ? (
            <div style={{
              background: 'rgba(244, 63, 94, 0.14)',
              border: '1px solid var(--rose-500)',
              borderRadius: '8px',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem'
            }}>
              <AlertTriangle size={16} color="var(--rose-500)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--rose-400)' }}>
                  {isRightObstacle ? 'OBSTACLE RIGHT' : isCenterObstacle ? 'OBSTACLE AHEAD' : 'OBSTACLE LEFT'}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                  Robot will stop if obstacle is closer.
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '0.4rem 0.6rem',
              fontSize: '0.68rem',
              color: 'var(--emerald-400)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <CheckCircle2 size={13} />
              <span>Forward driving corridor clear</span>
            </div>
          )}
        </div>

        {/* Card 2: Middle-Left Robot Camera View (Live simulated FPV feed) */}
        <div style={{
          position: 'absolute',
          top: '195px',
          left: '16px',
          width: '275px',
          background: 'rgba(11, 19, 32, 0.88)',
          backdropFilter: 'blur(14px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
            <Camera size={15} color="var(--emerald-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Robot Camera View</span>
          </div>

          {/* Canvas Rendering FPV Bumper Camera Feed */}
          <div style={{
            width: '100%',
            height: '135px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#040b14',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <canvas
              ref={bumperCanvasRef}
              width={255}
              height={135}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
            {/* Target Reticle Overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '40px',
              height: '40px',
              border: '1px dashed rgba(16, 185, 129, 0.65)',
              borderRadius: '4px',
              pointerEvents: 'none'
            }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
            Live simulated camera feed
          </div>
        </div>

        {/* Card 3: Bottom-Left AI Crop Analysis */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          width: '275px',
          background: 'rgba(11, 19, 32, 0.88)',
          backdropFilter: 'blur(14px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
            <Leaf size={15} color="var(--emerald-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>AI Crop Analysis</span>
          </div>

          {targetPlant ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* Foliage Thumbnail */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '8px',
                  background: targetPlant.state === 'DISEASED'
                    ? 'linear-gradient(135deg, #7f1d1d, #450a0a)'
                    : targetPlant.state === 'WARNING'
                    ? 'linear-gradient(135deg, #78350f, #451a03)'
                    : targetPlant.state === 'TREATED'
                    ? 'linear-gradient(135deg, #581c87, #3b0764)'
                    : 'linear-gradient(135deg, #166534, #14532d)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: `1px solid ${targetPlant.state === 'DISEASED' ? '#ef4444' : targetPlant.state === 'WARNING' ? '#f59e0b' : targetPlant.state === 'TREATED' ? '#a855f7' : '#22c55e'}`,
                  overflow: 'hidden'
                }}>
                  <Leaf size={32} color={targetPlant.state === 'DISEASED' ? '#fca5a5' : targetPlant.state === 'WARNING' ? '#fde047' : targetPlant.state === 'TREATED' ? '#d8b4fe' : '#86efac'} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.80rem', fontWeight: 800, color: '#fff' }}>
                    {targetPlant.id} (Row {targetPlant.row})
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{targetPlant.variety}</div>
                  <div style={{ fontSize: '0.70rem', color: targetPlant.state === 'DISEASED' ? 'var(--rose-400)' : targetPlant.state === 'WARNING' ? 'var(--amber-400)' : targetPlant.state === 'TREATED' ? 'var(--purple-400)' : 'var(--emerald-400)', fontWeight: 700 }}>
                    {targetPlant.disease?.name || (targetPlant.state === 'HEALTHY' ? 'Healthy Canopy' : 'Target Acquired')}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    Confidence: {(targetPlant.disease?.confidence ? targetPlant.disease.confidence * 100 : 94.2).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    Health Score: <strong style={{ color: targetPlant.healthScore > 80 ? 'var(--emerald-400)' : targetPlant.healthScore > 50 ? 'var(--amber-400)' : 'var(--rose-400)' }}>{targetPlant.healthScore}%</strong>
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <span className={`status-pill ${targetPlant.state === 'DISEASED' ? 'status-danger' : targetPlant.state === 'WARNING' ? 'status-warning' : 'status-online'}`} style={{ fontSize: '0.64rem', padding: '0.15rem 0.5rem', fontWeight: 800 }}>
                  {targetPlant.state}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedPlant(targetPlant); setIsDetailsModalOpen(true); }}
                  className="btn btn-outline"
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    borderColor: 'rgba(255,255,255,0.18)',
                    color: '#fff'
                  }}
                >
                  Diagnostics
                </button>

                {targetPlant.state === 'TREATED' ? (
                  <button
                    type="button"
                    disabled
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      color: 'var(--purple-300)',
                      borderColor: 'rgba(168, 85, 247, 0.4)',
                      background: 'rgba(168, 85, 247, 0.12)'
                    }}
                  >
                    ✓ Treated
                  </button>
                ) : targetPlant.state === 'HEALTHY' ? (
                  <button
                    type="button"
                    disabled
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      color: 'var(--emerald-400)',
                      borderColor: 'rgba(34, 197, 94, 0.3)',
                      background: 'rgba(34, 197, 94, 0.08)'
                    }}
                  >
                    ✓ Safe
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '6px'
                    }}
                  >
                    Request Spray
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '0.65rem 0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--emerald-400)', fontWeight: 800, fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                <Scan size={16} />
                <span>AI Canopy Vision Active</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.35 }}>
                Scanning rows. Drive along crop furrows or steer towards canopy to inspect foliage.
              </div>
              <button
                type="button"
                onClick={() => managerRef.current?.targetNearestPlant()}
                className="btn btn-outline"
                style={{
                  fontSize: '0.70rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.2)',
                  fontWeight: 600,
                  width: '100%'
                }}
              >
                🎯 Acquire Nearest Crop Plant
              </button>
            </div>
          )}
        </div>

        {/* Subtle Floating Camera Interaction Guide */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(11, 19, 32, 0.75)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '0.3rem 0.85rem',
          fontSize: '0.66rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          pointerEvents: 'none',
          zIndex: 9
        }}>
          <span>🖱️ <strong style={{ color: '#fff' }}>Left-Drag</strong> Orbit</span>
          <span>•</span>
          <span><strong style={{ color: '#fff' }}>Right-Drag</strong> Pan</span>
          <span>•</span>
          <span><strong style={{ color: '#fff' }}>Scroll</strong> Zoom</span>
          <span>•</span>
          <span style={{ color: 'var(--emerald-400)' }}>Camera angle stays fixed</span>
        </div>

        {/* Card 4: Top-Right Field Map (2D Aerial crop row grid & robot cone) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '275px',
          background: 'rgba(11, 19, 32, 0.88)',
          backdropFilter: 'blur(14px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
            <Layers size={15} color="var(--sky-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Field Map</span>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            {/* Aerial Canvas */}
            <div style={{
              width: '150px',
              height: '190px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              position: 'relative'
            }}>
              <canvas
                ref={fieldMapCanvasRef}
                width={150}
                height={190}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>

            {/* Map Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                <span style={{ color: '#fff', fontWeight: 600 }}>Robot</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span>Healthy</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
                <span>Warning</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span>Diseased</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                <span>Treated</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                <span>Obstacle</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Row: Robot Controls, Robot Telemetry, Environmental Impact ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.6fr 1.4fr',
        gap: '0.85rem',
        width: '100%'
      }}>
        {/* Card 5: Robot Controls (D-Pad & Pump / Relay) */}
        <div className="glass-panel" style={{
          padding: '0.85rem',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(11, 19, 32, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
            <Compass size={15} color="var(--rose-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Robot Controls</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '0.75rem' }}>
            {/* D-Pad Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onPointerDown={() => handlePointerDown('FORWARD')}
                onPointerUp={() => handlePointerUp('FORWARD')}
                onPointerLeave={() => handlePointerLeave('FORWARD')}
                className="btn"
                style={{
                  width: '52px',
                  height: '42px',
                  background: telemetry?.movement === 'FORWARD' ? 'var(--emerald-500)' : 'rgba(255,255,255,0.06)',
                  color: telemetry?.movement === 'FORWARD' ? '#05080f' : '#fff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                  userSelect: 'none'
                }}
                title="Forward (W / Up Arrow)"
              >
                <ArrowUp size={20} />
              </button>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onPointerDown={() => handlePointerDown('LEFT')}
                  onPointerUp={() => handlePointerUp('LEFT')}
                  onPointerLeave={() => handlePointerLeave('LEFT')}
                  className="btn"
                  style={{
                    width: '52px',
                    height: '42px',
                    background: telemetry?.movement === 'LEFT' ? 'var(--emerald-500)' : 'rgba(255,255,255,0.06)',
                    color: telemetry?.movement === 'LEFT' ? '#05080f' : '#fff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    userSelect: 'none'
                  }}
                  title="Pivot Left (A / Left Arrow)"
                >
                  <ArrowLeft size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => handleMove('STOP')}
                  className="btn"
                  style={{
                    width: '68px',
                    height: '42px',
                    background: telemetry?.movement === 'STOP' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.15)',
                    color: 'var(--rose-400)',
                    border: '1px solid var(--rose-500)',
                    borderRadius: '8px',
                    fontWeight: 900,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none'
                  }}
                  title="Halt Motors (Space)"
                >
                  STOP
                </button>

                <button
                  type="button"
                  onPointerDown={() => handlePointerDown('RIGHT')}
                  onPointerUp={() => handlePointerUp('RIGHT')}
                  onPointerLeave={() => handlePointerLeave('RIGHT')}
                  className="btn"
                  style={{
                    width: '52px',
                    height: '42px',
                    background: telemetry?.movement === 'RIGHT' ? 'var(--emerald-500)' : 'rgba(255,255,255,0.06)',
                    color: telemetry?.movement === 'RIGHT' ? '#05080f' : '#fff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    userSelect: 'none'
                  }}
                  title="Pivot Right (D / Right Arrow)"
                >
                  <ArrowRight size={20} />
                </button>
              </div>

              <button
                type="button"
                onPointerDown={() => handlePointerDown('BACKWARD')}
                onPointerUp={() => handlePointerUp('BACKWARD')}
                onPointerLeave={() => handlePointerLeave('BACKWARD')}
                className="btn"
                style={{
                  width: '52px',
                  height: '42px',
                  background: telemetry?.movement === 'BACKWARD' ? 'var(--emerald-500)' : 'rgba(255,255,255,0.06)',
                  color: telemetry?.movement === 'BACKWARD' ? '#05080f' : '#fff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                  userSelect: 'none'
                }}
                title="Reverse (S / Down Arrow)"
              >
                <ArrowDown size={20} />
              </button>
            </div>

            {/* Actuator Indicators: Pump & Relay */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{
                background: telemetry?.pumpState === 'ON' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${telemetry?.pumpState === 'ON' ? 'var(--sky-400)' : 'rgba(255,255,255,0.08)'}`,
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <Droplet size={14} color={telemetry?.pumpState === 'ON' ? 'var(--sky-400)' : 'var(--rose-400)'} />
                <span>Pump {telemetry?.pumpState || 'OFF'}</span>
              </div>

              <div style={{
                background: telemetry?.relayState === 'ON' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${telemetry?.relayState === 'ON' ? 'var(--amber-400)' : 'rgba(255,255,255,0.08)'}`,
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <Zap size={14} color={telemetry?.relayState === 'ON' ? 'var(--amber-400)' : 'var(--amber-400)'} />
                <span>Relay {telemetry?.relayState || 'OFF'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Robot Telemetry (Live) */}
        <div className="glass-panel" style={{
          padding: '0.85rem',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(11, 19, 32, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
            <Activity size={15} color="var(--emerald-400)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Robot Telemetry (Live)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem', textAlign: 'center' }}>
            {/* Soil Moisture */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Soil Moisture</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--emerald-400)', margin: '2px 0' }}>
                {(telemetry?.soilMoisturePct || 42.0).toFixed(0)}%
              </div>
              <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '4px auto 2px auto', overflow: 'hidden' }}>
                <div style={{ width: `${telemetry?.soilMoisturePct || 42}%`, height: '100%', background: 'var(--emerald-500)' }} />
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--emerald-400)', fontWeight: 700 }}>Normal</div>
            </div>

            {/* NPK */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>NPK</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', marginTop: '4px', textAlign: 'left', paddingLeft: '6px' }}>
                <div>N: <strong style={{ color: 'var(--emerald-400)' }}>{telemetry?.npk.n || 48}</strong></div>
                <div>P: <strong style={{ color: 'var(--cyan-400)' }}>{telemetry?.npk.p || 26}</strong></div>
                <div>K: <strong style={{ color: 'var(--amber-400)' }}>{telemetry?.npk.k || 41}</strong></div>
              </div>
            </div>

            {/* Temperature */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Temperature</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sky-400)', margin: '4px 0' }}>
                {(telemetry?.dht22.temperature || 29.4).toFixed(1)}°C
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Microclimate</div>
            </div>

            {/* Humidity */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>Humidity</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sky-400)', margin: '4px 0' }}>
                {(telemetry?.dht22.humidity || 72.8).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>RH Relative</div>
            </div>

            {/* IMU (Pitch/Roll) */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>IMU (Pitch/Roll)</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                <div>P: <strong style={{ color: 'var(--amber-400)' }}>{(telemetry?.mpu6050.pitch_deg || 1.2).toFixed(1)}°</strong></div>
                <div>R: <strong style={{ color: 'var(--amber-400)' }}>{(telemetry?.mpu6050.roll_deg || -0.6).toFixed(1)}°</strong></div>
              </div>
              <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', marginTop: '2px' }}>MPU6050 Live</div>
            </div>
          </div>
        </div>

        {/* Card 7: Environmental Impact & Carbon Intelligence */}
        <div className="glass-panel" style={{
          padding: '0.85rem',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(11, 19, 32, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Leaf size={15} color="var(--emerald-400)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Environmental & Carbon Intelligence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  fontSize: '0.58rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: 'var(--sky-400)',
                  fontWeight: 800
                }}>
                  {carbonImpact.mode}
                </span>
                <button
                  type="button"
                  title="Run Deterministic 58% Reduction Benchmark (Section 30)"
                  onClick={() => managerRef.current?.loadDeterministicBenchmark()}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: 'var(--emerald-400)',
                    borderRadius: '4px',
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    padding: '2px 5px',
                    cursor: 'pointer'
                  }}
                >
                  Benchmark
                </button>
              </div>
            </div>

            {/* Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.25fr', gap: '0.5rem', fontSize: '0.68rem', marginBottom: '0.35rem' }}>
              <div>
                <div style={{ color: 'var(--text-dim)', fontWeight: 700, marginBottom: '2px' }}>Conventional Baseline</div>
                <div style={{ color: 'var(--text-muted)' }}>Baseline Spray: <strong style={{ color: '#fff' }}>{carbonImpact.baselineTreatmentVolumeMl.value.toFixed(0)} mL</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Field Area: <strong style={{ color: '#fff' }}>{carbonImpact.totalFieldAreaM2.value.toFixed(0)} m²</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>
                  CO2e: <strong style={{ color: carbonImpact.baselineFootprintKgCO2e.value !== null ? 'var(--rose-400)' : 'var(--text-dim)' }}>
                    {carbonImpact.baselineFootprintKgCO2e.value !== null ? `${carbonImpact.baselineFootprintKgCO2e.value.toFixed(3)} kg` : 'Unconfigured'}
                  </strong>
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 700, marginBottom: '2px' }}>AgriGuard Precision</div>
                <div style={{ color: 'var(--text-muted)' }}>Targeted Spray: <strong style={{ color: 'var(--emerald-400)' }}>{carbonImpact.agriguardTreatmentVolumeMl.value.toFixed(0)} mL</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Treated Area: <strong style={{ color: 'var(--emerald-400)' }}>{carbonImpact.treatedAreaM2.value.toFixed(1)} m² ({carbonImpact.precisionTreatmentRate.value.toFixed(0)}%)</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Robot Energy: <strong style={{ color: 'var(--sky-400)' }}>{carbonImpact.robotEnergyKwh.value.toFixed(3)} kWh</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>
                  CO2e: <strong style={{ color: carbonImpact.agriguardFootprintKgCO2e.value !== null ? 'var(--emerald-400)' : 'var(--text-dim)' }}>
                    {carbonImpact.agriguardFootprintKgCO2e.value !== null ? `${carbonImpact.agriguardFootprintKgCO2e.value.toFixed(3)} kg` : 'Unconfigured'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Highlight Banner at Bottom */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '8px',
            padding: '0.4rem 0.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#fff' }}>
                <Leaf size={14} color="var(--emerald-400)" />
                <span>Estimated Avoided CO2e</span>
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--emerald-300)', marginTop: '1px' }}>
                Chemical Saved: <strong>{carbonImpact.chemicalSavedMl.value.toFixed(0)} mL</strong> ({carbonImpact.chemicalReductionPercent.value.toFixed(1)}% Red.)
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--emerald-400)' }}>
                {carbonImpact.estimatedAvoidedCO2eKg.value !== null ? `${carbonImpact.estimatedAvoidedCO2eKg.value.toFixed(3)} kg` : 'N/A'}
              </div>
              {carbonImpact.carbonReductionPercent.value !== null && (
                <div style={{ fontSize: '0.58rem', color: 'var(--emerald-300)', fontWeight: 700 }}>
                  ~{carbonImpact.carbonReductionPercent.value.toFixed(1)}% avoided
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Farmer Approval Modal Dialog ─────────────────────────────────── */}
      {isApprovalModalOpen && targetPlant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-panel" style={{
            width: '520px',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            background: '#0b1320',
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
              <Sparkles size={20} color="var(--emerald-400)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Farmer Approval Gate: Precision Spray
              </h3>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
              AgriGuard AI will <strong>never spray chemicals automatically</strong> without human-in-the-loop verification. Please authorize targeted pulse spray execution.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.76rem', color: '#fff', fontWeight: 700, marginBottom: '0.35rem' }}>Target Specifications:</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Plant Target: <strong style={{ color: '#fff' }}>{targetPlant.id}</strong></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Identified Pathology: <strong style={{ color: 'var(--amber-400)' }}>{targetPlant.disease?.name}</strong></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recommended Dosage: <strong style={{ color: 'var(--emerald-400)' }}>{targetPlant.disease?.recommendedDoseMl || 40} mL</strong> micro-pulse</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Formulation: <strong style={{ color: 'var(--sky-400)' }}>{targetPlant.disease?.chemicalProduct || 'Copper Hydroxide'}</strong></div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Authorized Operator Name:
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.80rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="btn btn-outline"
                style={{ padding: '0.55rem 1rem', fontSize: '0.78rem' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApproveSpray}
                className="btn btn-primary"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Sparkles size={15} />
                AUTHORIZE & SPRAY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Plant Details Modal Dialog ───────────────────────────────────── */}
      {isDetailsModalOpen && selectedPlant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-panel" style={{
            width: '480px',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: '#0b1320'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Leaf size={18} color="var(--emerald-400)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {selectedPlant.id} Diagnostics
                </h3>
              </div>
              <span className={`status-pill ${selectedPlant.state === 'DISEASED' ? 'status-danger' : selectedPlant.state === 'WARNING' ? 'status-warning' : 'status-online'}`} style={{ fontSize: '0.64rem', padding: '0.15rem 0.5rem', fontWeight: 800 }}>
                {selectedPlant.state}
              </span>
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
              <div>Crop Variety: <strong style={{ color: '#fff' }}>{selectedPlant.variety} ({selectedPlant.cropType})</strong></div>
              <div>Field Coordinate: <strong style={{ color: '#fff' }}>Row {selectedPlant.row}, Stalk {selectedPlant.col} (X: {selectedPlant.position.x}m, Z: {selectedPlant.position.z}m)</strong></div>
              <div>Foliar Health Score: <strong style={{ color: 'var(--emerald-400)' }}>{selectedPlant.healthScore}%</strong></div>
              {selectedPlant.disease && (
                <>
                  <div>Pathology: <strong style={{ color: 'var(--amber-400)' }}>{selectedPlant.disease.name}</strong> ({selectedPlant.disease.pathogen})</div>
                  <div>Symptoms: <span style={{ color: 'var(--text-muted)' }}>{selectedPlant.disease.symptoms}</span></div>
                  <div>Recommended Dose: <strong style={{ color: 'var(--cyan-400)' }}>{selectedPlant.disease.recommendedDoseMl} mL</strong> of {selectedPlant.disease.chemicalProduct}</div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="btn btn-outline"
                style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
              >
                Close
              </button>

              {(selectedPlant.state === 'DISEASED' || selectedPlant.state === 'WARNING') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setIsApprovalModalOpen(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Sparkles size={14} />
                  Authorize Spray
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
