import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, XCircle, RefreshCw, Smartphone, Camera, Wifi, Battery, Activity, Droplets } from 'lucide-react';
import { DiagnosticsReport } from '../types';
import { fetchDiagnostics } from '../services/api';

export const DeviceHealthPage: React.FC = () => {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await fetchDiagnostics();
      setReport(data);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Diagnostics query failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = (value: string, expectedGood: string[]) => {
    return expectedGood.includes(value?.toUpperCase());
  };

  const DeviceCard = ({ name, icon: Icon, isConnected, details }: { name: string, icon: any, isConnected: boolean, details: string }) => (
    <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}>
      <div style={{ width: 40, height: 40, borderRadius: '8px', background: isConnected ? 'var(--green-50)' : 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isConnected ? 'var(--green-700)' : 'var(--danger-dark)', flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: isConnected ? 'var(--green-600)' : 'var(--danger)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {isConnected ? 'Connected' : 'Offline'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>{details}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Device Health</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Hardware connection and operational status.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last polled: <strong style={{ color: 'var(--text-primary)' }}>{lastCheck || 'Waiting…'}</strong>
          </span>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid-3">
        <DeviceCard 
          name="Arduino Mega" 
          icon={Cpu} 
          isConnected={true} 
          details="Core movement & sensor polling controller. USB Serial." 
        />
        <DeviceCard 
          name="ESP32 WiFi module" 
          icon={Wifi} 
          isConnected={report ? getStatus(report.esp32, ['CONNECTED']) : false} 
          details="Telemetry bridge. IP: 192.168.4.1" 
        />
        <DeviceCard 
          name="Vision Camera" 
          icon={Camera} 
          isConnected={report ? getStatus(report.camera, ['CONNECTED']) : false} 
          details="USB 2.0 Web Camera (Dev Index 0)" 
        />
        <DeviceCard 
          name="Ultrasonic Sensors" 
          icon={Activity} 
          isConnected={report ? getStatus(report.ultrasonic, ['OK']) : false} 
          details="HC-SR04 Arrays (3x). GPIO Pulse Timing." 
        />
        <DeviceCard 
          name="Soil Probe" 
          icon={Droplets} 
          isConnected={report ? getStatus(report.npk, ['CONNECTED']) : false} 
          details="RS485 Modbus RTU NPK Probe" 
        />
        <DeviceCard 
          name="Environment (DHT22)" 
          icon={Smartphone} 
          isConnected={report ? getStatus(report.temperature, ['OK']) : false} 
          details="Single-Wire Digital Microclimate Bus" 
        />
      </div>
    </div>
  );
};
