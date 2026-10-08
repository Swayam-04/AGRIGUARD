import React from 'react';
import { Activity, AlertTriangle, CheckCircle, HelpCircle, Gauge } from 'lucide-react';
import { AIDetection, TelemetryData } from '../types';

interface DiagnosisCardProps {
  detection: AIDetection | null;
  telemetry: TelemetryData | null;
}

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ detection, telemetry }) => {
  if (!detection) {
    return (
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Activity size={18} color="var(--emerald-400)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>AI Pathology & Health Score</h2>
        </div>
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.9rem' }}>Awaiting camera capture...</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Click "Capture & AI Scan" on the live camera viewport to evaluate crop pathology.
          </p>
        </div>
      </div>
    );
  }

  const isNonTarget = ['NO_VALID_LEAF', 'HUMAN_DETECTED', 'NON_TARGET_OBJECT', 'SOIL_SURFACE_NO_PLANT', 'UNSUPPORTED_CROP', 'LOW_QUALITY'].includes(detection.status);
  const isHuman = detection.status === 'HUMAN_DETECTED';
  const isLowConfidence = !isNonTarget && (detection.status === 'LOW_CONFIDENCE' || detection.status === 'LOW_CONFIDENCE_REVIEW' || detection.confidence < 0.60);
  const isHealthy = !isNonTarget && detection.disease === 'healthy';
  const healthScore = isNonTarget ? 100 : (detection.plant_health_score ?? 100);

  // Real agronomic stress flags from telemetry
  const soilMoisture = typeof telemetry?.soil_moisture === 'number'
    ? telemetry.soil_moisture
    : telemetry?.soil_moisture?.moisture_pct;
  const nitrogen = telemetry?.npk?.nitrogen_mg_kg;

  let waterStressLabel = 'NORMAL';
  if (soilMoisture !== undefined) {
    if (soilMoisture < 20) waterStressLabel = 'HIGH (DROUGHT)';
    else if (soilMoisture < 28) waterStressLabel = 'MODERATE';
    else if (soilMoisture > 75) waterStressLabel = 'WATERLOGGED';
  }

  let nStressLabel = 'NORMAL';
  if (nitrogen !== undefined && nitrogen > 0) {
    if (nitrogen < 30) nStressLabel = 'HIGH DEFICIENCY';
    else if (nitrogen < 50) nStressLabel = 'MODERATE DEFICIENCY';
  }

  // Health score color
  let scoreColor = 'var(--emerald-400)';
  if (healthScore < 50) scoreColor = 'var(--rose-500)';
  else if (healthScore < 75) scoreColor = 'var(--amber-400)';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--emerald-400)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>AI Pathology & Health Score</h2>
        </div>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Latency: {detection.inference_time_ms ?? 0}ms
        </span>
      </div>

      {/* Main Condition Header */}
      <div style={{
        padding: '1rem',
        borderRadius: 'var(--radius-md)',
        borderLeft: `4px solid ${
          isHuman
            ? '#ef4444'
            : isHealthy
              ? '#10b981'
              : isLowConfidence
                ? '#f59e0b'
                : isNonTarget
                  ? '#64748b'
                  : '#ef4444'
        }`,
        background: isHuman
          ? 'rgba(239, 68, 68, 0.15)'
          : isNonTarget
            ? 'rgba(100, 116, 139, 0.15)'
            : isLowConfidence
              ? 'rgba(245, 158, 11, 0.1)'
              : isHealthy
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(244, 63, 94, 0.1)',
        border: `1px solid ${
          isHuman
            ? 'rgba(239, 68, 68, 0.4)'
            : isNonTarget
              ? 'rgba(100, 116, 139, 0.4)'
              : isLowConfidence
                ? 'rgba(245, 158, 11, 0.3)'
                : isHealthy
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(244, 63, 94, 0.3)'
        }`,
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {isHuman ? (
            <AlertTriangle size={22} color="var(--rose-500)" />
          ) : isHealthy ? (
            <CheckCircle size={22} color="var(--emerald-400)" />
          ) : isNonTarget ? (
            <HelpCircle size={22} color="#94a3b8" />
          ) : isLowConfidence ? (
            <HelpCircle size={22} color="var(--amber-400)" />
          ) : (
            <AlertTriangle size={22} color="var(--rose-500)" />
          )}
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              {detection.display_name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {isNonTarget ? (
                <span>
                  Vision Filter: <strong style={{ color: isHuman ? 'var(--rose-500)' : 'var(--amber-400)' }}>
                    {isHuman ? 'SAFETY INTERLOCK ACTIVE' : 'NON-TARGET REJECTED'}
                  </strong> • Disease Model: <strong style={{ color: '#fff' }}>BYPASSED</strong>
                </span>
              ) : (
                <span>
                  Crop: {detection.crop} • Severity: <strong style={{ color: '#fff' }}>{detection.severity}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        
        {/* Plant Health Score / Target Verification */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            {isNonTarget ? 'Target Verification' : 'Overall Health Index'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            {isNonTarget ? (
              <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: isHuman ? 'var(--rose-500)' : 'var(--amber-400)' }}>
                {isHuman ? 'HUMAN SAFEGUARD' : 'REJECTED (NON-LEAF)'}
              </span>
            ) : (
              <>
                <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor }}>
                  {healthScore}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/100</span>
              </>
            )}
          </div>
        </div>

        {/* AI Confidence / Disease Model Status */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            {isNonTarget ? 'Pathology Classifier' : 'Model Confidence'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            {isNonTarget ? (
              <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8' }}>
                STANDBY (LOCKED)
              </span>
            ) : (
              <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: isLowConfidence ? 'var(--amber-400)' : '#fff' }}>
                {(detection.confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Affected Foliage Ratio / Spray Eligibility */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            {isNonTarget ? 'Target Spray Valve' : 'Lesion Coverage'}
          </div>
          <div className="mono" style={{ fontSize: isNonTarget ? '1rem' : '1.1rem', fontWeight: 700, color: isNonTarget ? 'var(--rose-500)' : '#fff' }}>
            {isNonTarget ? (
              'DISARMED (SAFE)'
            ) : (
              `${(detection.affected_area * 100).toFixed(1)}%`
            )}
          </div>
        </div>

        {/* Water Stress */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Water Stress Context
          </div>
          <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: waterStressLabel.includes('HIGH') ? 'var(--rose-500)' : '#fff' }}>
            {waterStressLabel}
          </div>
        </div>
      </div>

      {/* Supporting Diagnostic Context / Contraindications */}
      {(soilMoisture !== undefined && soilMoisture < 20) && (
        <div style={{
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          fontSize: '0.75rem',
          color: 'var(--amber-400)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          <AlertTriangle size={16} />
          <span>
            <strong>Drought Stress Active:</strong> Soil moisture is below 20%. Foliage chlorosis may be drought-induced.
          </span>
        </div>
      )}
    </div>
  );
};
