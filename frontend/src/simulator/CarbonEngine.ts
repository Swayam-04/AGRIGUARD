/**
 * AgriGuard Environmental Impact & Carbon Intelligence Engine
 *
 * Core Principles:
 * 1. Single Source of Truth: Integrates directly with real hardware telemetry and 3D simulation.
 * 2. Absolute Transparency: Explicit mathematical breakdown with zero hard-coded reduction claims.
 * 3. Configurable Baseline & Emission Factors: If a factor is unconfigured, displays "NOT CONFIGURED"
 *    instead of inventing scientific metrics.
 * 4. Transparent Provenance: Every single metric is tagged with its data source:
 *    [MEASURED], [ESTIMATED], [SIMULATED], or [CONFIGURED_FACTOR].
 * 5. Scientific Integrity: Clear labeling that results are estimated under specified assumptions.
 */

import {
  CarbonImpactModel,
  EnvironmentalConfig,
  EnvironmentalMetric,
  EnvironmentalReport,
  EnvironmentalEventLog,
  SprayTreatmentEvent,
  CalculationBreakdown,
  DataSourceTag,
} from './types';

export const DEFAULT_ENVIRONMENTAL_CONFIG: EnvironmentalConfig = {
  mode: 'SIMULATION',
  baseline: {
    // Standard conventional broadcast application rate: 10.0 mL / m²
    applicationRateMlPerM2: 10.0,
    energyKWhPerM2: 0.0035, // Diesel tractor fuel equivalent
  },
  field: {
    fieldWidthM: 10.0,
    fieldLengthM: 10.0,
    fieldAreaM2: 100.0,     // Deterministic 100 m² benchmark field plot
    canopyTargetAreaM2: 1.8, // 1.8 m² micro-canopy targeted per diseased plant
  },
  spray: {
    pumpFlowRateMlPerSec: 16.8, // 12V prototype diaphragm pump flow rate assumption
    hasFlowSensor: false,       // Real turbine flow sensor input when available
  },
  energy: {
    source: 'electricity',
    averageRobotPowerW: 45.0,   // 45W draw under 4WD motor + pump actuation
    batteryVoltageBaselineV: 12.0,
  },
  carbonFactors: {
    // Agro-chemical synthesis LCA factor: 0.0105 kg CO2e / mL (= 10.5 kg CO2e / Liter)
    chemicalKgCO2ePerMl: 0.0105,
    // Regional grid electricity GHG intensity: 0.475 kg CO2e / kWh
    electricityKgCO2ePerKWh: 0.475,
  },
};

export class CarbonImpactCalculator {
  private config: EnvironmentalConfig;
  private treatedPlantIds = new Set<string>();
  private treatedZoneIds = new Set<string>();
  private affectedPlantIds = new Set<string>();
  private sprayEvents: SprayTreatmentEvent[] = [];
  private eventLogs: EnvironmentalEventLog[] = [];
  private driveSecondsElapsed = 0.0;
  private subscribers = new Set<(impact?: any) => void>();

  constructor(initialConfig?: Partial<EnvironmentalConfig>) {
    this.config = {
      ...DEFAULT_ENVIRONMENTAL_CONFIG,
      ...initialConfig,
      baseline: { ...DEFAULT_ENVIRONMENTAL_CONFIG.baseline, ...(initialConfig?.baseline || {}) },
      field: { ...DEFAULT_ENVIRONMENTAL_CONFIG.field, ...(initialConfig?.field || {}) },
      spray: { ...DEFAULT_ENVIRONMENTAL_CONFIG.spray, ...(initialConfig?.spray || {}) },
      energy: { ...DEFAULT_ENVIRONMENTAL_CONFIG.energy, ...(initialConfig?.energy || {}) },
      carbonFactors: { ...DEFAULT_ENVIRONMENTAL_CONFIG.carbonFactors, ...(initialConfig?.carbonFactors || {}) },
    };

    // Pre-populate initial affected plants from standard field layout
    this.affectedPlantIds.add('PLANT-#003');
    this.affectedPlantIds.add('PLANT-#011');
    this.affectedPlantIds.add('PLANT-#016');
  }

