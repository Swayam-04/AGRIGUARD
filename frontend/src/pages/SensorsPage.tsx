import React from 'react';
import { TelemetryData } from '../types';
import { Activity, Thermometer, Droplets, Compass } from 'lucide-react';

interface SensorsPageProps {
  telemetry: TelemetryData | null;
}

export const SensorsPage: React.FC<SensorsPageProps> = ({ telemetry }) => {
  const isSimulation = telemetry?.hardware_mode === 'SIMULATION' || telemetry?.mode === 'SIMULATION';
  const isEsp32Connected = Boolean(telemetry?.esp32_connected);
  
  // Ultrasonic
  const us = telemetry?.ultrasonic;
  const usLeft = isSimulation ? (us?.left ?? 72.0) : us?.left;
  const usCenter = isSimulation ? (us?.center ?? 48.0) : us?.center;
  const usRight = isSimulation ? (us?.right ?? 86.0) : us?.right;

  // Environment
  const tempC = telemetry?.dht22?.temperature ?? telemetry?.environment?.temperature_c ?? null;
  const humidity = telemetry?.dht22?.humidity ?? telemetry?.environment?.humidity_pct ?? null;

  // Soil
  let soilPct = null;
  if (isSimulation) {
    soilPct = typeof telemetry?.soil_moisture === 'number' ? telemetry.soil_moisture : 42.0;
  } else if (isEsp32Connected) {
    const rawSm = telemetry?.soil_moisture;
    if (typeof rawSm === 'number') soilPct = rawSm;
    else if ((rawSm as any)?.moisture_pct != null) soilPct = (rawSm as any).moisture_pct;
    else if ((rawSm as any)?.percentage != null) soilPct = (rawSm as any).percentage;
  }

  // IMU
  const pitch = telemetry?.imu?.pitch_deg ?? null;
  const roll = telemetry?.imu?.roll_deg ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* DISTANCE */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <div className="card-icon"><Activity size={14} /></div>
            Distance (Ultrasonic)
          </div>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Left Ultrasonic</div>
              <div className="stat-value">{usLeft != null ? `${Number(usLeft).toFixed(1)} cm` : '--'}</div>
              <div className="stat-meta">{usLeft != null && usLeft < 30 ? 'Warning: Close' : 'Clear'}</div>
            </div>
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Front Ultrasonic</div>
              <div className="stat-value">{usCenter != null ? `${Number(usCenter).toFixed(1)} cm` : '--'}</div>
              <div className="stat-meta">{usCenter != null && usCenter < 30 ? 'Warning: Close' : 'Clear'}</div>
            </div>
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Right Ultrasonic</div>
              <div className="stat-value">{usRight != null ? `${Number(usRight).toFixed(1)} cm` : '--'}</div>
              <div className="stat-meta">{usRight != null && usRight < 30 ? 'Warning: Close' : 'Clear'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ENVIRONMENT & SOIL */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon"><Thermometer size={14} /></div>
              Environment
            </div>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div className="stat-card" style={{ boxShadow: 'none' }}>
                <div className="stat-label">Temperature</div>
                <div className="stat-value">{tempC != null ? `${tempC.toFixed(1)}°C` : '--'}</div>
                <div className="stat-meta">DHT22</div>
              </div>
              <div className="stat-card" style={{ boxShadow: 'none' }}>
                <div className="stat-label">Humidity</div>
                <div className="stat-value">{humidity != null ? `${humidity.toFixed(0)}%` : '--'}</div>
                <div className="stat-meta">DHT22</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon"><Droplets size={14} /></div>
              Soil
            </div>
          </div>
          <div className="card-body">
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Soil Moisture</div>
              <div className="stat-value">{soilPct != null ? `${soilPct.toFixed(1)}%` : '--'}</div>
              <div className="stat-meta">
                {soilPct == null ? 'Offline' : soilPct >= 70 ? 'WET' : soilPct >= 40 ? 'NORMAL' : 'DRY'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOTION */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <div className="card-icon"><Compass size={14} /></div>
            Motion (IMU MPU6500)
          </div>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Pitch</div>
              <div className="stat-value">{pitch != null ? `${pitch.toFixed(1)}°` : '--'}</div>
            </div>
            <div className="stat-card" style={{ boxShadow: 'none' }}>
              <div className="stat-label">Roll</div>
              <div className="stat-value">{roll != null ? `${roll.toFixed(1)}°` : '--'}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
