/**
 * AgriGuard Digital Twin & 3D Farm Simulator — Type Definitions
 *
 * Provides:
 * - Plant and zone models
 * - Simulation telemetry (strictly aligned with AgriGuard TelemetryData)
 * - Environmental / Carbon impact calculation structures
 * - Scenario preset identifiers
 * - Event log schemas
 */

export type PlantHealthState = 'HEALTHY' | 'WARNING' | 'DISEASED' | 'TREATED';

export interface FarmPlant {
  id: string;
  row: number;
  col: number;
  position: { x: number; z: number };
  state: PlantHealthState;
  cropType: string;
  variety: string;
  healthScore: number; // 0 - 100
  disease?: {
    name: string;
    pathogen: string;
    confidence: number; // 0.0 - 1.0
    symptoms: string;
    recommendedTreatment: string;
    chemicalProduct: string;
    recommendedDoseMl: number;
    inventoryAvailable: boolean;
  };
  treatmentHistory?: {
    timestamp: string;
    action: string;
    dosageMl: number;
    operator: string;
    notes: string;
  }[];
}

export interface FieldZone {
  id: string;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  soilMoisturePct: number;
  npk: { n: number; p: number; k: number };
  temperatureC: number;
  humidityPct: number;
  soilCondition: 'OPTIMAL' | 'DRY' | 'SATURATED' | 'COMPACTED';
}

export interface ObstacleObject {
  id: string;
  type: 'ROCK' | 'CRATE' | 'FENCE_POST' | 'IRRIGATION_BOX';
  position: { x: number; y: number; z: number };
  radius: number;
  height: number;
}

export type SimulationMovementCommand = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP';

export interface SimulatorTelemetry {
  mode: 'SIMULATION';
  movement: SimulationMovementCommand;
  speedPwm: number;
  position: { x: number; z: number };
  headingDeg: number;
  ultrasonic: {
    left: number; // cm
    center: number; // cm
    right: number; // cm
  };
  safetyStopActive: boolean;
  buzzerState: 'OFF' | 'WARNING' | 'OBSTACLE';
  currentZone: FieldZone;
  soilMoisturePct: number;
  npk: { n: number; p: number; k: number };
  dht22: {
    temperature: number;
    humidity: number;
  };
  mpu6050: {
    accel_x: number;
    accel_y: number;
    accel_z: number;
    gyro_x: number;
    gyro_y: number;
    gyro_z: number;
    pitch_deg: number;
    roll_deg: number;
  };
  pumpState: 'OFF' | 'ON';
  relayState: 'OFF' | 'ON';
  sprayActive: boolean;
  sprayTargetPlantId: string | null;
  detectedPlant?: FarmPlant | null;
}

export type DataSourceTag = 'MEASURED' | 'ESTIMATED' | 'SIMULATED' | 'CONFIGURED_FACTOR';

export interface EnvironmentalMetric<T = number> {
  value: T;
  unit: string;
  source: DataSourceTag;
  label?: string;
  isConfigured?: boolean;
}

export interface SprayTreatmentEvent {
  id: string;
  plantId: string;
  zoneId: string;
  durationSec: number;
  estimatedVolumeMl: number;
  doseSource: DataSourceTag;
  timestamp: string;
  operator: string;
  chemicalProduct?: string;
}

export interface EnvironmentalConfig {
  mode: 'SIMULATION' | 'REAL_HARDWARE';
  
  baseline: {
    applicationRateMlPerM2: number | null; // e.g. 10.0 mL/m² (if null, unavailable)
    energyKWhPerM2?: number | null;
  };

  field: {
    fieldWidthM: number;
    fieldLengthM: number;
    fieldAreaM2: number; // e.g. 100 m² default benchmark
    canopyTargetAreaM2: number; // e.g. 1.8 m² per target
  };

  spray: {
    pumpFlowRateMlPerSec: number; // e.g. 16.8 mL/s prototype assumption
    hasFlowSensor: boolean;
  };

  energy: {
    source: 'electricity' | 'solar' | 'generator';
    averageRobotPowerW: number; // e.g. 45 W
    batteryVoltageBaselineV: number;
  };

  carbonFactors: {
    chemicalKgCO2ePerMl: number | null; // e.g. 0.0105 kg CO2e / mL or null
    electricityKgCO2ePerKWh: number | null; // e.g. 0.475 kg CO2e / kWh or null
  };
}