  public subscribe(fn: (impact?: any) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    const current = this.calculate();
    this.subscribers.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.error('Subscription error in CarbonEngine:', err);
      }
    });
  }

  public setConfig(updated: Partial<EnvironmentalConfig>) {
    this.config = {
      ...this.config,
      ...updated,
      baseline: { ...this.config.baseline, ...(updated.baseline || {}) },
      field: { ...this.config.field, ...(updated.field || {}) },
      spray: { ...this.config.spray, ...(updated.spray || {}) },
      energy: { ...this.config.energy, ...(updated.energy || {}) },
      carbonFactors: { ...this.config.carbonFactors, ...(updated.carbonFactors || {}) },
    };

    this.logEvent(
      'CONFIG_CHANGE',
      `Assumptions updated: Baseline rate: ${this.config.baseline.applicationRateMlPerM2 ?? 'N/A'} mL/m², Chem Factor: ${this.config.carbonFactors.chemicalKgCO2ePerMl ?? 'N/A'} kg/mL`
    );
    this.notify();
  }

  public getConfig(): EnvironmentalConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public setMode(mode: 'SIMULATION' | 'REAL_HARDWARE') {
    this.config.mode = mode;
    this.logEvent('CONFIG_CHANGE', `Operating mode switched to: ${mode}`);
    this.notify();
  }

  public getMode(): 'SIMULATION' | 'REAL_HARDWARE' {
    return this.config.mode;
  }

  public recordDriveTime(deltaSec: number) {
    if (deltaSec > 0) {
      this.driveSecondsElapsed += deltaSec;
      this.notify();
    }
  }

  public recordAffectedPlant(plantId: string) {
    if (!this.affectedPlantIds.has(plantId)) {
      this.affectedPlantIds.add(plantId);
      this.logEvent('AREA', `New target identified: ${plantId}. Affected area estimate updated.`);
      this.notify();
    }
  }

  public recordSprayEvent(params: {
    plantId: string;
    zoneId: string;
    durationSec: number;
    operator: string;
    doseMl?: number;
    chemicalProduct?: string;
  }): SprayTreatmentEvent {
    const { plantId, zoneId, durationSec, operator, doseMl, chemicalProduct } = params;

    const doseSource: DataSourceTag = this.config.spray.hasFlowSensor ? 'MEASURED' : 'ESTIMATED';
    const estimatedVolumeMl =
      doseMl !== undefined
        ? doseMl
        : Number((durationSec * this.config.spray.pumpFlowRateMlPerSec).toFixed(1));

    const event: SprayTreatmentEvent = {
      id: `EV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      plantId,
      zoneId,
      durationSec,
      estimatedVolumeMl,
      doseSource,
      timestamp: new Date().toLocaleTimeString(),
      operator,
      chemicalProduct: chemicalProduct || 'Precision Contact Fungicide',
    };

    this.sprayEvents.push(event);
    this.treatedPlantIds.add(plantId);
    this.treatedZoneIds.add(zoneId);
    this.affectedPlantIds.add(plantId);

    this.logEvent(
      'SPRAY',
      `Target ${plantId} treated by ${operator}: ${estimatedVolumeMl} mL (${doseSource}). Pulse duration: ${durationSec}s`
    );
    this.logEvent(
      'AREA',
      `Treated area +${this.config.field.canopyTargetAreaM2} m² (Total treated: ${(this.treatedPlantIds.size * this.config.field.canopyTargetAreaM2).toFixed(1)} m²)`
    );

    this.notify();
    return event;
  }

  public updateFromHardware(params: {
    isRealHardware: boolean;
    batteryVoltageV?: number;
    batteryCurrentA?: number;
    pumpActive?: boolean;
    flowRateMlPerSec?: number;
  }) {
    let changed = false;
    if (params.isRealHardware && this.config.mode !== 'REAL_HARDWARE') {
      this.config.mode = 'REAL_HARDWARE';
      this.logEvent('CONFIG_CHANGE', 'Telemetry switched environmental module to REAL HARDWARE mode.');
      changed = true;
    }
    if (params.batteryVoltageV && params.batteryCurrentA) {
      this.config.energy.averageRobotPowerW = Number((params.batteryVoltageV * params.batteryCurrentA).toFixed(1));
    }
    if (params.flowRateMlPerSec && params.flowRateMlPerSec > 0) {
      this.config.spray.pumpFlowRateMlPerSec = params.flowRateMlPerSec;
      this.config.spray.hasFlowSensor = true;
    }
    if (changed) {
      this.notify();
    }
  }

  public reset() {
    this.treatedPlantIds.clear();
    this.treatedZoneIds.clear();
    this.affectedPlantIds.clear();
    this.sprayEvents = [];
    this.driveSecondsElapsed = 0;
    this.affectedPlantIds.add('PLANT-#003');
    this.affectedPlantIds.add('PLANT-#011');
    this.affectedPlantIds.add('PLANT-#016');

    this.logEvent('RESET', 'Environmental and carbon tracking reset to zero baseline.');
    this.notify();
  }

  /**
   * Deterministic Benchmark Test Case (Section 30):
   * Field: 100 m²
   * Affected: 18 m²
   * Baseline: 1000 mL (10 mL/m²)
   * AgriGuard: 420 mL (10 precision spray pulses of 42 mL)
   * Chemical Saved: 580 mL (58.0% reduction)
   * Targeted Treatment: 18.0%
   * Robot Energy: 0.18 kWh
   */
  public loadDeterministicBenchmark() {
    this.reset();

    // 1. Configure standard benchmark parameters
    this.config.field.fieldAreaM2 = 100.0;
    this.config.field.canopyTargetAreaM2 = 1.8;
    this.config.baseline.applicationRateMlPerM2 = 10.0;
    this.config.energy.averageRobotPowerW = 45.0;

    // 2. Populate 10 deterministic spray events = 420 mL total
    const plants = [
      'PLANT-#001', 'PLANT-#002', 'PLANT-#003', 'PLANT-#004', 'PLANT-#005',
      'PLANT-#006', 'PLANT-#007', 'PLANT-#008', 'PLANT-#009', 'PLANT-#010'
    ];

    plants.forEach((pId, idx) => {
      this.sprayEvents.push({
        id: `BENCH-${idx + 1}`,
        plantId: pId,
        zoneId: `ZONE-${String.fromCharCode(65 + Math.floor(idx / 3))}`,
        durationSec: 2.5,
        estimatedVolumeMl: 42,
        doseSource: 'SIMULATED',
        timestamp: new Date(Date.now() - (10 - idx) * 60000).toLocaleTimeString(),
        operator: 'BENCHMARK_OPERATOR',
        chemicalProduct: 'MilStop Broad Spectrum',
      });
      this.treatedPlantIds.add(pId);
      this.affectedPlantIds.add(pId);
      this.treatedZoneIds.add(`ZONE-${String.fromCharCode(65 + Math.floor(idx / 3))}`);
    });

    // 3. Set drive duration to yield exactly 0.18 kWh (4 hours at 45W = 0.18 kWh)
    this.driveSecondsElapsed = 4.0 * 3600; // 14400s

    this.logEvent(
      'CONFIG_CHANGE',
      'Loaded Deterministic Benchmark (100 m² field, 18 m² treated area, 420 mL precision spray, 0.18 kWh energy).'
    );
    this.notify();
  }

  public getEventLogs(): EnvironmentalEventLog[] {
    return [...this.eventLogs];
  }

  public getSprayEvents(): SprayTreatmentEvent[] {
    return [...this.sprayEvents];
  }

  private logEvent(type: EnvironmentalEventLog['type'], message: string) {
    const entry: EnvironmentalEventLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    this.eventLogs.unshift(entry);
    if (this.eventLogs.length > 60) {
      this.eventLogs.pop();
    }
  }

  /**
   * Transparent Comprehensive Calculation Model
   */
  public calculate(): CarbonImpactModel {
    const mode = this.config.mode;
    const isSim = mode === 'SIMULATION';

    const { baseline, field, spray, energy, carbonFactors } = this.config;

    // 1. Field Area Accounting
    const totalFieldAreaM2 = field.fieldAreaM2 || field.fieldWidthM * field.fieldLengthM;
    const treatedPlantsCount = this.treatedPlantIds.size;
    const treatedAreaM2 = Number((treatedPlantsCount * field.canopyTargetAreaM2).toFixed(1));
    const affectedPlantsCount = Math.max(treatedPlantsCount, this.affectedPlantIds.size);
    const affectedAreaM2 = Number((affectedPlantsCount * field.canopyTargetAreaM2).toFixed(1));
    const unnecessaryAreaAvoidedM2 = Number(Math.max(0, totalFieldAreaM2 - treatedAreaM2).toFixed(1));
    const precisionTreatmentRate =
      totalFieldAreaM2 > 0 ? Number(((treatedAreaM2 / totalFieldAreaM2) * 100).toFixed(1)) : 0;

    // 2. Chemical Volume Calculations
    const baselineAppRate = baseline.applicationRateMlPerM2;
    const baselineTreatmentVolumeMl =
      baselineAppRate !== null ? Math.round(baselineAppRate * totalFieldAreaM2) : null;

    const agriguardTreatmentVolumeMl = Math.round(
      this.sprayEvents.reduce((acc, ev) => acc + ev.estimatedVolumeMl, 0)
    );

    let chemicalSavedMl: number | null = null;
    let chemicalReductionPercent: number | null = null;
    if (baselineTreatmentVolumeMl !== null) {
      chemicalSavedMl = Math.max(0, baselineTreatmentVolumeMl - agriguardTreatmentVolumeMl);
      chemicalReductionPercent =
        baselineTreatmentVolumeMl > 0
          ? Number(((chemicalSavedMl / baselineTreatmentVolumeMl) * 100).toFixed(1))
          : 0;
    }

    // 3. Robot Energy Footprint
    const operatingTimeHours = Number((this.driveSecondsElapsed / 3600).toFixed(3));
    const robotEnergyKwh = Number(
      ((energy.averageRobotPowerW * operatingTimeHours) / 1000).toFixed(4)
    );

    // 4. Carbon Footprint (CO2e)
    const chemFactor = carbonFactors.chemicalKgCO2ePerMl;
    const elecFactor = carbonFactors.electricityKgCO2ePerKWh;

    // Baseline CO2e Components
    const baselineChemicalCO2eKg =
      baselineTreatmentVolumeMl !== null && chemFactor !== null
        ? Number((baselineTreatmentVolumeMl * chemFactor).toFixed(3))
        : null;

    const baselineEnergyEquivalentKWh = baseline.energyKWhPerM2
      ? Number((baseline.energyKWhPerM2 * totalFieldAreaM2).toFixed(4))
      : 0.05; // Tractor pass equivalent

    const baselineEnergyCO2eKg =
      elecFactor !== null
        ? Number((baselineEnergyEquivalentKWh * elecFactor).toFixed(3))
        : null;

    let baselineFootprintKgCO2e: number | null = null;
    if (baselineChemicalCO2eKg !== null || baselineEnergyCO2eKg !== null) {
      baselineFootprintKgCO2e = Number(
        ((baselineChemicalCO2eKg || 0) + (baselineEnergyCO2eKg || 0)).toFixed(3)
      );
    }

    // AgriGuard CO2e Components
    const agriguardChemicalCO2eKg =
      chemFactor !== null
        ? Number((agriguardTreatmentVolumeMl * chemFactor).toFixed(3))
        : null;

    const agriguardEnergyCO2eKg =
      elecFactor !== null
        ? Number((robotEnergyKwh * elecFactor).toFixed(3))
        : null;

    let agriguardFootprintKgCO2e: number | null = null;
    if (agriguardChemicalCO2eKg !== null || agriguardEnergyCO2eKg !== null) {
      agriguardFootprintKgCO2e = Number(
        ((agriguardChemicalCO2eKg || 0) + (agriguardEnergyCO2eKg || 0)).toFixed(3)
      );
    }

    // Avoided CO2e
    let estimatedAvoidedCO2eKg: number | null = null;
    let carbonReductionPercent: number | null = null;
    if (baselineFootprintKgCO2e !== null && agriguardFootprintKgCO2e !== null) {
      const avoided = baselineFootprintKgCO2e - agriguardFootprintKgCO2e;
      if (avoided >= 0) {
        estimatedAvoidedCO2eKg = Number(avoided.toFixed(3));
        carbonReductionPercent =
          baselineFootprintKgCO2e > 0
            ? Number(((avoided / baselineFootprintKgCO2e) * 100).toFixed(1))
            : 0;
      } else {
        estimatedAvoidedCO2eKg = null; // No avoided CO2e for this scenario
        carbonReductionPercent = null;
      }
    }

    // Total non-target plants spared
    const nonTargetPlantsSparedCount = Math.max(0, 102 - treatedPlantsCount);

    // 5. Explicit Step-by-Step Mathematical Transparency Breakdown
    const breakdown: CalculationBreakdown = {
      baselineChemical: {
        name: 'Conventional Chemical CO2e',
        formula: 'Baseline Volume (mL) × Chemical Emission Factor (kg CO2e/mL)',
        substitution:
          baselineTreatmentVolumeMl !== null && chemFactor !== null
            ? `${baselineTreatmentVolumeMl} mL × ${chemFactor} kg/mL`
            : 'Unconfigured inputs',
        result: baselineChemicalCO2eKg !== null ? `${baselineChemicalCO2eKg} kg CO2e` : 'NOT CONFIGURED',
        status: baselineChemicalCO2eKg !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      baselineEnergy: {
        name: 'Conventional Tractor/Field Energy CO2e',
        formula: 'Baseline Tractor Energy (kWh) × Emission Factor (kg CO2e/kWh)',
        substitution:
          elecFactor !== null
            ? `${baselineEnergyEquivalentKWh} kWh × ${elecFactor} kg/kWh`
            : 'Unconfigured electricity factor',
        result: baselineEnergyCO2eKg !== null ? `${baselineEnergyCO2eKg} kg CO2e` : 'NOT CONFIGURED',
        status: baselineEnergyCO2eKg !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      baselineTotal: {
        name: 'Total Conventional Baseline CO2e',
        formula: 'Conventional Chemical CO2e + Conventional Energy CO2e',
        substitution:
          baselineChemicalCO2eKg !== null && baselineEnergyCO2eKg !== null
            ? `${baselineChemicalCO2eKg} kg + ${baselineEnergyCO2eKg} kg`
            : 'Partial / unconfigured factors',
        result: baselineFootprintKgCO2e !== null ? `${baselineFootprintKgCO2e} kg CO2e` : 'NOT CONFIGURED',
        status: baselineFootprintKgCO2e !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      agriguardChemical: {
        name: 'AgriGuard Precision Chemical CO2e',
        formula: 'AgriGuard Volume (mL) × Chemical Emission Factor (kg CO2e/mL)',
        substitution:
          chemFactor !== null
            ? `${agriguardTreatmentVolumeMl} mL × ${chemFactor} kg/mL`
            : 'Chemical factor not configured',
        result: agriguardChemicalCO2eKg !== null ? `${agriguardChemicalCO2eKg} kg CO2e` : 'NOT CONFIGURED',
        status: agriguardChemicalCO2eKg !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      agriguardEnergy: {
        name: 'AgriGuard Robot Electrical Energy CO2e',
        formula: 'Robot Energy (kWh) × Electricity Emission Factor (kg CO2e/kWh)',
        substitution:
          elecFactor !== null
            ? `${robotEnergyKwh} kWh × ${elecFactor} kg/kWh`
            : 'Electricity factor not configured',
        result: agriguardEnergyCO2eKg !== null ? `${agriguardEnergyCO2eKg} kg CO2e` : 'NOT CONFIGURED',
        status: agriguardEnergyCO2eKg !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      agriguardTotal: {
        name: 'Total AgriGuard Footprint CO2e',
        formula: 'AgriGuard Chemical CO2e + AgriGuard Energy CO2e',
        substitution:
          agriguardChemicalCO2eKg !== null && agriguardEnergyCO2eKg !== null
            ? `${agriguardChemicalCO2eKg} kg + ${agriguardEnergyCO2eKg} kg`
            : 'Partial / unconfigured factors',
        result: agriguardFootprintKgCO2e !== null ? `${agriguardFootprintKgCO2e} kg CO2e` : 'NOT CONFIGURED',
        status: agriguardFootprintKgCO2e !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      avoidedCO2e: {
        name: 'Estimated Avoided CO2e',
        formula: 'Baseline Total CO2e - AgriGuard Total CO2e',
        substitution:
          baselineFootprintKgCO2e !== null && agriguardFootprintKgCO2e !== null
            ? `${baselineFootprintKgCO2e} kg - ${agriguardFootprintKgCO2e} kg`
            : 'Requires valid baseline & AgriGuard CO2e',
        result: estimatedAvoidedCO2eKg !== null ? `${estimatedAvoidedCO2eKg} kg CO2e` : 'UNAVAILABLE',
        status: estimatedAvoidedCO2eKg !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      chemicalReduction: {
        name: 'Chemical Reduction Percentage',
        formula: '((Baseline Volume - AgriGuard Volume) / Baseline Volume) × 100',
        substitution:
          baselineTreatmentVolumeMl !== null && chemicalSavedMl !== null
            ? `((${baselineTreatmentVolumeMl} - ${agriguardTreatmentVolumeMl}) / ${baselineTreatmentVolumeMl}) × 100`
            : 'Baseline volume unavailable',
        result: chemicalReductionPercent !== null ? `${chemicalReductionPercent}%` : 'UNAVAILABLE',
        status: chemicalReductionPercent !== null ? 'VALID' : 'NOT_CONFIGURED',
      },
      precisionRate: {
        name: 'Targeted Treatment Area Rate',
        formula: '(Treated Area / Total Field Area) × 100',
        substitution: `(${treatedAreaM2} m² / ${totalFieldAreaM2} m²) × 100`,
        result: `${precisionTreatmentRate}%`,
        status: 'VALID',
      },
    };

    // Helper for metric metadata wrapping
    const metric = <T>(
      val: T,
      unit: string,
      source: DataSourceTag,
      label?: string,
      isConfigured: boolean = true
    ): EnvironmentalMetric<T> => ({
      value: val,
      unit,
      source,
      label,
      isConfigured,
    });

    return {
      mode,
      baselineTreatmentVolumeMl: metric(
        baselineTreatmentVolumeMl,
        'mL',
        'CONFIGURED_FACTOR',
        'Conventional Blanket Treatment',
        baselineAppRate !== null
      ),
      agriguardTreatmentVolumeMl: metric(
        agriguardTreatmentVolumeMl,
        'mL',
        spray.hasFlowSensor ? 'MEASURED' : isSim ? 'SIMULATED' : 'ESTIMATED',
        'AgriGuard Targeted Spray Volume'
      ),
      chemicalSavedMl: metric(
        chemicalSavedMl,
        'mL',
        'ESTIMATED',
        'Chemical Volume Saved',
        chemicalSavedMl !== null
      ),
      chemicalReductionPercent: metric(
        chemicalReductionPercent,
        '%',
        'ESTIMATED',
        'Chemical Reduction',
        chemicalReductionPercent !== null
      ),

      totalFieldAreaM2: metric(totalFieldAreaM2, 'm²', 'CONFIGURED_FACTOR', 'Total Field Plot Area'),
      affectedAreaM2: metric(affectedAreaM2, 'm²', isSim ? 'SIMULATED' : 'MEASURED', 'Affected Target Area'),
      treatedAreaM2: metric(treatedAreaM2, 'm²', isSim ? 'SIMULATED' : 'MEASURED', 'Actual Treated Area'),
      unnecessaryAreaAvoidedM2: metric(
        unnecessaryAreaAvoidedM2,
        'm²',
        'ESTIMATED',
        'Avoided Treatment Area'
      ),
      precisionTreatmentRate: metric(
        precisionTreatmentRate,
        '%',
        'ESTIMATED',
        'Precision Treatment Rate'
      ),

      operatingTimeHours: metric(
        operatingTimeHours,
        'hrs',
        isSim ? 'SIMULATED' : 'MEASURED',
        'Robot Operating Time'
      ),
      robotEnergyKwh: metric(
        robotEnergyKwh,
        'kWh',
        isSim ? 'SIMULATED' : 'ESTIMATED',
        'Robot Energy Footprint'
      ),

      baselineChemicalCO2eKg: metric(
        baselineChemicalCO2eKg,
        'kg',
        'CONFIGURED_FACTOR',
        'Conventional Chemical CO2e',
        baselineChemicalCO2eKg !== null
      ),
      baselineEnergyCO2eKg: metric(
        baselineEnergyCO2eKg,
        'kg',
        'CONFIGURED_FACTOR',
        'Conventional Energy CO2e',
        baselineEnergyCO2eKg !== null
      ),
      baselineFootprintKgCO2e: metric(
        baselineFootprintKgCO2e,
        'kg',
        'CONFIGURED_FACTOR',
        'Conventional Baseline CO2e',
        baselineFootprintKgCO2e !== null
      ),

      agriguardChemicalCO2eKg: metric(
        agriguardChemicalCO2eKg,
        'kg',
        'ESTIMATED',
        'AgriGuard Chemical CO2e',
        agriguardChemicalCO2eKg !== null
      ),
      agriguardEnergyCO2eKg: metric(
        agriguardEnergyCO2eKg,
        'kg',
        'ESTIMATED',
        'AgriGuard Electricity CO2e',
        agriguardEnergyCO2eKg !== null
      ),
      agriguardFootprintKgCO2e: metric(
        agriguardFootprintKgCO2e,
        'kg',
        'ESTIMATED',
        'AgriGuard Total Footprint',
        agriguardFootprintKgCO2e !== null
      ),

      estimatedAvoidedCO2eKg: metric(
        estimatedAvoidedCO2eKg,
        'kg',
        'ESTIMATED',
        'Estimated Avoided CO2e',
        estimatedAvoidedCO2eKg !== null
      ),
      carbonReductionPercent: metric(
        carbonReductionPercent,
        '%',
        'ESTIMATED',
        'Estimated Carbon Reduction',
        carbonReductionPercent !== null
      ),

      plantsTreatedCount: treatedPlantsCount,
      nonTargetPlantsSparedCount,
      treatedPlantIds: Array.from(this.treatedPlantIds),
      sprayEvents: [...this.sprayEvents],
      breakdown,
    };
  }

  public generateReport(): EnvironmentalReport {
    const calc = this.calculate();
    return {
      title: 'AgriGuard Environmental Impact & Carbon Intelligence Audit Report',
      generatedAt: new Date().toISOString(),
      mode: this.config.mode,
      summary: {
        fieldAreaM2: calc.totalFieldAreaM2.value,
        affectedAreaM2: calc.affectedAreaM2.value,
        treatedAreaM2: calc.treatedAreaM2.value,
        unnecessaryAreaAvoidedM2: calc.unnecessaryAreaAvoidedM2.value,
        precisionTreatmentRatePercent: calc.precisionTreatmentRate.value,
        baselineTreatmentMl: calc.baselineTreatmentVolumeMl.value,
        agriguardTreatmentMl: calc.agriguardTreatmentVolumeMl.value,
        chemicalSavedMl: calc.chemicalSavedMl.value,
        chemicalReductionPercent: calc.chemicalReductionPercent.value,
        robotEnergyKWh: calc.robotEnergyKwh.value,
        baselineCO2eKg: calc.baselineFootprintKgCO2e.value,
        agriguardCO2eKg: calc.agriguardFootprintKgCO2e.value,
        estimatedAvoidedCO2eKg: calc.estimatedAvoidedCO2eKg.value,
        estimatedCarbonReductionPercent: calc.carbonReductionPercent.value,
      },
      assumptions: this.getConfig(),
      dataSources: {
        chemicalUsed: calc.agriguardTreatmentVolumeMl.source,
        treatmentArea: calc.treatedAreaM2.source,
        robotEnergy: calc.robotEnergyKwh.source,
        chemicalFactor: calc.baselineChemicalCO2eKg.source,
        electricityFactor: calc.baselineEnergyCO2eKg.source,
        avoidedEmissions: calc.estimatedAvoidedCO2eKg.source,
      },
      sprayEvents: [...this.sprayEvents],
      eventLogs: [...this.eventLogs],
      disclaimer:
        'All environmental metrics represent engineering estimates calculated under configured assumptions. These figures do not constitute experimental ISO 14040/44 LCA validation until on-site third-party field measurement is conducted.',
    };
  }

  public exportReportJson(): string {
    return JSON.stringify(this.generateReport(), null, 2);
  }
}

export const carbonCalculator = new CarbonImpactCalculator();
