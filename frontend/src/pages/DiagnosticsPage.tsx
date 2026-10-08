import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, XCircle, RefreshCw, Terminal, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DiagnosticsReport } from '../types';
import { fetchDiagnostics } from '../services/api';

export const DiagnosticsPage: React.FC = () => {
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
    const interval = setInterval(runDiagnostics, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (value: string, expectedGood: string[]) => {
    const isGood = expectedGood.includes(value.toUpperCase());
    return (
      <span className={`status-pill ${isGood ? 'status-online' : 'status-offline'}`} style={{ fontSize: '0.85rem' }}>
        {isGood ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        <span>{value}</span>
      </span>
    );
  };

  return (
    <div className="card animate-fade-in">
      <div className="card-header">
        <div className="card-title">
          <div className="card-icon"><Cpu size={14} /></div>
          Physical Hardware Diagnostic Suite
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last polled: <strong style={{ color: 'var(--text-primary)' }}>{lastCheck || 'Waiting…'}</strong>
          </span>
          <button
            id="btn-poll-hardware"
            onClick={runDiagnostics}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Poll Hardware
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
        Real hardware verification matrix — live polling of physical buses and interfaces.
      </p>

      {/* STRICT SECTION 27 DIAGNOSTIC TABLE */}
      <div className="card-body" style={{ padding: 0 }}>
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', background: 'var(--bg-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem' }}>SUBSYSTEM / INTERFACE</th>
              <th style={{ padding: '0.75rem 1rem' }}>PHYSICAL BUS / PROTOCOL</th>
              <th style={{ padding: '0.75rem 1rem' }}>PIN / PORT</th>
              <th style={{ padding: '0.75rem 1rem' }}>LIVE STATUS</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '0.9rem' }}>
            {/* 1. ESP32 */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>ESP32 Main Controller</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>Wi-Fi 802.11 b/g/n HTTP/WS</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>192.168.4.1:80</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.esp32, ['CONNECTED']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 2. External USB Camera */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>External USB Camera</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>USB 2.0 / V4L2 / DShow</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>Video Dev Index 0</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.camera, ['CONNECTED']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 3. RS485 NPK Sensor */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>RS485 NPK Soil Probe</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>Modbus RTU over RS485</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 16(RX) / 17(TX)</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.npk, ['CONNECTED']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 4. Soil Moisture */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Capacitive Soil Moisture</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>Analog 12-bit ADC</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 34 (ADC1_CH6)</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.soil_moisture, ['OK']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 5. Temperature / Humidity */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Microclimate DHT22</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>Single-Wire Digital Bus</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 4</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.temperature, ['OK']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 6. Ultrasonic Sensor */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>HC-SR04 Ultrasonic Distance</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>GPIO Pulse Timing</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>Trig: GPIO 5 / Echo: GPIO 18</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.ultrasonic, ['OK']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 7. MPU6050 IMU */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>MPU6050 6-DOF IMU</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>I2C Bus (Addr: 0x68)</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>SDA: GPIO 21 / SCL: GPIO 22</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.imu, ['OK']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 8. 12V Spray Pump */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>12V Diaphragm Spray Pump</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>MOSFET Gate Driver</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 25</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.pump, ['ON', 'OFF']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 9. 12V Solenoid Valve */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>12V Solenoid Shutoff Valve</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>MOSFET Gate Driver</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 26</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? getStatusBadge(report.valve, ['OPEN', 'CLOSED']) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>}
              </td>
            </tr>

            {/* 10. Flow Sensor */}
            <tr>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>YF-S401 Liquid Flow Sensor</td>
              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>Hardware Pulse Interrupt</td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>GPIO 27</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {report ? (
                  <span className={`status-pill ${report.flow !== 'NO FLOW' ? 'status-online' : 'status-warning'}`}>
                    {report.flow}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Querying...</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>{/* table overflow div */}
      {/* Raw Physical Telemetry Inspector */}
      <div style={{ background: 'var(--bg-subtle)', padding: '1rem 1.25rem', margin: '0 0 0 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Terminal size={16} color="var(--green-700)" />
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Physical Payload Inspector (JSON)</h3>
        </div>
        <pre className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflowX: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {report?.raw_telemetry ? JSON.stringify(report.raw_telemetry, null, 2) : '// No physical telemetry packet received'}
        </pre>
      </div>
      </div>{/* card-body */}
    </div>
  );
};