export interface CalculationStep {
  name: string;
  formula: string;
  substitution: string;
  result: string;
  status: 'VALID' | 'NOT_CONFIGURED';
}

export interface CalculationBreakdown {
  baselineChemical: CalculationStep;
  baselineEnergy: CalculationStep;
  baselineTotal: CalculationStep;
  agriguardChemical: CalculationStep;
  agriguardEnergy: CalculationStep;
  agriguardTotal: CalculationStep;
  avoidedCO2e: CalculationStep;
  chemicalReduction: CalculationStep;
  precisionRate: CalculationStep;
}

export interface CarbonImpactModel {
  mode: 'SIMULATION' | 'REAL_HARDWARE';
  
  // Chemical Metrics
  baselineTreatmentVolumeMl: EnvironmentalMetric<number | null>;
  agriguardTreatmentVolumeMl: EnvironmentalMetric<number>;
  chemicalSavedMl: EnvironmentalMetric<number | null>;
  chemicalReductionPercent: EnvironmentalMetric<number | null>;

  // Area Metrics
  totalFieldAreaM2: EnvironmentalMetric<number>;
  affectedAreaM2: EnvironmentalMetric<number>;
  treatedAreaM2: EnvironmentalMetric<number>;
  unnecessaryAreaAvoidedM2: EnvironmentalMetric<number>;
  precisionTreatmentRate: EnvironmentalMetric<number>;

  // Energy Metrics
  operatingTimeHours: EnvironmentalMetric<number>;
  robotEnergyKwh: EnvironmentalMetric<number>;

  // Carbon Metrics (null when factors are missing)
  baselineChemicalCO2eKg: EnvironmentalMetric<number | null>;
  baselineEnergyCO2eKg: EnvironmentalMetric<number | null>;
  baselineFootprintKgCO2e: EnvironmentalMetric<number | null>;

  agriguardChemicalCO2eKg: EnvironmentalMetric<number | null>;
  agriguardEnergyCO2eKg: EnvironmentalMetric<number | null>;
  agriguardFootprintKgCO2e: EnvironmentalMetric<number | null>;

  estimatedAvoidedCO2eKg: EnvironmentalMetric<number | null>;
  carbonReductionPercent: EnvironmentalMetric<number | null>;

  // Sets & Event Counts
  plantsTreatedCount: number;
  nonTargetPlantsSparedCount: number;
  treatedPlantIds: string[];
  sprayEvents: SprayTreatmentEvent[];

  // Calculation Transparency
  breakdown: CalculationBreakdown;
}

export interface EnvironmentalEventLog {
  id: string;
  timestamp: string;
  type: 'SPRAY' | 'OPERATING_TIME' | 'AREA' | 'FOOTPRINT_UPDATE' | 'CONFIG_CHANGE' | 'RESET';
  message: string;
}

export interface EnvironmentalReport {
  title: string;
  generatedAt: string;
  mode: 'SIMULATION' | 'REAL_HARDWARE';
  summary: {
    fieldAreaM2: number;
    affectedAreaM2: number;
    treatedAreaM2: number;
    unnecessaryAreaAvoidedM2: number;
    precisionTreatmentRatePercent: number;
    baselineTreatmentMl: number | null;
    agriguardTreatmentMl: number;
    chemicalSavedMl: number | null;
    chemicalReductionPercent: number | null;
    robotEnergyKWh: number;
    baselineCO2eKg: number | null;
    agriguardCO2eKg: number | null;
    estimatedAvoidedCO2eKg: number | null;
    estimatedCarbonReductionPercent: number | null;
  };
  assumptions: EnvironmentalConfig;
  dataSources: Record<string, DataSourceTag>;
  sprayEvents: SprayTreatmentEvent[];
  eventLogs: EnvironmentalEventLog[];
  disclaimer: string;
}

export type ScenarioPresetId =
  | 'NORMAL_FIELD'
  | 'OBSTACLE_AHEAD'
  | 'DISEASED_ZONE'
  | 'DRY_SOIL_ZONE'
  | 'PRECISION_SPRAY'
  | 'FULL_DEMO';

export interface SimulatorLogEvent {
  id: string;
  timestamp: string;
  type: 'INFO' | 'NAV' | 'SAFETY' | 'DETECTION' | 'TREATMENT' | 'ALERT';
  message: string;
}
