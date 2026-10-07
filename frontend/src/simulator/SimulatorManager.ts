/**
 * AgriGuard Simulator — State Coordinator & Physics Controller
 *
 * Coordinates:
 * - Movement commands & kinematic stepping
 * - Tri-zone ultrasonic sensing & Hard-Stop safety logic
 * - Location-dependent soil moisture, NPK, and microclimate zones
 * - Dynamic MPU6050 physical acceleration & gyroscope derivation
 * - Crop inspection & target plant detection
 * - Farmer Approval Gate & precision chemical spray execution
 * - Environmental & Carbon footprint calculation
 * - Audio buzzer alerts
 * - Chronological event logging
 */

import { FarmScene } from './FarmScene';
import {
  FarmPlant,
  FieldZone,
  ScenarioPresetId,
  SimulationMovementCommand,
  SimulatorLogEvent,
  SimulatorTelemetry,
  CarbonImpactModel,
  ChemicalTankState,
  TreatmentWorkflowState,
  TreatmentEventRecord,
} from './types';
import { buzzerAudio } from './BuzzerAudio';
import { carbonCalculator, CarbonImpactCalculator } from './CarbonEngine';
import { SAFETY_THRESHOLDS } from '../digitalTwin/types';

// Pre-configured Field Zones
export const SIMULATOR_ZONES: FieldZone[] = [
  {
    id: 'ZONE-A-WEST',
    name: 'West Furrow (Sandy Loam)',
    bounds: { minX: -7.0, maxX: -2.5, minZ: -9.0, maxZ: 9.0 },
    soilMoisturePct: 24.8, // Dry Zone
    npk: { n: 32, p: 16, k: 42 },
    temperatureC: 30.6,
    humidityPct: 67.0,
    soilCondition: 'DRY',
  },
  {
    id: 'ZONE-B-CENTRAL',
    name: 'Central Ridge (Optimal Loam)',
    bounds: { minX: -2.5, maxX: 2.5, minZ: -9.0, maxZ: 0.0 },
    soilMoisturePct: 51.4, // Optimal Zone
    npk: { n: 58, p: 32, k: 48 },
    temperatureC: 28.8,
    humidityPct: 76.5,
    soilCondition: 'OPTIMAL',
  },
  {
    id: 'ZONE-C-NORTH',
    name: 'North Lowland (Moist Alluvial)',
    bounds: { minX: -2.5, maxX: 2.5, minZ: 0.0, maxZ: 9.0 },
    soilMoisturePct: 69.2, // Saturated Zone
    npk: { n: 46, p: 24, k: 38 },
    temperatureC: 27.5,
    humidityPct: 82.0,
    soilCondition: 'SATURATED',
  },
  {
    id: 'ZONE-D-EAST',
    name: 'East Terrace (Compacted Silt)',
    bounds: { minX: 2.5, maxX: 7.0, minZ: -9.0, maxZ: 9.0 },
    soilMoisturePct: 42.1, // Normal Zone
    npk: { n: 44, p: 26, k: 36 },
    temperatureC: 29.4,
    humidityPct: 73.0,
    soilCondition: 'COMPACTED',
  },
];

export class SimulatorManager {
  private scene: FarmScene;
  private currentMovement: SimulationMovementCommand = 'STOP';
  private speedPwm = 160; // Default drive PWM

  // Actuation states
  public pumpState: 'OFF' | 'ON' = 'OFF';
  public relayState: 'OFF' | 'ON' = 'OFF';
  public sprayActive = false;
  private sprayTimer: number | null = null;
  private totalChemicalUsedMl = 0;
  private totalTreatedPlantsCount = 0;
  private driveSecondsElapsed = 0;

  // Active Target Crop Plant
  public detectedPlant: FarmPlant | null = null;

  // ── Multi-Tank Precision Plumbing & Inventory State ────────────────────────
  public tanks: Record<'TANK_1' | 'TANK_2' | 'TANK_3', ChemicalTankState> = {
    TANK_1: {
      id: 'TANK_1',
      tankNumber: 1,
      label: 'Tank 1',
      treatmentName: 'Treatment A',
      chemicalProduct: 'Copper Hydroxide 77% Solution',
      chemicalClass: 'Inorganic Copper Fungicide (FRAC M01)',
      capacityMl: 1000.0,
      currentMl: 680.0,
      levelPct: 68.0,
      valveState: 'CLOSED',
      colorHex: 0x06b6d4,
      colorCss: '#06b6d4',
      minSafeLevelMl: 60.0,
      flowRateMlPerSec: 20.0,
    },
    TANK_2: {
      id: 'TANK_2',
      tankNumber: 2,
      label: 'Tank 2',
      treatmentName: 'Treatment B',
      chemicalProduct: 'Cold-Pressed Bio-Neem Solution',
      chemicalClass: 'Botanical Bio-Pesticide (Azadirachtin)',
      capacityMl: 800.0,
      currentMl: 336.0,
      levelPct: 42.0, // Matches prompt example: 42%!
      valveState: 'CLOSED',
      colorHex: 0x10b981,
      colorCss: '#10b981',
      minSafeLevelMl: 50.0,
      flowRateMlPerSec: 20.0,
    },
    TANK_3: {
      id: 'TANK_3',
      tankNumber: 3,
      label: 'Tank 3',
      treatmentName: 'Treatment C',
      chemicalProduct: 'Clean Rinsing & Mineral Protectant',
      chemicalClass: 'Solvent / Micronutrient Wash',
      capacityMl: 1200.0,
      currentMl: 0.0, // Matches prompt example: 0% / empty
      levelPct: 0.0,
      valveState: 'CLOSED',
      colorHex: 0x38bdf8,
      colorCss: '#38bdf8',
      minSafeLevelMl: 80.0,
      flowRateMlPerSec: 20.0,
    },
  };

