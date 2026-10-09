import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Leaf,
  Zap,
  Droplets,
  Layers,
  Calculator,
  Sliders,
  Download,
  RotateCcw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Target,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Gauge
} from 'lucide-react';
import { carbonCalculator } from '../simulator/CarbonEngine';
import {
  CarbonImpactModel,
  EnvironmentalConfig,
  EnvironmentalMetric,
  DataSourceTag
} from '../simulator/types';

interface EnvironmentalImpactCardProps {
  compact?: boolean;
  onBenchmarkLoad?: () => void;
  telemetry?: any;
}

export const EnvironmentalImpactCard: React.FC<EnvironmentalImpactCardProps> = ({
  compact = false,
  onBenchmarkLoad,
  telemetry
}) => {
  const [model, setModel] = useState<CarbonImpactModel>(() => carbonCalculator.calculate());
  const [config, setConfig] = useState<EnvironmentalConfig>(() => carbonCalculator.getConfig());
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Sync real hardware telemetry into carbon engine when available
  useEffect(() => {
    if (telemetry) {
      const isRealHardware = Boolean(telemetry.wifi_connected || telemetry.bluetooth_connected);
      const batteryVoltage = typeof telemetry.battery_voltage === 'number' ? telemetry.battery_voltage : undefined;
      const currentA = typeof telemetry.motor_speed_pwm === 'number' ? (telemetry.motor_speed_pwm / 255) * 3.5 : undefined;
      const isPumpActive = Boolean(telemetry.pump_relay_active);

      carbonCalculator.updateFromHardware({
        isRealHardware,
        batteryVoltageV: batteryVoltage,
        batteryCurrentA: currentA,
        pumpActive: isPumpActive,
      });
    }
  }, [telemetry]);

  // Form state for assumptions configuration
  const [editBaselineRate, setEditBaselineRate] = useState<string>(
    config.baseline.applicationRateMlPerM2 !== null ? String(config.baseline.applicationRateMlPerM2) : ''
  );
  const [editFieldArea, setEditFieldArea] = useState<string>(String(config.field.fieldAreaM2));
  const [editCanopyArea, setEditCanopyArea] = useState<string>(String(config.field.canopyTargetAreaM2));
  const [editPumpFlowRate, setEditPumpFlowRate] = useState<string>(String(config.spray.pumpFlowRateMlPerSec));
  const [editRobotPower, setEditRobotPower] = useState<string>(String(config.energy.averageRobotPowerW));
  const [editChemFactor, setEditChemFactor] = useState<string>(
    config.carbonFactors.chemicalKgCO2ePerMl !== null ? String(config.carbonFactors.chemicalKgCO2ePerMl) : ''
  );
  const [editElecFactor, setEditElecFactor] = useState<string>(
    config.carbonFactors.electricityKgCO2ePerKWh !== null ? String(config.carbonFactors.electricityKgCO2ePerKWh) : ''
  );

  // Subscribe to live environmental engine updates
  useEffect(() => {
    const unsubscribe = carbonCalculator.subscribe(() => {
      setModel(carbonCalculator.calculate());
      setConfig(carbonCalculator.getConfig());
    });
    return unsubscribe;
  }, []);

  // Update form inputs when config changes externally
  useEffect(() => {
    setEditBaselineRate(
      config.baseline.applicationRateMlPerM2 !== null ? String(config.baseline.applicationRateMlPerM2) : ''
    );
    setEditFieldArea(String(config.field.fieldAreaM2));
    setEditCanopyArea(String(config.field.canopyTargetAreaM2));
    setEditPumpFlowRate(String(config.spray.pumpFlowRateMlPerSec));
    setEditRobotPower(String(config.energy.averageRobotPowerW));
    setEditChemFactor(
      config.carbonFactors.chemicalKgCO2ePerMl !== null ? String(config.carbonFactors.chemicalKgCO2ePerMl) : ''
    );
    setEditElecFactor(
      config.carbonFactors.electricityKgCO2ePerKWh !== null ? String(config.carbonFactors.electricityKgCO2ePerKWh) : ''
    );
  }, [config]);

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const newBaselineRate = editBaselineRate.trim() === '' ? null : parseFloat(editBaselineRate);
    const newFieldArea = parseFloat(editFieldArea) || 100.0;
    const newCanopyArea = parseFloat(editCanopyArea) || 1.8;
    const newPumpFlow = parseFloat(editPumpFlowRate) || 16.8;
    const newRobotPower = parseFloat(editRobotPower) || 45.0;
    const newChemFactor = editChemFactor.trim() === '' ? null : parseFloat(editChemFactor);
    const newElecFactor = editElecFactor.trim() === '' ? null : parseFloat(editElecFactor);

    carbonCalculator.setConfig({
      baseline: { applicationRateMlPerM2: newBaselineRate },
      field: { fieldAreaM2: newFieldArea, canopyTargetAreaM2: newCanopyArea, fieldWidthM: Math.sqrt(newFieldArea), fieldLengthM: Math.sqrt(newFieldArea) },
      spray: { pumpFlowRateMlPerSec: newPumpFlow, hasFlowSensor: false },
      energy: { averageRobotPowerW: newRobotPower, source: 'electricity', batteryVoltageBaselineV: 12.0 },
      carbonFactors: { chemicalKgCO2ePerMl: newChemFactor, electricityKgCO2ePerKWh: newElecFactor },
    });

    setIsConfigModalOpen(false);
  };

  const handleSetUnconfigured = () => {
    carbonCalculator.setConfig({
      baseline: { applicationRateMlPerM2: null },
      carbonFactors: { chemicalKgCO2ePerMl: null, electricityKgCO2ePerKWh: null }
    });
  };

  const handleLoadDeterministicBenchmark = () => {
    carbonCalculator.loadDeterministicBenchmark();
    if (onBenchmarkLoad) onBenchmarkLoad();
  };

  const handleExportJson = () => {
    const reportStr = carbonCalculator.exportReportJson();
    const blob = new Blob([reportStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agriguard-environmental-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSourceTag = (source: DataSourceTag) => {
    const colors: Record<DataSourceTag, { bg: string; text: string; border: string }> = {
      MEASURED: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--emerald-400)', border: 'rgba(16, 185, 129, 0.4)' },
      ESTIMATED: { bg: 'rgba(56, 189, 248, 0.15)', text: 'var(--sky-400)', border: 'rgba(56, 189, 248, 0.4)' },
      SIMULATED: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
      CONFIGURED_FACTOR: { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--amber-400)', border: 'rgba(245, 158, 11, 0.4)' },
    };
    const c = colors[source] || colors.ESTIMATED;
    return (
      <span style={{
        fontSize: '0.58rem',
        padding: '0.1rem 0.35rem',
        borderRadius: '4px',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontWeight: 800,
        letterSpacing: '0.02em',
        display: 'inline-block',
        marginLeft: '4px'
      }}>
        [{source}]
      </span>
    );
  };

  return (
    <div className="glass-panel" style={{
      padding: '1.25rem',
      borderRadius: '16px',
      border: '1px solid var(--border-subtle)',
      background: 'rgba(11, 19, 32, 0.92)',
      boxShadow: 'var(--shadow-glass)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      width: '100%'
    }}>
      {/* ── 1. Top Bar: Header & Controls ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--emerald-500), #065f46)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px var(--emerald-glow)'
          }}>
            <Leaf size={19} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                AgriGuard Environmental Impact & Carbon Intelligence
              </h3>
              <span className="status-pill" style={{
                background: model.mode === 'SIMULATION' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: model.mode === 'SIMULATION' ? 'var(--sky-400)' : 'var(--emerald-400)',
                border: `1px solid ${model.mode === 'SIMULATION' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                fontSize: '0.62rem',
                padding: '0.15rem 0.45rem',
                fontWeight: 800
              }}>
                MODE: {model.mode}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Precision resource quantification & comparative LCA emissions model
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            id="env-load-benchmark-btn"
            onClick={handleLoadDeterministicBenchmark}
            className="btn-glass btn-glass-emerald"
            title="Load Deterministic Benchmark (100 m² Field, 18 m² Treated, 420 mL Spray, 0.18 kWh)"
          >
            <Sparkles size={13} />
            <span>Load 100m² Benchmark</span>
          </button>

          <button
            type="button"
            id="env-view-calc-btn"
            onClick={() => setIsCalcModalOpen(true)}
            className="btn-glass btn-glass-sky"
            title="Inspect Step-by-Step Mathematical Calculations"
          >
            <Calculator size={13} />
            <span>View Calculation</span>
          </button>

          <button
            type="button"
            id="env-assumptions-btn"
            onClick={() => setIsConfigModalOpen(true)}
            className="btn-glass btn-glass-amber"
            title="Configure Field Geometry, Baseline Rates, and Emission Factors"
          >
            <Sliders size={13} />
            <span>Assumptions</span>
          </button>

          <button
            type="button"
            id="env-export-json-btn"
            onClick={handleExportJson}
            className="btn-glass"
            title="Export Verified Audit Report JSON"
          >
            <Download size={13} color="var(--emerald-400)" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            id="env-reset-counters-btn"
            onClick={() => carbonCalculator.reset()}
            className="btn-glass"
            style={{ padding: '5px 8px' }}
            title="Reset Environmental Counters"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── 2. Headline 4 Key KPI Metrics ───────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '0.75rem'
      }}>
        {/* KPI 1: Chemical Saved */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700 }}>
              Chemical Saved
            </span>
            {renderSourceTag(model.chemicalSavedMl.source)}
          </div>
          <div style={{ marginTop: '0.35rem' }}>
            {model.chemicalSavedMl.value !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--emerald-400)', letterSpacing: '-0.02em' }}>
                  {model.chemicalSavedMl.value}
                </span>
                <span style={{ fontSize: '0.80rem', color: 'var(--emerald-500)', fontWeight: 700 }}>mL</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--emerald-300)',
                  marginLeft: 'auto',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '6px'
                }}>
                  {model.chemicalReductionPercent.value}% less
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--amber-400)', fontWeight: 700 }}>
                Configure baseline rate
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Baseline: {model.baselineTreatmentVolumeMl.value !== null ? `${model.baselineTreatmentVolumeMl.value} mL` : 'N/A'} | Used: {model.agriguardTreatmentVolumeMl.value} mL
          </div>
        </div>

        {/* KPI 2: Targeted Treatment Area */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700 }}>
              Treatment Area Precision
            </span>
            {renderSourceTag(model.treatedAreaM2.source)}
          </div>
          <div style={{ marginTop: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--sky-400)', letterSpacing: '-0.02em' }}>
                {model.treatedAreaM2.value}
              </span>
              <span style={{ fontSize: '0.80rem', color: 'var(--sky-400)', fontWeight: 700 }}>m²</span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--sky-300)',
                marginLeft: 'auto',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '0.1rem 0.4rem',
                borderRadius: '6px'
              }}>
                {model.precisionTreatmentRate.value}% treated
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Field: {model.totalFieldAreaM2.value} m² | Unnecessary avoided: {model.unnecessaryAreaAvoidedM2.value} m²
          </div>
        </div>

        {/* KPI 3: Estimated Avoided CO2e */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700 }}>
              Estimated Avoided CO2e
            </span>
            {renderSourceTag(model.estimatedAvoidedCO2eKg.source)}
          </div>
          <div style={{ marginTop: '0.35rem' }}>
            {model.estimatedAvoidedCO2eKg.value !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c084fc', letterSpacing: '-0.02em' }}>
                  {model.estimatedAvoidedCO2eKg.value}
                </span>
                <span style={{ fontSize: '0.80rem', color: '#c084fc', fontWeight: 700 }}>kg</span>
                {model.carbonReductionPercent.value !== null && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#e9d5ff',
                    marginLeft: 'auto',
                    background: 'rgba(168, 85, 247, 0.18)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '6px'
                  }}>
                    {model.carbonReductionPercent.value}% cut
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--amber-400)', fontWeight: 700 }}>
                {config.carbonFactors.chemicalKgCO2ePerMl === null
                  ? 'Chemical factor not configured'
                  : 'No estimated avoidance for this run'}
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Base CO2e: {model.baselineFootprintKgCO2e.value !== null ? `${model.baselineFootprintKgCO2e.value} kg` : 'N/A'} | AgriGuard: {model.agriguardFootprintKgCO2e.value !== null ? `${model.agriguardFootprintKgCO2e.value} kg` : 'N/A'}
          </div>
        </div>

        {/* KPI 4: Robot Electrical Energy Footprint */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700 }}>
              Robot Energy Footprint
            </span>
            {renderSourceTag(model.robotEnergyKwh.source)}
          </div>
          <div style={{ marginTop: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--amber-400)', letterSpacing: '-0.02em' }}>
                {model.robotEnergyKwh.value}
              </span>
              <span style={{ fontSize: '0.80rem', color: 'var(--amber-400)', fontWeight: 700 }}>kWh</span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--amber-300)',
                marginLeft: 'auto',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '0.1rem 0.4rem',
                borderRadius: '6px'
              }}>
                {(model.operatingTimeHours.value * 60).toFixed(0)} min drive
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Platform Power: {config.energy.averageRobotPowerW} W | Grid Factor: {config.carbonFactors.electricityKgCO2ePerKWh ?? 'N/A'} kg/kWh
          </div>
        </div>
      </div>

      {/* ── 3. Comparative Breakdown: Conventional vs AgriGuard (Section 17) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
        gap: '0.85rem'
      }}>
        {/* Column 1: Conventional Blanket Treatment */}
        <div style={{
          background: 'rgba(244, 63, 94, 0.05)',
          border: '1px solid rgba(244, 63, 94, 0.22)',
          borderRadius: '12px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose-500)' }} />
              <strong style={{ fontSize: '0.80rem', color: 'var(--rose-400)', fontWeight: 800 }}>
                CONVENTIONAL FULL-AREA TREATMENT
              </strong>
            </div>
            {renderSourceTag('CONFIGURED_FACTOR')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', fontSize: '0.72rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>Treatment Volume</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {model.baselineTreatmentVolumeMl.value !== null ? `${model.baselineTreatmentVolumeMl.value} mL` : 'Unconfigured'}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>Treated Area</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {model.totalFieldAreaM2.value} m²
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>Estimated CO2e</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--rose-400)', marginTop: '2px' }}>
                {model.baselineFootprintKgCO2e.value !== null ? `${model.baselineFootprintKgCO2e.value} kg` : 'Unconfigured'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
            Conventional broadcast treats 100% of the field ({model.totalFieldAreaM2.value} m²) regardless of disease distribution.
            Application rate: {config.baseline.applicationRateMlPerM2 ?? 'Not configured'} mL/m².
          </div>
        </div>

        {/* Column 2: AgriGuard Targeted Precision Treatment */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.28)',
          borderRadius: '12px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--emerald-500)' }} />
              <strong style={{ fontSize: '0.80rem', color: 'var(--emerald-400)', fontWeight: 800 }}>
                AGRIGUARD TARGETED TREATMENT
              </strong>
            </div>
            {renderSourceTag(model.agriguardTreatmentVolumeMl.source)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', fontSize: '0.72rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>Targeted Volume</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--emerald-400)', marginTop: '2px' }}>
                {model.agriguardTreatmentVolumeMl.value} mL
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>Treated Area</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--emerald-400)', marginTop: '2px' }}>
                {model.treatedAreaM2.value} m²
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.45rem 0.55rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>AgriGuard CO2e</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--emerald-400)', marginTop: '2px' }}>
                {model.agriguardFootprintKgCO2e.value !== null ? `${model.agriguardFootprintKgCO2e.value} kg` : 'Unconfigured'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
            Sprays only confirmed pathological targets ({model.plantsTreatedCount} plant pulses recorded).
            Non-target plants spared: {model.nonTargetPlantsSparedCount} (82 m² of unnecessary blanket area avoided).
          </div>
        </div>
      </div>

      {/* ── 4. Transparency & Scientific Integrity Note ─────────────────────── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.68rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <ShieldCheck size={16} color="var(--emerald-400)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Scientific Integrity Principle:</strong> AgriGuard does not only perform precision treatment;
            it quantifies the resources used and estimates the environmental impact avoided by treating only the required areas.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsLogModalOpen(true)}
          className="btn-glass btn-glass-sky"
          style={{
            fontSize: '0.64rem',
            padding: '0.2rem 0.55rem',
            flexShrink: 0,
            marginLeft: '1rem'
          }}
        >
          View Event Log ({model.sprayEvents.length} sprays)
        </button>
      </div>

      {/* ── MODAL 1: VIEW CALCULATION STEP-BY-STEP (Section 22) ─────────────── */}
      {isCalcModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsCalcModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(3, 7, 18, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            overflow: 'hidden'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '860px',
              height: 'auto',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: 'linear-gradient(175deg, #0e192b 0%, #080f1a 100%)',
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85), 0 0 40px rgba(56, 189, 248, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header (Pinned) */}
            <div style={{
              flexShrink: 0,
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(14, 25, 43, 0.98)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  <Calculator size={20} color="var(--sky-400)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Carbon Calculation Transparency & Mathematical Derivations
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    Real-time mathematical equations evaluated dynamically from sensor and simulation events.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(false)}
                className="btn-glass"
                style={{ padding: '0.4rem', borderRadius: '8px' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {/* Category 1: Conventional Baseline */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.65rem',
                  color: 'var(--rose-400)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <span>1. Conventional Full-Area Baseline Accounting</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[model.breakdown.baselineChemical, model.breakdown.baselineEnergy, model.breakdown.baselineTotal]
                    .filter(Boolean)
                    .map((step, idx) => (
                      <div
                        key={`base-${idx}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${step.status === 'VALID' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(245, 158, 11, 0.35)'}`,
                          borderRadius: '12px',
                          padding: '0.85rem 1.1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff' }}>
                            {step.name}
                          </span>
                          <span style={{
                            fontSize: '0.60rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--emerald-400)' : 'var(--amber-400)',
                            background: step.status === 'VALID' ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                            border: `1px solid ${step.status === 'VALID' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {step.status === 'VALID' ? 'EVALUATED' : 'NOT CONFIGURED'}
                          </span>
                        </div>
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Formula: </span>
                          {step.formula}
                        </div>
                        <div style={{
                          background: 'rgba(56, 189, 248, 0.06)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: 'var(--sky-300)',
                          border: '1px solid rgba(56, 189, 248, 0.15)'
                        }}>
                          <span style={{ color: 'var(--sky-400)', fontWeight: 700 }}>Substitution: </span>
                          {step.substitution}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>Evaluated Result:</span>
                          <span style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--rose-400)' : 'var(--amber-400)'
                          }}>
                            {step.result}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Category 2: AgriGuard Precision */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.65rem',
                  color: 'var(--emerald-400)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <span>2. AgriGuard Targeted Precision Model</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[model.breakdown.agriguardChemical, model.breakdown.agriguardEnergy, model.breakdown.agriguardTotal]
                    .filter(Boolean)
                    .map((step, idx) => (
                      <div
                        key={`agri-${idx}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${step.status === 'VALID' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.35)'}`,
                          borderRadius: '12px',
                          padding: '0.85rem 1.1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff' }}>
                            {step.name}
                          </span>
                          <span style={{
                            fontSize: '0.60rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--emerald-400)' : 'var(--amber-400)',
                            background: step.status === 'VALID' ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                            border: `1px solid ${step.status === 'VALID' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {step.status === 'VALID' ? 'EVALUATED' : 'NOT CONFIGURED'}
                          </span>
                        </div>
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Formula: </span>
                          {step.formula}
                        </div>
                        <div style={{
                          background: 'rgba(56, 189, 248, 0.06)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: 'var(--sky-300)',
                          border: '1px solid rgba(56, 189, 248, 0.15)'
                        }}>
                          <span style={{ color: 'var(--sky-400)', fontWeight: 700 }}>Substitution: </span>
                          {step.substitution}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>Evaluated Result:</span>
                          <span style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--emerald-400)' : 'var(--amber-400)'
                          }}>
                            {step.result}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Category 3: Avoidance & Efficiency */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.65rem',
                  color: 'var(--sky-400)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <span>3. Net Avoided Impact & Precision Efficiency</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[model.breakdown.avoidedCO2e, model.breakdown.chemicalReduction, model.breakdown.precisionRate]
                    .filter(Boolean)
                    .map((step, idx) => (
                      <div
                        key={`avoid-${idx}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${step.status === 'VALID' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.35)'}`,
                          borderRadius: '12px',
                          padding: '0.85rem 1.1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff' }}>
                            {step.name}
                          </span>
                          <span style={{
                            fontSize: '0.60rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--emerald-400)' : 'var(--amber-400)',
                            background: step.status === 'VALID' ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                            border: `1px solid ${step.status === 'VALID' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {step.status === 'VALID' ? 'EVALUATED' : 'NOT CONFIGURED'}
                          </span>
                        </div>
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Formula: </span>
                          {step.formula}
                        </div>
                        <div style={{
                          background: 'rgba(56, 189, 248, 0.06)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: 'var(--sky-300)',
                          border: '1px solid rgba(56, 189, 248, 0.15)'
                        }}>
                          <span style={{ color: 'var(--sky-400)', fontWeight: 700 }}>Substitution: </span>
                          {step.substitution}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>Evaluated Result:</span>
                          <span style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: step.status === 'VALID' ? 'var(--emerald-400)' : 'var(--amber-400)'
                          }}>
                            {step.result}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div style={{
              flexShrink: 0,
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(14, 25, 43, 0.98)'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                Complies with agricultural GHG lifecycle accounting standards & Section 22 transparency.
              </span>
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(false)}
                className="btn btn-primary"
                style={{
                  padding: '0.45rem 1.35rem',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  borderRadius: '8px'
                }}
              >
                Close Derivations
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL 2: ASSUMPTIONS & CONFIGURATION PANEL (Section 23) ─────────── */}
      {isConfigModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsConfigModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(3, 7, 18, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            overflow: 'hidden'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              height: 'auto',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: 'linear-gradient(175deg, #111a28 0%, #0a1019 100%)',
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Header (Pinned) */}
            <div style={{
              flexShrink: 0,
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(17, 26, 40, 0.98)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>
                  <Sliders size={20} color="var(--amber-400)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Environmental Model Assumptions & Emission Factors
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    Configure baseline intensity, robot electrical power, and LCA carbon factors.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="btn-glass"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyConfig} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem'
              }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                {/* Field Area */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Total Field Area (m²)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    value={editFieldArea}
                    onChange={(e) => setEditFieldArea(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Micro-canopy Target Area */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Plant Micro-Canopy Target Area (m²)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editCanopyArea}
                    onChange={(e) => setEditCanopyArea(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Baseline Broadcast Application Rate */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Baseline Application Rate (mL / m²)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Leave empty for unconfigured"
                    value={editBaselineRate}
                    onChange={(e) => setEditBaselineRate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Prototype Pump Flow Rate */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Pump Prototype Flow Rate (mL / sec)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={editPumpFlowRate}
                    onChange={(e) => setEditPumpFlowRate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Average Robot Power */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Robot Electrical Power (Watts)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    value={editRobotPower}
                    onChange={(e) => setEditRobotPower(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Chemical Carbon Emission Factor */}
                <div>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Chemical Factor (kg CO2e / mL)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="e.g. 0.0105 (10.5 kg/L) or leave blank"
                    value={editChemFactor}
                    onChange={(e) => setEditChemFactor(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                {/* Electricity Emission Factor */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Electricity Grid Factor (kg CO2e / kWh)
                  </label>
                  <input
                    type="number"
                    step="0.005"
                    min="0"
                    placeholder="e.g. 0.475 or leave blank"
                    value={editElecFactor}
                    onChange={(e) => setEditElecFactor(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      color: '#fff',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>
              </div>

              </div>

              {/* Action Buttons (Pinned Footer) */}
              <div style={{
                flexShrink: 0,
                padding: '1rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(17, 26, 40, 0.98)'
              }}>
                <button
                  type="button"
                  onClick={handleSetUnconfigured}
                  className="btn-glass btn-glass-amber"
                  style={{
                    fontSize: '0.70rem',
                    padding: '0.4rem 0.75rem'
                  }}
                >
                  Clear to Unconfigured Mode
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="btn-glass"
                    style={{ fontSize: '0.74rem', padding: '0.45rem 0.95rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ fontSize: '0.74rem', padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 800 }}
                  >
                    Save & Recalculate
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL 3: STRUCTURED EVENT LOG VIEWER (Section 19) ───────────────── */}
      {isLogModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsLogModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(3, 7, 18, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            overflow: 'hidden'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '740px',
              height: 'auto',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'linear-gradient(175deg, #0d1e20 0%, #081214 100%)',
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Header (Pinned) */}
            <div style={{
              flexShrink: 0,
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(13, 30, 32, 0.98)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <FileText size={20} color="var(--emerald-400)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Chronological Environmental Event Audit Trail
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    Structured real-time event log for treatment actuation, runtime, and footprint accounting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="btn-glass"
                style={{ padding: '0.4rem', borderRadius: '8px' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Log Body */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {carbonCalculator.getEventLogs().length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  No environmental events recorded yet. Drive or spray targets to generate audit entries.
                </div>
              ) : (
                carbonCalculator.getEventLogs().map((log) => (
                  <div key={log.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{
                        fontSize: '0.60rem',
                        fontWeight: 800,
                        color: log.type === 'SPRAY' ? 'var(--emerald-400)' : log.type === 'AREA' ? 'var(--sky-400)' : 'var(--amber-400)',
                        background: log.type === 'SPRAY' ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.08)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {log.type}
                      </span>
                      <span style={{ color: '#fff' }}>{log.message}</span>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.66rem', fontFamily: 'monospace' }}>
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Pinned Log Footer */}
            <div style={{
              flexShrink: 0,
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: 'rgba(13, 30, 32, 0.98)'
            }}>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="btn-glass"
                style={{ fontSize: '0.76rem', padding: '0.45rem 1.15rem' }}
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
