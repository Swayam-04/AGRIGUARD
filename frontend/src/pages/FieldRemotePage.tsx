import React, { useState } from 'react';
import { Gamepad2, Microscope, Sparkles, Activity } from 'lucide-react';
import { CameraView } from '../components/CameraView';
import { RobotControls } from '../components/RobotControls';
import { DiagnosisCard } from '../components/DiagnosisCard';
import { DiseaseDetectPage } from './DiseaseDetectPage';
import { AIDetection, TelemetryData, TreatmentDecision } from '../types';

interface FieldRemotePageProps {
  telemetry: TelemetryData | null;
  lastDetection: AIDetection | null;
  lastDecision: TreatmentDecision | null;
  isScanning: boolean;
  onTriggerScan: (frameBase64?: string) => void;
  activeZoneId: string;
  onMove: (direction: string, speed: number, durationMs?: number) => Promise<any>;
  onStop: () => Promise<any>;
  onEmergencyStop: () => Promise<any>;
  onSprayApprove: (decisionId: string, approved: boolean, operatorName: string) => Promise<any>;
}

export const FieldRemotePage: React.FC<FieldRemotePageProps> = ({
  telemetry,
  lastDetection,
  lastDecision,
  isScanning,
  onTriggerScan,
  activeZoneId,
  onMove,
  onStop,
  onEmergencyStop,
  onSprayApprove
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cockpit' | 'crop-ai'>('cockpit');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Top Combined Navigation Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: '16px'
        }}
      >
        {/* Left: Mode Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #065f46)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            {activeSubTab === 'cockpit' ? (
              <Gamepad2 size={20} color="#fff" />
            ) : (
              <Microscope size={20} color="#fff" />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Field Remote & Crop AI
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>
              Unified Rover Teleoperation, Optical Camera Feed & Leaf Disease Diagnosis
            </p>
          </div>
        </div>

        {/* Center/Right: Sub-Tab Segmented Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('cockpit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: 'none',
              background:
                activeSubTab === 'cockpit'
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'transparent',
              color: activeSubTab === 'cockpit' ? '#fff' : 'var(--text-muted)',
              boxShadow:
                activeSubTab === 'cockpit'
                  ? '0 2px 10px rgba(16, 185, 129, 0.4)'
                  : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Gamepad2 size={16} />
            <span>Rover Teleop Cockpit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('crop-ai')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: 'none',
              background:
                activeSubTab === 'crop-ai'
                  ? 'linear-gradient(135deg, #16a34a, #059669)'
                  : 'transparent',
              color: activeSubTab === 'crop-ai' ? '#fff' : 'var(--text-muted)',
              boxShadow:
                activeSubTab === 'crop-ai'
                  ? '0 2px 10px rgba(22, 163, 74, 0.4)'
                  : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Microscope size={16} />
            <span>Crop Disease AI & Upload</span>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '1px 5px',
                borderRadius: '4px'
              }}
            >
              DUAL
            </span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: Rover Teleop Cockpit */}
      {activeSubTab === 'cockpit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {/* Top Row: Camera & Direction Pad Side-by-Side Cockpit */}
          <div className="remote-cockpit-layout">
            <div className="remote-cockpit-camera">
              <CameraView
                cameraStatus={telemetry?.camera_status}
                lastDetection={lastDetection}
                isScanning={isScanning}
                onTriggerScan={onTriggerScan}
                activeZoneId={telemetry?.active_zone_id ?? activeZoneId}
                telemetry={telemetry}
                onMove={onMove}
                onStop={onStop}
              />
            </div>

            <div className="remote-cockpit-controls">
              <RobotControls
                telemetry={telemetry}
                onMove={onMove}
                onStop={onStop}
                onEmergencyStop={onEmergencyStop}
                onSprayApprove={onSprayApprove}
              />
            </div>
          </div>

          {/* Integrated Pathology Diagnosis Banner & Card in Cockpit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 0.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="var(--emerald-400)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Active Optical Pathology Observation
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('crop-ai')}
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', color: '#34d399' }}
              >
                <Sparkles size={14} />
                <span>Switch to Full Leaf Specimen Lab & Nearby Stores &rarr;</span>
              </button>
            </div>

            <DiagnosisCard detection={lastDetection} telemetry={telemetry} />
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Crop Disease AI & Upload Lab */}
      {activeSubTab === 'crop-ai' && (
        <div style={{ width: '100%' }}>
          <DiseaseDetectPage />
        </div>
      )}
    </div>
  );
};
