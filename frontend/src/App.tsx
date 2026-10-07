import React, { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { DiagnosisCard } from './components/DiagnosisCard';
import { TelemetryCard } from './components/TelemetryCard';
import { TreatmentCard } from './components/TreatmentCard';
import { RobotControls } from './components/RobotControls';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { ConnectPanel } from './components/ConnectPanel';
import { AgriGuardTwin } from './digitalTwin/AgriGuardTwin';
import { SimulatedViewPage } from './simulator/SimulatedViewPage';
import { AIDetection, TreatmentDecision } from './types';
import {
  runCropScan,
  approveTreatment,
  sendRobotMove,
  sendRobotStop,
  sendEmergencyStop
} from './services/api';
import { EnvironmentalImpactCard } from './components/EnvironmentalImpactCard';

export const App: React.FC = () => {
  const { telemetry, wsConnected } = useTelemetry();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'remote' | 'simulation' | 'diagnostics' | 'environmental'>('dashboard');
  const [activeZoneId, setActiveZoneId] = useState<string>('ZONE-R1C1');

  const [lastDetection, setLastDetection] = useState<AIDetection | null>(null);
  const [lastDecision, setLastDecision] = useState<TreatmentDecision | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Trigger Real AI Camera Scan
  const handleTriggerScan = async (frameBase64?: string) => {
    setIsScanning(true);
    setScanNotification(null);
    try {
      const res = await runCropScan(frameBase64);
      setLastDetection(res.detection);
      setLastDecision(res.decision);
      setScanNotification(`Analysis complete: ${res.detection.display_name} (${(res.detection.confidence * 100).toFixed(0)}%)`);
    } catch (err: any) {
      setScanNotification(`Scan error: ${err.message || 'Camera capture failed'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Farmer Approval Action
  const handleApproveTreatment = async (decisionId: string, approved: boolean, operatorName: string) => {
    const res = await approveTreatment(decisionId, approved, operatorName);
    if (lastDecision) {
      setLastDecision({
        ...lastDecision,
        approved: approved,
        status: approved ? 'FARMER_APPROVED_EXECUTED' : 'REJECTED_BY_FARMER'
      });
    }
    return res;
  };

  // Robot Directional Commands
  const handleMove = async (direction: string, speed: number, durationMs: number = 0) => {
    return await sendRobotMove(direction, speed, durationMs);
  };

  const handleStop = async () => {
    return await sendRobotStop();
  };

  const handleEmergencyStop = async () => {
    return await sendEmergencyStop();
  };

  return (
    <div style={{ maxWidth: '1780px', margin: '0 auto', padding: '1rem' }}>
      {/* Workspace with Left Sidebar */}
      <div className="dashboard-with-sidebar">
        {/* Left Sidebar */}
        <aside className="dashboard-sidebar">
          {/* Header Console (Brand, E-Stop, Navigation Tabs & Status Pills) */}
          <Header
            telemetry={telemetry}
            wsConnected={wsConnected}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onEmergencyStop={handleEmergencyStop}
          />
        </aside>

        {/* Main Tab Content */}
        <main className="dashboard-main-content">
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Scan Notification Banner */}
            {scanNotification && (
              <div style={{
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                background: scanNotification.includes('error') ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${scanNotification.includes('error') ? 'var(--rose-500)' : 'var(--emerald-500)'}`,
                color: '#fff',
                fontSize: '0.85rem'
              }}>
                {scanNotification}
              </div>
            )}

            {/* Hardware Robot Connectivity (Wi-Fi & Bluetooth) */}
            <ConnectPanel telemetry={telemetry} />

            {/* LIVE DIGITAL TWIN */}
            <AgriGuardTwin telemetry={telemetry} />

            {/* Dashboard Primary Section: Robot Sensor Status Only */}
            <section style={{ width: '100%' }}>
              <TelemetryCard telemetry={telemetry} />
            </section>
          </div>
        )}

        {activeTab === 'remote' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            {/* Top Row: Camera & Direction Pad Side-by-Side Cockpit */}
            <div className="remote-cockpit-layout">
              <div className="remote-cockpit-camera">
                <CameraView
                  cameraStatus={telemetry?.camera_status}
                  lastDetection={lastDetection}
                  isScanning={isScanning}
                  onTriggerScan={handleTriggerScan}
                  activeZoneId={telemetry?.active_zone_id ?? activeZoneId}
                  telemetry={telemetry}
                  onMove={handleMove}
                  onStop={handleStop}
                />
              </div>

              <div className="remote-cockpit-controls">
                <RobotControls
                  telemetry={telemetry}
                  onMove={handleMove}
                  onStop={handleStop}
                  onEmergencyStop={handleEmergencyStop}
                  onSprayApprove={handleApproveTreatment}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulation' && (
          <SimulatedViewPage />
        )}

        {activeTab === 'environmental' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            <EnvironmentalImpactCard telemetry={telemetry} />
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsPage />
        )}
      </main>
      </div>
    </div>
  );
};