  // Live Step-by-Step Treatment Delivery State
  public workflowState: TreatmentWorkflowState = {
    step: 'IDLE',
    stepIndex: 0,
    totalSteps: 15,
    activeTankId: null,
    activeValveId: null,
    activeNozzleId: null,
    pumpRunning: false,
    flowProgress: 0.0,
    targetPlant: null,
    requiredTreatment: null,
    sourceTankLabel: null,
    inventoryAvailable: false,
    estimatedVolumeMl: 40.0,
    durationSec: 2.0,
    inRange: false,
    distanceMeters: 0.0,
    statusMessage: 'Scanning crop furrows. Approach canopy to acquire target.',
    isFlowing: false,
    isSpraying: false,
    isCompleted: false,
  };

  public treatmentHistory: TreatmentEventRecord[] = [];
  private deliveryTimeouts: number[] = [];

  // Safety & Alarms
  public safetyStopActive = false;
  public buzzerMode: 'OFF' | 'WARNING' | 'OBSTACLE' = 'OFF';

  // Event Log
  public eventLogs: SimulatorLogEvent[] = [];

  // Scripted Demo Runner
  private isDemoRunning = false;
  private demoTimer: number | null = null;

  // Simulation Loop Timer
  private updateInterval: number | null = null;
  private lastUpdateTime = performance.now();

  // Listeners
  private onTelemetryUpdate?: (telemetry: SimulatorTelemetry) => void;
  private onLogsUpdate?: (logs: SimulatorLogEvent[]) => void;

  constructor(scene: FarmScene) {
    this.scene = scene;

    // Log initialization
    this.addLog('INFO', '3D AgriGuard Field Simulator initialized. Prototype rover ready.');

    // Start 20Hz Simulation Telemetry & Sensor Loop
    this.updateInterval = window.setInterval(() => {
      this.stepSimulation();
    }, 50);
  }

  public setCallbacks(
    onTelemetry: (telemetry: SimulatorTelemetry) => void,
    onLogs: (logs: SimulatorLogEvent[]) => void
  ) {
    this.onTelemetryUpdate = onTelemetry;
    this.onLogsUpdate = onLogs;
  }

  public getDetectedPlant(): FarmPlant | null {
    return this.detectedPlant;
  }

  public getSpeedPwm(): number {
    return this.speedPwm;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // User Movement Controls (Identical to Real Hardware Interface)
  // ───────────────────────────────────────────────────────────────────────────
  public move(command: SimulationMovementCommand, customPwm?: number) {
    if (customPwm !== undefined) {
      this.speedPwm = customPwm;
    }
    this.currentMovement = command;

    // Convert speed PWM (80-255) to real meters/sec (0.4 to 1.4 m/s)
    const linearSpeedMps = (this.speedPwm / 255.0) * 1.35;
    const angularSpeedRps = 1.35; // turning rate

    switch (command) {
      case 'FORWARD':
        if (this.safetyStopActive) {
          this.scene.targetSpeed = 0;
          this.addLog('SAFETY', 'Forward movement blocked: Obstacle hard-stop interlock active.');
          return;
        }
        this.scene.targetSpeed = linearSpeedMps;
        this.scene.targetTurnRate = 0;
        break;

      case 'BACKWARD':
        this.scene.targetSpeed = -linearSpeedMps * 0.75;
        this.scene.targetTurnRate = 0;
        // Reversing clears forward hard-stop
        this.safetyStopActive = false;
        break;

      case 'LEFT':
        // Differential In-Place Pivot (Zero forward creep, exactly matching physical AgriGuard)
        this.scene.targetSpeed = 0;
        this.scene.targetTurnRate = -angularSpeedRps;
        break;

      case 'RIGHT':
        // Differential In-Place Pivot (Zero forward creep, exactly matching physical AgriGuard)
        this.scene.targetSpeed = 0;
        this.scene.targetTurnRate = angularSpeedRps;
        break;

      case 'STOP':
      default:
        this.scene.targetSpeed = 0;
        this.scene.targetTurnRate = 0;
        break;
    }
  }

  /**
   * Combined forward/backward and steering arc control (e.g., holding W+D or S+A)
   */
  public steerCombined(linear: number, turn: number) {
    if (linear > 0 && this.safetyStopActive) {
      linear = 0;
    }
    if (linear < 0) {
      this.safetyStopActive = false;
    }
    this.scene.targetSpeed = linear;
    this.scene.targetTurnRate = turn;

    if (linear > 0.05 && Math.abs(turn) < 0.2) {
      this.currentMovement = 'FORWARD';
    } else if (linear < -0.05 && Math.abs(turn) < 0.2) {
      this.currentMovement = 'BACKWARD';
    } else if (turn < -0.2 && Math.abs(linear) < 0.05) {
      this.currentMovement = 'LEFT';
    } else if (turn > 0.2 && Math.abs(linear) < 0.05) {
      this.currentMovement = 'RIGHT';
    } else if (Math.abs(linear) <= 0.05 && Math.abs(turn) <= 0.05) {
      this.currentMovement = 'STOP';
    }
  }

  public emergencyStop() {
    this.currentMovement = 'STOP';
    this.scene.targetSpeed = 0;
    this.scene.targetTurnRate = 0;
    this.safetyStopActive = true;
    this.deactivateSpray();
    buzzerAudio.stop();
    this.addLog('ALERT', 'EMERGENCY STOP ENGAGED. All movement and spray actuators halted.');
  }

  public resetSafetyStop() {
    this.safetyStopActive = false;
    this.addLog('INFO', 'Safety stop interlock cleared by operator.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Realistic Multi-Tank Treatment Delivery Engine (15-Step Workflow)
  // ───────────────────────────────────────────────────────────────────────────
  public getTreatmentForPlant(plant: FarmPlant): {
    requiredTreatment: 'Treatment A' | 'Treatment B' | 'Treatment C';
    tankId: 'TANK_1' | 'TANK_2' | 'TANK_3';
    valveNum: 1 | 2 | 3;
    nozzleNum: 1 | 2 | 3;
    recommendedDoseMl: number;
    chemicalProduct: string;
  } {
    const diseaseName = plant.disease?.name?.toLowerCase() || '';
    if (diseaseName.includes('early blight') || diseaseName.includes('neem')) {
      return {
        requiredTreatment: 'Treatment B',
        tankId: 'TANK_2',
        valveNum: 2,
        nozzleNum: 2,
        recommendedDoseMl: 40.0,
        chemicalProduct: this.tanks.TANK_2.chemicalProduct,
      };
    } else if (diseaseName.includes('late blight') || diseaseName.includes('copper') || diseaseName.includes('bacterial') || diseaseName.includes('septoria')) {
      return {
        requiredTreatment: 'Treatment A',
        tankId: 'TANK_1',
        valveNum: 1,
        nozzleNum: 1,
        recommendedDoseMl: 45.0,
        chemicalProduct: this.tanks.TANK_1.chemicalProduct,
      };
    } else {
      return {
        requiredTreatment: 'Treatment C',
        tankId: 'TANK_3',
        valveNum: 3,
        nozzleNum: 3,
        recommendedDoseMl: 30.0,
        chemicalProduct: this.tanks.TANK_3.chemicalProduct,
      };
    }
  }

  public updateWorkflowForTarget(plant: FarmPlant | null) {
    if (!plant || plant.state === 'HEALTHY') {
      if (!this.workflowState.isFlowing && !this.workflowState.isSpraying && this.workflowState.step !== 'COMPLETED') {
        this.workflowState = {
          ...this.workflowState,
          step: 'IDLE',
          stepIndex: 0,
          targetPlant: null,
          requiredTreatment: null,
          sourceTankLabel: null,
          statusMessage: 'Scanning crop furrows. Approach canopy to acquire target.',
        };
      }
      return;
    }

    if (this.workflowState.isFlowing || this.workflowState.isSpraying) {
      return; // Do not disrupt active physical delivery sequence
    }

    const trtInfo = this.getTreatmentForPlant(plant);
    const targetTank = this.tanks[trtInfo.tankId];
    const isAvail = targetTank.currentMl >= trtInfo.recommendedDoseMl;
    const dist = this.scene.getDistanceToPlant(plant);
    const inRange = dist <= 2.2;

    this.workflowState = {
      ...this.workflowState,
      step: plant.state === 'TREATED' ? 'COMPLETED' : 'RANGE_CHECKED',
      stepIndex: plant.state === 'TREATED' ? 15 : 5,
      targetPlant: plant,
      requiredTreatment: trtInfo.requiredTreatment,
      activeTankId: trtInfo.tankId,
      activeValveId: trtInfo.valveNum,
      activeNozzleId: trtInfo.nozzleNum,
      sourceTankLabel: `${targetTank.label} (${targetTank.treatmentName})`,
      inventoryAvailable: isAvail,
      estimatedVolumeMl: trtInfo.recommendedDoseMl,
      durationSec: trtInfo.recommendedDoseMl / targetTank.flowRateMlPerSec,
      inRange,
      distanceMeters: Number(dist.toFixed(2)),
      statusMessage: plant.state === 'TREATED'
        ? `${plant.id} is already TREATED.`
        : !isAvail
        ? `Required treatment unavailable: ${targetTank.label} is EMPTY. Farmer action required.`
        : !inRange
        ? `TARGET OUT OF RANGE (${dist.toFixed(1)}m): Move rover within 2.2m to spray.`
        : `TARGET IN RANGE (${dist.toFixed(1)}m): ${trtInfo.requiredTreatment} ready in ${targetTank.label}. Awaiting Farmer Approval.`,
      isCompleted: plant.state === 'TREATED',
    };
  }

  public approveAndSpray(operatorName: string): boolean {
    if (!this.detectedPlant) {
      this.addLog('ALERT', 'Treatment rejected: No plant target acquired.');
      return false;
    }

    const plant = this.detectedPlant;
    if (plant.state === 'TREATED') {
      this.addLog('INFO', `Target ${plant.id} is already TREATED. Additional spray skipped.`);
      return false;
    }

    if (this.safetyStopActive) {
      this.addLog('ALERT', 'Treatment rejected: Safety hard-stop is active. Maneuver clear of obstacle.');
      return false;
    }

    const trtInfo = this.getTreatmentForPlant(plant);
    const targetTank = this.tanks[trtInfo.tankId];
    const doseMl = trtInfo.recommendedDoseMl;
    const durationSec = doseMl / targetTank.flowRateMlPerSec;

    // Inventory Gate
    if (targetTank.currentMl < doseMl) {
      this.workflowState = {
        ...this.workflowState,
        step: 'INVENTORY_CHECKED',
        inventoryAvailable: false,
        statusMessage: `TREATMENT UNAVAILABLE: ${targetTank.label} (${targetTank.treatmentName}) is EMPTY. Farmer intervention required.`,
      };
      this.addLog('ALERT', `TREATMENT UNAVAILABLE: ${targetTank.label} has insufficient chemical stock (${targetTank.currentMl} mL remaining). Refill required.`);
      return false;
    }

    // Range Gate
    const dist = this.scene.getDistanceToPlant(plant);
    if (dist > 2.2) {
      this.workflowState = {
        ...this.workflowState,
        step: 'RANGE_CHECKED',
        inRange: false,
        statusMessage: `TARGET OUT OF RANGE (${dist.toFixed(1)}m): Move robot closer along furrow (within 2.2m) before spraying.`,
      };
      this.addLog('ALERT', `TARGET OUT OF RANGE: Distance to ${plant.id} is ${dist.toFixed(2)}m (Max reach is 2.2m).`);
      return false;
    }

    // Clear any previous delivery timers
    this.deliveryTimeouts.forEach((t) => window.clearTimeout(t));
    this.deliveryTimeouts = [];

    // STEP 5: Farmer Approved
    const token = `AUTH-SIM-${Date.now()}-${operatorName.toUpperCase()}`;
    this.workflowState = {
      ...this.workflowState,
      step: 'FARMER_APPROVED',
      stepIndex: 6,
      statusMessage: `Farmer approval verified (${operatorName}). Token: ${token}. Starting delivery sequence.`,
    };
    this.addLog('TREATMENT', `Farmer approval verified (${operatorName}). Token: ${token}. Initiating physical plumbing line.`);

    // STEP 5 & 6 (T = 0s): Select Tank & Open Corresponding Valve
    const t1 = window.setTimeout(() => {
      this.workflowState = {
        ...this.workflowState,
        step: 'VALVE_OPENED',
        stepIndex: 8,
        activeTankId: trtInfo.tankId,
        activeValveId: trtInfo.valveNum,
        statusMessage: `${targetTank.label} (${trtInfo.requiredTreatment}) selected. Valve ${trtInfo.valveNum}: OPEN. All other valves: CLOSED.`,
      };
      // 3D Visual Valve State: only the selected valve opens!
      [1, 2, 3].forEach((vNum) => {
        const vState = vNum === trtInfo.valveNum ? 'OPEN' : 'CLOSED';
        this.tanks[`TANK_${vNum}` as 'TANK_1' | 'TANK_2' | 'TANK_3'].valveState = vState;
        this.scene.robotRefs?.plumbing?.setValveState(vNum as 1 | 2 | 3, vState);
      });
      this.addLog('TREATMENT', `[STEP 5 & 6] ${targetTank.label} selected. Valve ${trtInfo.valveNum}: OPEN. Other valves: CLOSED.`);
    }, 80);
    this.deliveryTimeouts.push(t1);

    // STEP 7 & 8 (T = 500ms): Activate 12V Pump & Visible Liquid Pipe Flow
    const t2 = window.setTimeout(() => {
      this.pumpState = 'ON';
      this.relayState = 'ON';
      this.workflowState = {
        ...this.workflowState,
        step: 'PIPE_FLOWING',
        stepIndex: 10,
        pumpRunning: true,
        isFlowing: true,
        statusMessage: `12V Diaphragm Pump: ON. Liquid travelling through Pipe ${trtInfo.valveNum}: ${targetTank.label} → Valve ${trtInfo.valveNum} → Manifold → Nozzle ${trtInfo.nozzleNum}.`,
      };
      this.scene.robotRefs?.plumbing?.setPumpState('ON');
      this.scene.robotRefs?.plumbing?.setPipeFlow(trtInfo.valveNum, true);
      this.addLog('TREATMENT', `[STEP 7 & 8] 12V Pump: ON. Fluid flowing through Pipe ${trtInfo.valveNum}: ${targetTank.label} → Valve ${trtInfo.valveNum} → Manifold → Nozzle ${trtInfo.nozzleNum}.`);
    }, 550);
    this.deliveryTimeouts.push(t2);

    // STEP 9 & 10 (T = 1200ms): Liquid Reaches Nozzle & Spray Hits Target Plant
    const t3 = window.setTimeout(() => {
      this.sprayActive = true;
      this.workflowState = {
        ...this.workflowState,
        step: 'NOZZLE_SPRAYING',
        stepIndex: 12,
        activeNozzleId: trtInfo.nozzleNum,
        isSpraying: true,
        statusMessage: `Liquid reached Nozzle ${trtInfo.nozzleNum}. Precision targeted spray active on ${plant.id}.`,
      };
      this.scene.activateTreatmentSpray(plant, trtInfo.nozzleNum, trtInfo.valveNum);
      this.addLog('TREATMENT', `[STEP 9 & 10] Nozzle ${trtInfo.nozzleNum}: ACTIVE. Atomizing micro-pulse directed exclusively at ${plant.id}.`);
    }, 1250);
    this.deliveryTimeouts.push(t3);

    // STEP 11, 12, 13 (T = 3250ms): Spray Stops, Valve Closes, Pump Stops
    const pulseEndMs = 1250 + Math.round(durationSec * 1000);
    const t4 = window.setTimeout(() => {
      this.sprayActive = false;
      this.pumpState = 'OFF';
      this.relayState = 'OFF';
      this.scene.deactivateSpray();
      this.scene.robotRefs?.plumbing?.setPipeFlow(trtInfo.valveNum, false);
      this.scene.robotRefs?.plumbing?.setValveState(trtInfo.valveNum, 'CLOSED');
      this.scene.robotRefs?.plumbing?.setPumpState('OFF');
      this.tanks[trtInfo.tankId].valveState = 'CLOSED';

      this.workflowState = {
        ...this.workflowState,
        step: 'VALVE_CLOSED',
        stepIndex: 14,
        pumpRunning: false,
        isFlowing: false,
        isSpraying: false,
        statusMessage: `Target spray complete. Valve ${trtInfo.valveNum}: CLOSED. 12V Pump: OFF.`,
      };
      this.addLog('TREATMENT', `[STEP 11, 12, 13] Spray pulse ended. Valve ${trtInfo.valveNum}: CLOSED. 12V Pump: OFF.`);
    }, pulseEndMs);
    this.deliveryTimeouts.push(t4);

    // STEP 14 & 15 (T = 3600ms): Plant State -> TREATED, Inventory Decremented, Event Logged
    const completeMs = pulseEndMs + 350;
    const t5 = window.setTimeout(() => {
      // 1. Plant Transition to TREATED
      this.scene.updatePlantState(plant.id, 'TREATED');
      plant.state = 'TREATED';
      plant.healthScore = Math.min(96, plant.healthScore + 45);
      this.scene.updateTargetReticle(plant);

      // 2. Decrement selected tank inventory exactly
      targetTank.currentMl = Math.max(0, targetTank.currentMl - doseMl);
      targetTank.levelPct = Number(((targetTank.currentMl / targetTank.capacityMl) * 100).toFixed(1));
      this.scene.robotRefs?.plumbing?.setTankLevel(trtInfo.valveNum, targetTank.levelPct);

      this.totalChemicalUsedMl += doseMl;
      this.totalTreatedPlantsCount++;

      // 3. Treatment History Record
      const eventRecord: TreatmentEventRecord = {
        id: `TRT-EVT-${Date.now()}`,
        plantId: plant.id,
        crop: plant.cropType,
        disease: plant.disease?.name || 'Pathology',
        confidence: plant.disease?.confidence || 0.94,
        requiredTreatment: trtInfo.requiredTreatment,
        tankUsed: targetTank.label,
        valveUsed: `Valve ${trtInfo.valveNum}`,
        nozzleUsed: `Nozzle ${trtInfo.nozzleNum}`,
        sprayDurationSec: durationSec,
        estimatedVolumeMl: doseMl,
        timestamp: new Date().toLocaleTimeString(),
        status: 'COMPLETED',
        operator: operatorName,
      };
      this.treatmentHistory.unshift(eventRecord);

      if (!plant.treatmentHistory) plant.treatmentHistory = [];
      plant.treatmentHistory.push({
        timestamp: eventRecord.timestamp,
        action: `${trtInfo.requiredTreatment} via ${targetTank.label}`,
        dosageMl: doseMl,
        operator: operatorName,
        notes: `Targeted micro-pulse application (${durationSec}s). Nozzle ${trtInfo.nozzleNum}. Status: TREATED.`,
      });

      // 4. Update Environmental Impact / Carbon Engine
      const currentZone = this.getZoneAtPosition(this.scene.robotX, this.scene.robotZ);
      carbonCalculator.recordSprayEvent({
        plantId: plant.id,
        zoneId: currentZone.id,
        durationSec,
        operator: operatorName,
        doseMl,
        chemicalProduct: targetTank.chemicalProduct,
      });

      this.workflowState = {
        ...this.workflowState,
        step: 'COMPLETED',
        stepIndex: 15,
        isCompleted: true,
        statusMessage: `TREATMENT COMPLETE: ${plant.id} is now TREATED. Delivered ${doseMl} mL (ESTIMATED). ${targetTank.label} level: ${targetTank.levelPct}% (${targetTank.currentMl.toFixed(0)} mL).`,
      };

      this.addLog(
        'TREATMENT',
        `[STEP 14 & 15] ${plant.id} TREATED. Delivered: ${doseMl} mL (ESTIMATED) ${targetTank.chemicalProduct}. Inventory: ${targetTank.levelPct}% (${targetTank.currentMl.toFixed(0)} mL). Avoided CO2e metrics updated.`
      );
    }, completeMs);
    this.deliveryTimeouts.push(t5);

    return true;
  }

  public deactivateSpray() {
    this.deliveryTimeouts.forEach((t) => window.clearTimeout(t));
    this.deliveryTimeouts = [];
    if (this.sprayTimer) {
      window.clearTimeout(this.sprayTimer);
      this.sprayTimer = null;
    }
    this.pumpState = 'OFF';
    this.relayState = 'OFF';
    this.sprayActive = false;
    this.scene.deactivateSpray();
    [1, 2, 3].forEach((n) => {
      this.scene.robotRefs?.plumbing?.setPipeFlow(n as 1 | 2 | 3, false);
      this.scene.robotRefs?.plumbing?.setValveState(n as 1 | 2 | 3, 'CLOSED');
    });
    this.scene.robotRefs?.plumbing?.setPumpState('OFF');
  }

  public refillTanks() {
    this.tanks.TANK_1.currentMl = 680.0;
    this.tanks.TANK_1.levelPct = 68.0;
    this.tanks.TANK_2.currentMl = 336.0;
    this.tanks.TANK_2.levelPct = 42.0;
    this.tanks.TANK_3.currentMl = 360.0;
    this.tanks.TANK_3.levelPct = 30.0;

    [1, 2, 3].forEach((n) => {
      this.scene.robotRefs?.plumbing?.setTankLevel(
        n as 1 | 2 | 3,
        this.tanks[`TANK_${n}` as 'TANK_1' | 'TANK_2' | 'TANK_3'].levelPct
      );
    });

    this.addLog('TREATMENT', 'All 3 treatment tanks refilled and verified ready.');
    if (this.detectedPlant) {
      this.updateWorkflowForTarget(this.detectedPlant);
    }
  }

  public runTreatmentDemo(): boolean {
    // 1. Locate Plant #023 (or fallback to nearest diseased crop)
    const plants = this.scene.getAllPlants();
    let targetPlant = plants.find((p) => p.id === 'Plant #023' || p.id === 'PLANT-#023');
    if (!targetPlant) {
      targetPlant = plants.find((p) => p.state === 'DISEASED');
    }
    if (!targetPlant) {
      this.addLog('ALERT', 'Demo aborted: No diseased plant found in field.');
      return false;
    }

    // 2. Position robot directly adjacent to target plant in driving furrow (within 1.4m range)
    this.scene.robotX = 0.0;
    this.scene.robotZ = 2.0;
    this.scene.robotHeading = 0.0; // Heading North, plant is to the left at X: -1.5, Z: 2.0
    this.scene.syncRobotTransform();

    // 3. Acquire plant in camera view
    this.detectedPlant = targetPlant;
    this.scene.updateTargetReticle(targetPlant);
    this.updateWorkflowForTarget(targetPlant);

    this.addLog('DETECTION', `DEMO: Rover positioned adjacent to ${targetPlant.id}. Virtual camera acquired diseased canopy.`);
    this.addLog('INFO', `DEMO AI DIAGNOSIS: Crop: Tomato, Disease: Early Blight, Confidence: 94%, Severity: Moderate.`);

    // 4. Automatically trigger approval and run 15-step sequence
    window.setTimeout(() => {
      this.approveAndSpray('Swayam-Lead (Demo)');
    }, 600);

    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Simulation Step (Physics, Raycasting, Environmental Lookup)
  // ───────────────────────────────────────────────────────────────────────────
  private stepSimulation() {
    const now = performance.now();
    const deltaSec = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
    this.lastUpdateTime = now;

    // Track drive time for energy accounting
    if (Math.abs(this.scene.robotSpeed) > 0.02) {
      this.driveSecondsElapsed += deltaSec;
      carbonCalculator.recordDriveTime(deltaSec);
    }

    // 1. Genuine 3D Ultrasonic Raycast Measurements
    const ultrasonic = this.scene.computeUltrasonicDistances();

    // Auto-clear safety stop when forward corridor clears (>= 32 cm)
    if (this.safetyStopActive && ultrasonic.centerCm >= 32) {
      this.safetyStopActive = false;
    }

    // 2. Kinematic & Collision Step
    const { safetyStop, blocked } = this.scene.updateKinematics(deltaSec, ultrasonic.centerCm);
    if (blocked && this.currentMovement === 'FORWARD') {
      this.currentMovement = 'STOP';
      this.addLog('NAV', 'Forward path blocked: Steer left/right or reverse to maneuver.');
    }
    if (safetyStop && !this.safetyStopActive) {
      this.safetyStopActive = true;
      this.currentMovement = 'STOP';
      this.addLog('SAFETY', `SAFETY HARD STOP: Center obstacle detected at ${ultrasonic.centerCm} cm!`);
    }

    // 3. Buzzer Simulation Logic (Web Audio API)
    const minDistance = Math.min(ultrasonic.centerCm, ultrasonic.leftCm, ultrasonic.rightCm);
    if (minDistance < SAFETY_THRESHOLDS.OBSTACLE_CM) {
      this.buzzerMode = 'OBSTACLE';
      buzzerAudio.setBuzzerState('OBSTACLE');
    } else if (minDistance <= SAFETY_THRESHOLDS.WARNING_CM) {
      this.buzzerMode = 'WARNING';
      buzzerAudio.setBuzzerState('WARNING');
    } else {
      this.buzzerMode = 'OFF';
      buzzerAudio.setBuzzerState('OFF');
    }

    // 4. Spatial Environmental Zone Lookup
    const currentZone = this.getZoneAtPosition(this.scene.robotX, this.scene.robotZ);

    // 5. Virtual Camera Crop Detection
    const plantInFront = this.scene.getDetectedPlantInFront();
    if (plantInFront !== this.detectedPlant) {
      this.detectedPlant = plantInFront;
      this.scene.updateTargetReticle(plantInFront);
      if (plantInFront) {
        if (plantInFront.state === 'DISEASED' || plantInFront.state === 'WARNING') {
          carbonCalculator.recordAffectedPlant(plantInFront.id);
          this.addLog(
            'DETECTION',
            `Foliage acquired: ${plantInFront.id} [${plantInFront.state}]. Disease: ${plantInFront.disease?.name || 'Unknown'}`
          );
        } else {
          this.addLog('INFO', `Camera scanning ${plantInFront.id}: Foliage healthy (Health score: ${plantInFront.healthScore}%).`);
        }
      }
    }

    // 6. Dynamic MPU6050 Acceleration & Gyroscope derivation
    const accelForward = (this.scene.robotSpeed - this.scene.targetSpeed) * 0.2;
    const gyroZ = this.scene.turnRate * (180.0 / Math.PI); // degrees per second

    const telemetry: SimulatorTelemetry = {
      mode: 'SIMULATION',
      movement: this.currentMovement,
      speedPwm: this.speedPwm,
      position: {
        x: Number(this.scene.robotX.toFixed(2)),
        z: Number(this.scene.robotZ.toFixed(2)),
      },
      headingDeg: Number(((((this.scene.robotHeading * 180) / Math.PI) % 360 + 360) % 360).toFixed(1)),
      ultrasonic: {
        left: ultrasonic.leftCm,
        center: ultrasonic.centerCm,
        right: ultrasonic.rightCm,
      },
      safetyStopActive: this.safetyStopActive,
      buzzerState: this.buzzerMode,
      currentZone,
      soilMoisturePct: currentZone.soilMoisturePct,
      npk: currentZone.npk,
      dht22: {
        temperature: currentZone.temperatureC,
        humidity: currentZone.humidityPct,
      },
      mpu6050: {
        accel_x: Number((Math.sin(this.scene.robotHeading) * accelForward).toFixed(3)),
        accel_y: 0.981, // 1G gravity
        accel_z: Number((Math.cos(this.scene.robotHeading) * accelForward).toFixed(3)),
        gyro_x: Number(((Math.random() - 0.5) * 0.1).toFixed(2)),
        gyro_y: Number(((Math.random() - 0.5) * 0.1).toFixed(2)),
        gyro_z: Number(gyroZ.toFixed(1)),
        pitch_deg: 0.0,
        roll_deg: 0.0,
      },
      pumpState: this.pumpState,
      relayState: this.relayState,
      sprayActive: this.sprayActive,
      sprayTargetPlantId: this.sprayActive && this.detectedPlant ? this.detectedPlant.id : null,
      detectedPlant: this.detectedPlant,
      tanks: this.tanks,
      treatmentWorkflow: this.workflowState,
    };

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(telemetry);
    }
  }

  public targetNearestPlant(): FarmPlant | null {
    const plants = this.scene.getAllPlants();
    let closest: FarmPlant | null = null;
    let minDist = Infinity;
    for (const p of plants) {
      const dist = Math.hypot(p.position.x - this.scene.robotX, p.position.z - this.scene.robotZ);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    if (closest) {
      this.detectedPlant = closest;
      this.scene.updateTargetReticle(closest);
      this.addLog('DETECTION', `Manual target lock: Focused on ${closest.id} [${closest.state}].`);
    }
    return closest;
  }

  private getZoneAtPosition(x: number, z: number): FieldZone {
    for (const zone of SIMULATOR_ZONES) {
      if (
        x >= zone.bounds.minX &&
        x <= zone.bounds.maxX &&
        z >= zone.bounds.minZ &&
        z <= zone.bounds.maxZ
      ) {
        return zone;
      }
    }
    return SIMULATOR_ZONES[1]; // Default to central zone
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario Presets
  // ───────────────────────────────────────────────────────────────────────────
  public applyScenarioPreset(preset: ScenarioPresetId) {
    if (this.isDemoRunning) {
      this.stopFullDemo();
    }

    this.scene.resetRobotPosition();
    this.deactivateSpray();
    this.safetyStopActive = false;

    switch (preset) {
      case 'NORMAL_FIELD':
        this.scene.robotX = 0.0;
        this.scene.robotZ = 4.0;
        this.scene.robotHeading = 0.0;
        this.addLog('INFO', 'Scenario loaded: NORMAL FIELD. Clear central crop row path.');
        break;

      case 'OBSTACLE_AHEAD':
        // Place rover in lane approaching granite boulder
        this.scene.robotX = 0.0;
        this.scene.robotZ = -1.0;
        this.scene.robotHeading = 0.0;
        this.addLog('SAFETY', 'Scenario loaded: OBSTACLE AHEAD. Rover approaching field boulder on right.');
        break;

      case 'DISEASED_ZONE':
        // Place rover positioned in center lane between Plant #003 (Left) and Boulder (Right) - exactly matching reference image!
        this.scene.robotX = 0.0;
        this.scene.robotZ = 0.0;
        this.scene.robotHeading = 0.0;
        this.addLog('DETECTION', 'Scenario loaded: DISEASED ZONE. Camera oriented at Plant #003 (Early Blight).');
        break;

      case 'DRY_SOIL_ZONE':
        // Move rover into Southern Arid sector (<25% moisture)
        this.scene.robotX = -6.0;
        this.scene.robotZ = 10.0;
        this.scene.robotHeading = 0.0;
        this.addLog('INFO', 'Scenario loaded: DRY SOIL ZONE. Positioned in West Bed (24.8% moisture).');
        break;

      case 'PRECISION_SPRAY':
        // Positioned at Plant #003, primed for farmer approval
        this.scene.robotX = 0.0;
        this.scene.robotZ = 0.0;
        this.scene.robotHeading = 0.0;
        this.addLog('TREATMENT', 'Scenario loaded: PRECISION SPRAY. Verified treatment ready for farmer authorization.');
        break;

      case 'FULL_DEMO':
        this.startFullDemo();
        return;
    }

    this.scene.prevRobotX = this.scene.robotX;
    this.scene.prevRobotZ = this.scene.robotZ;
    this.scene.resetCameraView();
    const target = this.scene.getDetectedPlantInFront();
    this.detectedPlant = target;
    this.scene.updateTargetReticle(target);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interactive Full Demo Script
  // ───────────────────────────────────────────────────────────────────────────
  public startFullDemo() {
    this.isDemoRunning = true;
    this.scene.resetRobotPosition();
    this.deactivateSpray();
    this.safetyStopActive = false;
    this.addLog('INFO', 'FULL DEMO SEQUENCE STARTED: Autonomous demonstration initialized.');

    // Step 1: Drive forward down crop row
    this.move('FORWARD', 180);

    // Step 2: Stop after 3.5s before obstacle
    this.demoTimer = window.setTimeout(() => {
      this.move('STOP');
      this.addLog('SAFETY', 'Full Demo Step 2: Approaching obstacle zone. Sensor radar triggered.');

      // Step 3: Turn toward diseased crop row
      this.demoTimer = window.setTimeout(() => {
        this.scene.robotX = -3.0;
        this.scene.robotZ = -1.2;
        this.scene.robotHeading = -Math.PI / 2;
        this.scene.prevRobotX = -3.0;
        this.scene.prevRobotZ = -1.2;
        this.move('STOP');
        const target = this.scene.getDetectedPlantInFront();
        this.detectedPlant = target;
        this.scene.updateTargetReticle(target);
        this.addLog('DETECTION', 'Full Demo Step 3: Camera focused on Plant #003. Disease verified: Early Blight.');

        // Step 4: Ready for farmer approval prompt
        this.addLog('TREATMENT', 'Full Demo Step 4: Awaiting farmer authorization to activate precision spray...');
        this.isDemoRunning = false;
      }, 2500);
    }, 3500);
  }

  public stopFullDemo() {
    this.isDemoRunning = false;
    if (this.demoTimer) {
      window.clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Environmental Impact & Carbon Intelligence
  // ───────────────────────────────────────────────────────────────────────────
  public getEnvironmentalImpact(): CarbonImpactModel {
    return carbonCalculator.calculate();
  }

  public getCarbonCalculator(): CarbonImpactCalculator {
    return carbonCalculator;
  }

  public loadDeterministicBenchmark() {
    carbonCalculator.loadDeterministicBenchmark();
    this.addLog('INFO', 'Loaded deterministic environmental benchmark scenario (100 m² field, 18 m² treated area).');
  }

  public addLog(type: SimulatorLogEvent['type'], message: string) {
    const log: SimulatorLogEvent = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    this.eventLogs.unshift(log);
    if (this.eventLogs.length > 50) {
      this.eventLogs.pop();
    }
    if (this.onLogsUpdate) {
      this.onLogsUpdate([...this.eventLogs]);
    }
  }

  public resetField() {
    this.scene.resetField();
    this.totalChemicalUsedMl = 0;
    this.totalTreatedPlantsCount = 0;
    this.driveSecondsElapsed = 0;
    this.safetyStopActive = false;
    this.detectedPlant = null;
    carbonCalculator.reset();
    this.addLog('INFO', 'Field and simulation statistics reset to initial baseline.');
  }

  public dispose() {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.stopFullDemo();
    this.deactivateSpray();
    buzzerAudio.dispose();
  }
}
