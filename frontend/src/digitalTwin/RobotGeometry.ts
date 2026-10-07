/**
 * AgriGuard Digital Twin — 3D Robot Geometry & Assembly
 *
 * Faithfully matches the user's real physical AgriGuard prototype:
 * 1. High-Clearance Straddle Chassis: White PVC tubular pipes, 90° elbows, T-couplings.
 * 2. Elevated Foam-Board Tray: White folded sunpack electronics deck strapped to PVC corner posts with black zip-ties.
 * 3. Open-Deck Real Electronics (matching Photo 1):
 *    - Solderless white breadboard with power distribution rails
 *    - ESP32 DevKit board with onboard meander antenna & pulsing status LED
 *    - Arduino Mega/Uno mainboard (deep blue PCB, silver crystal/USB, pin headers)
 *    - L298N Dual H-Bridge motor driver (red PCB with black finned aluminum heatsink)
 *    - 5V Songle blue relay module with screw terminals
 *    - Black 4-cell battery pack
 *    - HC-05 / BLE wireless breakout
 *    - MPU-6050 6-axis gyro/accelerometer breakout
 *    - Power switch & realistic multi-colored Dupont jumper wires
 * 4. External Sensors & Hardware (matching Photo 2):
 *    - HC-SR04 ultrasonic sensor strapped to front-right vertical PVC leg with black zip-ties
 *    - Center HC-SR04 ultrasonic sensor mounted under the front tray lip
 *    - Left HC-SR04 ultrasonic sensor mounted on the left frame
 *    - Dynamic 3D visual radar range cones (Safe / Warning / Obstacle)
 *    - DHT temperature & humidity sensor strapped to the outer foam wall
 *    - Clear spray reservoir bottle & mini pump suspended under the frame with clear tubing
 *    - Atomizing mist spray particle system
 *    - Photovoltaic solar panel mounted on rear cardboard bracket
 *    - 4 DC gear motors & rover wheels at the base of the PVC legs
 */

import * as THREE from 'three';

export interface UltrasonicConeRefs {
  leftMesh: THREE.Mesh;
  centerMesh: THREE.Mesh;
  rightMesh: THREE.Mesh;
  leftMaterial: THREE.MeshBasicMaterial;
  centerMaterial: THREE.MeshBasicMaterial;
  rightMaterial: THREE.MeshBasicMaterial;
}

export interface SprayParticleRefs {
  particleSystem: THREE.Points;
  particleGeometry: THREE.BufferGeometry;
  particleMaterial: THREE.PointsMaterial;
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
}

export interface ValveRefs {
  group: THREE.Group;
  indicatorMesh: THREE.Mesh;
  indicatorMat: THREE.MeshBasicMaterial;
  state: 'CLOSED' | 'OPEN';
}

export interface TankRefs {
  group: THREE.Group;
  bottleMesh: THREE.Mesh;
  liquidMesh: THREE.Mesh;
  liquidMat: THREE.MeshStandardMaterial;
  labelMesh: THREE.Mesh;
  baseY: number;
  fullHeight: number;
}

export interface PipeRefs {
  outerTubeMesh: THREE.Mesh;
  fluidCoreMesh: THREE.Mesh;
  fluidCoreMat: THREE.MeshStandardMaterial;
  flowTexture: THREE.CanvasTexture;
  isActive: boolean;
}

export interface TreatmentPlumbingRefs {
  tanks: {
    1: TankRefs;
    2: TankRefs;
    3: TankRefs;
  };
  valves: {
    1: ValveRefs;
    2: ValveRefs;
    3: ValveRefs;
  };
  pump: {
    group: THREE.Group;
    ledMesh: THREE.Mesh;
    ledMat: THREE.MeshBasicMaterial;
    state: 'OFF' | 'ON';
  };
  pipes: {
    1: PipeRefs;
    2: PipeRefs;
    3: PipeRefs;
  };
  nozzles: {
    1: THREE.Mesh;
    2: THREE.Mesh;
    3: THREE.Mesh;
  };
  setTankLevel: (tankNum: 1 | 2 | 3, pct: number) => void;
  setValveState: (valveNum: 1 | 2 | 3, state: 'OPEN' | 'CLOSED') => void;
  setPumpState: (state: 'OFF' | 'ON') => void;
  setPipeFlow: (pipeNum: 1 | 2 | 3, active: boolean) => void;
  updateFlowAnimation: (deltaSec: number) => void;
}

export interface RobotModelRefs {
  rootGroup: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: {
    frontLeft: THREE.Group;
    frontRight: THREE.Group;
    rearLeft: THREE.Group;
    rearRight: THREE.Group;
  };
  ultrasonicCones: UltrasonicConeRefs;
  sprayParticles: SprayParticleRefs;
  statusLedMaterial: THREE.MeshBasicMaterial;
  sprayNozzleMesh: THREE.Mesh;
  tankLiquidMesh: THREE.Mesh;
  plumbing: TreatmentPlumbingRefs;
}

export function createAgriGuardRobot(): RobotModelRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'AgriGuardPhysicalPrototypeRoot';

  // Sub-group that tilts with MPU6050 pitch/roll telemetry
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ChassisTiltingGroup';
  rootGroup.add(chassisGroup);

  // ───────────────────────────────────────────────────────────────────────────
  // Shared Realistic Materials
  // ───────────────────────────────────────────────────────────────────────────
  // White PVC Pipes (Clean white with subtle cylindrical plastic sheen)
  const whitePvcMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.38,
    metalness: 0.04,
  });

  // PVC Fittings (Elbows, T-couplings with slight joint definition)
  const pvcJointMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.42,
    metalness: 0.06,
  });

  // Foam-Board / Sunpack Tray (Matte white sheet)
  const foamBoardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // Black Zip Ties / Cable Ties (Characteristic DIY engineering detail)
  const zipTieMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.1,
  });

  // Solderless Breadboard (Off-white with subtle texture)
  const breadboardMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.65,
    metalness: 0.02,
  });

  // PCBs
  const pcbEsp32Mat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.3 });
  const pcbArduinoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.3 });
  const pcbL298nMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5, metalness: 0.2 });
  const pcbBlueSensorMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, metalness: 0.2 });

  // Metallic Components
  const aluminumMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.9 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.95 });
  const copperGoldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.85 });
  const heatsinkBlackMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.85 });

  // Electronic Hardware
  const greenTerminalMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6, metalness: 0.1 });
  const relayBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.1 });
  const batteryHolderMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.1 });
  const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9, metalness: 0.05 });

  // Solar Panel Surface
  const solarWaferMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    emissive: 0x0369a1,
    emissiveIntensity: 0.08,
    roughness: 0.15,
    metalness: 0.92,
  });

  // Tires & Wheels
  const tireRubberMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9, metalness: 0.05 });
  const wheelHubMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 });

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Black Zip-Tie Strap with Tail
  // ───────────────────────────────────────────────────────────────────────────
  function createZipTie(radius: number = 0.045, hasTail: boolean = true): THREE.Group {
    const group = new THREE.Group();
    // Circular strap
    const ringGeom = new THREE.TorusGeometry(radius, 0.007, 8, 16);
    const ring = new THREE.Mesh(ringGeom, zipTieMat);
    group.add(ring);

    // Locking head clasp
    const headGeom = new THREE.BoxGeometry(0.02, 0.016, 0.02);
    const head = new THREE.Mesh(headGeom, zipTieMat);
    head.position.set(radius, 0, 0);
    group.add(head);

    // Tail sticking out
    if (hasTail) {
      const tailGeom = new THREE.BoxGeometry(0.09, 0.005, 0.01);
      const tail = new THREE.Mesh(tailGeom, zipTieMat);
      tail.position.set(radius + 0.045, 0.01, 0);
      tail.rotation.z = 0.2;
      group.add(tail);
    }
    return group;
  }

  // Helper: Curved Dupont Jumper Wire (Tube along CatmullRom spline)
  function createWire(points: THREE.Vector3[], colorHex: number, radius: number = 0.007): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 20, radius, 8, false);
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.1 });
    return new THREE.Mesh(geom, mat);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. High-Clearance Straddle Chassis (White PVC Pipe Frame)
  // ───────────────────────────────────────────────────────────────────────────
  const trackX = 1.05;   // half-width of PVC legs
  const baseZ = 1.35;    // half-length of PVC legs
  const wheelAxleY = 0.35; // height of bottom axles & PVC elbows
  const legTopY = 2.45;    // top of corner PVC legs
  const legHeight = legTopY - wheelAxleY; // 2.1m vertical clearance
  const pipeRadius = 0.032; // ~2.5-inch outer diameter PVC pipe

  // 4 Tall Vertical Corner PVC Legs
  const legPositions: [number, number][] = [
    [-trackX, baseZ],  // Front-Left
    [trackX, baseZ],   // Front-Right
    [-trackX, -baseZ], // Rear-Left
    [trackX, -baseZ],  // Rear-Right
  ];

  const legGeom = new THREE.CylinderGeometry(pipeRadius, pipeRadius, legHeight, 16);

  legPositions.forEach(([x, z]) => {
    const legMesh = new THREE.Mesh(legGeom, whitePvcMat);
    legMesh.position.set(x, wheelAxleY + legHeight / 2, z);
    legMesh.castShadow = true;
    chassisGroup.add(legMesh);

    // Top open PVC pipe rim cap
    const rimGeom = new THREE.CylinderGeometry(pipeRadius * 1.05, pipeRadius * 1.05, 0.03, 16);
    const rimMesh = new THREE.Mesh(rimGeom, pvcJointMat);
    rimMesh.position.set(x, legTopY, z);
    chassisGroup.add(rimMesh);

    // Black zip ties around vertical pipes at multiple heights
    const tieYLevels = [0.65, 1.05, 1.45, 2.2];
    tieYLevels.forEach((yLvl) => {
      const tie = createZipTie(pipeRadius * 1.15, true);
      tie.rotation.x = Math.PI / 2;
      tie.position.set(x, yLvl, z);
      chassisGroup.add(tie);
    });
  });

  // Lower PVC 90° Elbows at each bottom corner (holding motor mounts)
  const elbowGeom = new THREE.SphereGeometry(pipeRadius * 1.35, 12, 12);
  legPositions.forEach(([x, z]) => {
    const elbow = new THREE.Mesh(elbowGeom, pvcJointMat);
    elbow.position.set(x, wheelAxleY, z);
    chassisGroup.add(elbow);
  });

  // Lower Horizontal PVC Spreader Pipes (Sides)
  const sideSpreaderLength = baseZ * 2;
  const sideSpreaderGeom = new THREE.CylinderGeometry(pipeRadius, pipeRadius, sideSpreaderLength, 16);

  const leftSpreader = new THREE.Mesh(sideSpreaderGeom, whitePvcMat);
  leftSpreader.rotation.x = Math.PI / 2;
  leftSpreader.position.set(-trackX, wheelAxleY + 0.05, 0);
  chassisGroup.add(leftSpreader);

  const rightSpreader = new THREE.Mesh(sideSpreaderGeom, whitePvcMat);
  rightSpreader.rotation.x = Math.PI / 2;
  rightSpreader.position.set(trackX, wheelAxleY + 0.05, 0);
  chassisGroup.add(rightSpreader);

  // Lower Horizontal Cross Spreader (Rear & Front)
  const crossSpreaderLength = trackX * 2;
  const crossSpreaderGeom = new THREE.CylinderGeometry(pipeRadius, pipeRadius, crossSpreaderLength, 16);

  const rearSpreader = new THREE.Mesh(crossSpreaderGeom, whitePvcMat);
  rearSpreader.rotation.z = Math.PI / 2;
  rearSpreader.position.set(0, wheelAxleY + 0.05, -baseZ);
  chassisGroup.add(rearSpreader);

  const frontSpreader = new THREE.Mesh(crossSpreaderGeom, whitePvcMat);
  frontSpreader.rotation.z = Math.PI / 2;
  frontSpreader.position.set(0, wheelAxleY + 0.05, baseZ);
  chassisGroup.add(frontSpreader);

  // Mid/Upper Horizontal PVC Support Rails cradling the Foam Tray Floor
  const trayFloorY = 1.45;
  const midRailSideGeom = new THREE.CylinderGeometry(pipeRadius, pipeRadius, baseZ * 2, 16);

  const leftMidRail = new THREE.Mesh(midRailSideGeom, whitePvcMat);
  leftMidRail.rotation.x = Math.PI / 2;
  leftMidRail.position.set(-trackX, trayFloorY - 0.03, 0);
  chassisGroup.add(leftMidRail);

  const rightMidRail = new THREE.Mesh(midRailSideGeom, whitePvcMat);
  rightMidRail.rotation.x = Math.PI / 2;
  rightMidRail.position.set(trackX, trayFloorY - 0.03, 0);
  chassisGroup.add(rightMidRail);

  const midCrossRailGeom = new THREE.CylinderGeometry(pipeRadius, pipeRadius, trackX * 2, 16);
  const midFrontCross = new THREE.Mesh(midCrossRailGeom, whitePvcMat);
  midFrontCross.rotation.z = Math.PI / 2;
  midFrontCross.position.set(0, trayFloorY - 0.03, baseZ);
  chassisGroup.add(midFrontCross);

  const midRearCross = new THREE.Mesh(midCrossRailGeom, whitePvcMat);
  midRearCross.rotation.z = Math.PI / 2;
  midRearCross.position.set(0, trayFloorY - 0.03, -baseZ);
  chassisGroup.add(midRearCross);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Open-Top White Foam-Board Hopper / Electronics Bed (Matching Photos 1 & 2)
  // ───────────────────────────────────────────────────────────────────────────
  const trayWidth = 2.0;    // fits snugly between PVC corner posts
  const trayLength = 2.6;
  const wallHeight = 0.85;  // walls rise from Y=1.45 to Y=2.30
  const wallThick = 0.02;

  // Floor sheet
  const floorGeom = new THREE.BoxGeometry(trayWidth, wallThick, trayLength);
  const floorMesh = new THREE.Mesh(floorGeom, foamBoardMat);
  floorMesh.position.set(0, trayFloorY, 0);
  floorMesh.receiveShadow = true;
  chassisGroup.add(floorMesh);

  // 4 Perimeter Foam Walls (Open Top container!)
  const wallY = trayFloorY + wallHeight / 2;

  // Left Wall
  const sideWallGeom = new THREE.BoxGeometry(wallThick, wallHeight, trayLength);
  const leftWall = new THREE.Mesh(sideWallGeom, foamBoardMat);
  leftWall.position.set(-trayWidth / 2, wallY, 0);
  chassisGroup.add(leftWall);

  // Right Wall
  const rightWall = new THREE.Mesh(sideWallGeom, foamBoardMat);
  rightWall.position.set(trayWidth / 2, wallY, 0);
  chassisGroup.add(rightWall);

  // Front Wall
  const endWallGeom = new THREE.BoxGeometry(trayWidth, wallHeight, wallThick);
  const frontWall = new THREE.Mesh(endWallGeom, foamBoardMat);
  frontWall.position.set(0, wallY, trayLength / 2);
  chassisGroup.add(frontWall);

  // Rear Wall
  const rearWall = new THREE.Mesh(endWallGeom, foamBoardMat);
  rearWall.position.set(0, wallY, -trayLength / 2);
  chassisGroup.add(rearWall);

  // Corner Zip Ties fastening the Foam Box to the 4 PVC Corner Posts
  const cornerFastenerOffsets: [number, number][] = [
    [-trayWidth / 2, trayLength / 2],
    [trayWidth / 2, trayLength / 2],
    [-trayWidth / 2, -trayLength / 2],
    [trayWidth / 2, -trayLength / 2],
  ];

  cornerFastenerOffsets.forEach(([cx, cz]) => {
    // Upper and lower tie-down loops
    [trayFloorY + 0.15, trayFloorY + wallHeight - 0.1].forEach((yPos) => {
      const cornerTie = createZipTie(0.065, true);
      cornerTie.position.set(cx, yPos, cz);
      cornerTie.rotation.y = Math.atan2(cz, cx);
      chassisGroup.add(cornerTie);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Solar Panel on Cardboard Riser Bracket (Rear Top Lip - Photos 1 & 2)
  // ───────────────────────────────────────────────────────────────────────────
  const solarPanelWidth = 1.35;
  const solarPanelLength = 0.85;
  const solarY = trayFloorY + wallHeight + 0.02; // resting across top rear lip
  const solarZ = -trayLength / 2 + solarPanelLength / 2;

  // Cardboard bracket mount
  const cbGeom = new THREE.BoxGeometry(solarPanelWidth + 0.06, 0.04, solarPanelLength + 0.06);
  const cbMesh = new THREE.Mesh(cbGeom, cardboardMat);
  cbMesh.position.set(0, solarY, solarZ);
  chassisGroup.add(cbMesh);

  // Photovoltaic cell array (dark silicon surface)
  const pvGeom = new THREE.BoxGeometry(solarPanelWidth, 0.015, solarPanelLength);
  const pvMesh = new THREE.Mesh(pvGeom, solarWaferMat);
  pvMesh.position.set(0, solarY + 0.025, solarZ);
  chassisGroup.add(pvMesh);

  // Solar wafer gridlines overlay
  const solarGrid = new THREE.GridHelper(1.2, 6, 0x38bdf8, 0x1e3a8a);
  solarGrid.position.set(0, solarY + 0.035, solarZ);
  solarGrid.scale.set(0.9, 1, 0.6);
  chassisGroup.add(solarGrid);

  // Red & Black wires descending from solar panel into the tray floor
  const solarWireRed = createWire(
    [
      new THREE.Vector3(0.2, solarY + 0.01, solarZ),
      new THREE.Vector3(0.25, solarY - 0.2, solarZ + 0.15),
      new THREE.Vector3(0.15, trayFloorY + 0.1, -0.4),
      new THREE.Vector3(-0.05, trayFloorY + 0.02, -0.1),
    ],
    0xef4444
  );
  chassisGroup.add(solarWireRed);

  const solarWireBlack = createWire(
    [
      new THREE.Vector3(0.23, solarY + 0.01, solarZ),
      new THREE.Vector3(0.28, solarY - 0.2, solarZ + 0.15),
      new THREE.Vector3(0.18, trayFloorY + 0.1, -0.4),
      new THREE.Vector3(-0.08, trayFloorY + 0.02, -0.1),
    ],
    0x18181b
  );
  chassisGroup.add(solarWireBlack);

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Detailed Electronics Inside Foam Tray (Matching Photo 1)
  // ───────────────────────────────────────────────────────────────────────────
  const deckY = trayFloorY + 0.015; // resting right on the white floor

  // (A) White Solderless Breadboard
  const bbWidth = 0.55;
  const bbLength = 0.82;
  const bbGeom = new THREE.BoxGeometry(bbWidth, 0.025, bbLength);
  const bbMesh = new THREE.Mesh(bbGeom, breadboardMat);
  bbMesh.position.set(-0.35, deckY + 0.012, 0.05);
  chassisGroup.add(bbMesh);

  // Red (+) and Blue (-) power rail stripes along breadboard edges
  const railGeom = new THREE.BoxGeometry(0.015, 0.002, bbLength * 0.92);
  const redRail = new THREE.Mesh(railGeom, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  redRail.position.set(-0.35 - bbWidth / 2 + 0.02, deckY + 0.026, 0.05);
  chassisGroup.add(redRail);

  const blueRail = new THREE.Mesh(railGeom, new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  blueRail.position.set(-0.35 + bbWidth / 2 - 0.02, deckY + 0.026, 0.05);
  chassisGroup.add(blueRail);

  // (B) ESP32 DevKit Board (Mounted on the Breadboard)
  const espWidth = 0.22;
  const espLength = 0.38;
  const espGeom = new THREE.BoxGeometry(espWidth, 0.02, espLength);
  const espMesh = new THREE.Mesh(espGeom, pcbEsp32Mat);
  espMesh.position.set(-0.35, deckY + 0.038, -0.12);
  chassisGroup.add(espMesh);

  // ESP32 Golden PCB Trace Antenna
  const antGeom = new THREE.BoxGeometry(espWidth * 0.85, 0.004, 0.06);
  const antMesh = new THREE.Mesh(antGeom, copperGoldMat);
  antMesh.position.set(-0.35, deckY + 0.05, -0.12 - espLength / 2 + 0.035);
  chassisGroup.add(antMesh);

  // Micro-USB Port on ESP32
  const usbGeom = new THREE.BoxGeometry(0.06, 0.025, 0.05);
  const usbMesh = new THREE.Mesh(usbGeom, chromeMat);
  usbMesh.position.set(-0.35, deckY + 0.048, -0.12 + espLength / 2 - 0.02);
  chassisGroup.add(usbMesh);

  // Status Heartbeat LED on ESP32 (Pulsing dynamically via TwinScene)
  const ledGeom = new THREE.SphereGeometry(0.018, 10, 10);
  const statusLedMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const statusLed = new THREE.Mesh(ledGeom, statusLedMaterial);
  statusLed.position.set(-0.31, deckY + 0.052, -0.12);
  chassisGroup.add(statusLed);

  // (C) Arduino Mega / Uno Board (Deep Blue PCB beside Breadboard)
  const ardWidth = 0.48;
  const ardLength = 0.72;
  const ardGeom = new THREE.BoxGeometry(ardWidth, 0.025, ardLength);
  const ardMesh = new THREE.Mesh(ardGeom, pcbArduinoMat);
  ardMesh.position.set(0.12, deckY + 0.015, 0.22);
  chassisGroup.add(ardMesh);

  // Arduino Silver USB-B Metal Port
  const usbbGeom = new THREE.BoxGeometry(0.09, 0.08, 0.1);
  const usbbMesh = new THREE.Mesh(usbbGeom, chromeMat);
  usbbMesh.position.set(0.12 - ardWidth / 2 + 0.06, deckY + 0.06, 0.22 - ardLength / 2 + 0.06);
  chassisGroup.add(usbbMesh);

  // Black DC Power Barrel Jack
  const barrelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12);
  const barrelMesh = new THREE.Mesh(barrelGeom, batteryHolderMat);
  barrelMesh.position.set(0.12 + ardWidth / 2 - 0.06, deckY + 0.05, 0.22 - ardLength / 2 + 0.06);
  chassisGroup.add(barrelMesh);

  // ATmega Microcontroller Chip & Header Pin Strips
  const icGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
  const icMesh = new THREE.Mesh(icGeom, new THREE.MeshStandardMaterial({ color: 0x111827 }));
  icMesh.position.set(0.12, deckY + 0.035, 0.22);
  chassisGroup.add(icMesh);

  // Black Female Header Pin Rows along Arduino edges
  const headerGeom = new THREE.BoxGeometry(0.03, 0.05, ardLength * 0.85);
  const leftHeader = new THREE.Mesh(headerGeom, batteryHolderMat);
  leftHeader.position.set(0.12 - ardWidth / 2 + 0.025, deckY + 0.045, 0.22);
  chassisGroup.add(leftHeader);

  const rightHeader = new THREE.Mesh(headerGeom, batteryHolderMat);
  rightHeader.position.set(0.12 + ardWidth / 2 - 0.025, deckY + 0.045, 0.22);
  chassisGroup.add(rightHeader);

  // (D) L298N Dual H-Bridge Motor Driver (Red PCB with Black Extruded Finned Heatsink)
  const l298Width = 0.45;
  const l298Length = 0.45;
  const l298Geom = new THREE.BoxGeometry(l298Width, 0.025, l298Length);
  const l298Mesh = new THREE.Mesh(l298Geom, pcbL298nMat);
  l298Mesh.position.set(0.42, deckY + 0.015, -0.42);
  chassisGroup.add(l298Mesh);

  // Center Finned Aluminum Heatsink (Iconic L298N component)
  const sinkBaseGeom = new THREE.BoxGeometry(0.24, 0.18, 0.14);
  const sinkBase = new THREE.Mesh(sinkBaseGeom, heatsinkBlackMat);
  sinkBase.position.set(0.42, deckY + 0.11, -0.42);
  chassisGroup.add(sinkBase);

  // Vertical cooling fins on the heatsink
  for (let f = -0.09; f <= 0.09; f += 0.045) {
    const finGeom = new THREE.BoxGeometry(0.012, 0.06, 0.16);
    const fin = new THREE.Mesh(finGeom, heatsinkBlackMat);
    fin.position.set(0.42 + f, deckY + 0.21, -0.42);
    chassisGroup.add(fin);
  }

  // Green Screw Terminals (Motor outputs & power)
  const termDualGeom = new THREE.BoxGeometry(0.08, 0.09, 0.14);
  const leftMotorTerm = new THREE.Mesh(termDualGeom, greenTerminalMat);
  leftMotorTerm.position.set(0.42 - l298Width / 2 + 0.05, deckY + 0.06, -0.42);
  chassisGroup.add(leftMotorTerm);

  const rightMotorTerm = new THREE.Mesh(termDualGeom, greenTerminalMat);
  rightMotorTerm.position.set(0.42 + l298Width / 2 - 0.05, deckY + 0.06, -0.42);
  chassisGroup.add(rightMotorTerm);

  const powerTermGeom = new THREE.BoxGeometry(0.16, 0.09, 0.08);
  const powerTerm = new THREE.Mesh(powerTermGeom, greenTerminalMat);
  powerTerm.position.set(0.42, deckY + 0.06, -0.42 + l298Length / 2 - 0.05);
  chassisGroup.add(powerTerm);

  // (E) 5V Single-Channel Songle Relay Module (Blue cube with screw terminal)
  const relayWidth = 0.24;
  const relayLength = 0.38;
  const relayPcbGeom = new THREE.BoxGeometry(relayWidth, 0.02, relayLength);
  const relayPcb = new THREE.Mesh(relayPcbGeom, pcbBlueSensorMat);
  relayPcb.position.set(-0.16, deckY + 0.015, 0.55);
  chassisGroup.add(relayPcb);

  // Royal Blue Songle Relay Box
  const relayCubeGeom = new THREE.BoxGeometry(0.18, 0.15, 0.22);
  const relayCube = new THREE.Mesh(relayCubeGeom, relayBlueMat);
  relayCube.position.set(-0.16, deckY + 0.09, 0.55 - 0.04);
  chassisGroup.add(relayCube);

  // 3-Pole Screw Terminal on output end
  const relayTermGeom = new THREE.BoxGeometry(0.16, 0.08, 0.08);
  const relayTerm = new THREE.Mesh(relayTermGeom, greenTerminalMat);
  relayTerm.position.set(-0.16, deckY + 0.06, 0.55 + 0.13);
  chassisGroup.add(relayTerm);

  // (F) Black 4-Cell Battery Pack (Bottom-right corner)
  const batPackGeom = new THREE.BoxGeometry(0.48, 0.16, 0.55);
  const batPack = new THREE.Mesh(batPackGeom, batteryHolderMat);
  batPack.position.set(0.62, deckY + 0.08, 0.72);
  chassisGroup.add(batPack);

  // Cylindrical battery outlines inside cage
  for (let c = -0.15; c <= 0.15; c += 0.1) {
    const cellGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.48, 12);
    const cell = new THREE.Mesh(cellGeom, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3 }));
    cell.rotation.x = Math.PI / 2;
    cell.position.set(0.62 + c, deckY + 0.14, 0.72);
    chassisGroup.add(cell);
  }

  // (G) HC-05 / BLE Bluetooth Breakout Board
  const btGeom = new THREE.BoxGeometry(0.12, 0.018, 0.28);
  const btMesh = new THREE.Mesh(btGeom, pcbBlueSensorMat);
  btMesh.position.set(-0.62, deckY + 0.015, 0.35);
  chassisGroup.add(btMesh);

  // (H) MPU-6050 6-Axis Gyro / Accelerometer Module
  const mpuGeom = new THREE.BoxGeometry(0.15, 0.018, 0.15);
  const mpuMesh = new THREE.Mesh(mpuGeom, pcbBlueSensorMat);
  mpuMesh.position.set(-0.60, deckY + 0.015, -0.35);
  chassisGroup.add(mpuMesh);

  // (I) Power Rocker Switch
  const switchBaseGeom = new THREE.BoxGeometry(0.12, 0.07, 0.16);
  const switchBase = new THREE.Mesh(switchBaseGeom, batteryHolderMat);
  switchBase.position.set(0.25, deckY + 0.04, 0.65);
  chassisGroup.add(switchBase);

  const switchRockerGeom = new THREE.BoxGeometry(0.07, 0.04, 0.09);
  const switchRocker = new THREE.Mesh(switchRockerGeom, new THREE.MeshStandardMaterial({ color: 0xef4444 }));
  switchRocker.position.set(0.25, deckY + 0.08, 0.65);
  switchRocker.rotation.x = 0.3;
  chassisGroup.add(switchRocker);

  // (J) Realistic Multi-Colored Dupont Jumper Wires Routing Across the Tray
  // 1. Battery leads to L298N power terminal
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(0.55, deckY + 0.12, 0.65),
        new THREE.Vector3(0.52, deckY + 0.05, 0.2),
        new THREE.Vector3(0.48, deckY + 0.04, -0.1),
        new THREE.Vector3(0.42, deckY + 0.07, -0.37),
      ],
      0xef4444 // Red VCC
    )
  );
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(0.58, deckY + 0.12, 0.65),
        new THREE.Vector3(0.55, deckY + 0.05, 0.2),
        new THREE.Vector3(0.45, deckY + 0.04, -0.1),
        new THREE.Vector3(0.40, deckY + 0.07, -0.37),
      ],
      0x18181b // Black GND
    )
  );

  // 2. Arduino to L298N logic ribbon (Yellow, Green, Blue, White)
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(0.22, deckY + 0.05, 0.0),
        new THREE.Vector3(0.28, deckY + 0.08, -0.15),
        new THREE.Vector3(0.35, deckY + 0.06, -0.35),
      ],
      0xfacc15 // Yellow
    )
  );
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(0.20, deckY + 0.05, -0.02),
        new THREE.Vector3(0.26, deckY + 0.08, -0.17),
        new THREE.Vector3(0.37, deckY + 0.06, -0.37),
      ],
      0x10b981 // Green
    )
  );

  // 3. ESP32 to Relay trigger wire (Orange)
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(-0.30, deckY + 0.04, -0.05),
        new THREE.Vector3(-0.25, deckY + 0.07, 0.2),
        new THREE.Vector3(-0.16, deckY + 0.04, 0.42),
      ],
      0xf97316 // Orange
    )
  );

  // 4. MPU-6050 to Breadboard I2C wires (Blue & Purple)
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(-0.55, deckY + 0.03, -0.35),
        new THREE.Vector3(-0.48, deckY + 0.06, -0.25),
        new THREE.Vector3(-0.35, deckY + 0.03, -0.15),
      ],
      0x38bdf8
    )
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 5. External Sensors & Hardware (Matching Photo 2)
  // ───────────────────────────────────────────────────────────────────────────
  // Factory for HC-SR04 Ultrasonic Sensors (Blue PCB + Dual Aluminum Transducer Cans)
  function createHCSR04(): THREE.Group {
    const usGroup = new THREE.Group();

    // Blue PCB base
    const pcbGeom = new THREE.BoxGeometry(0.38, 0.18, 0.03);
    const pcb = new THREE.Mesh(pcbGeom, pcbBlueSensorMat);
    usGroup.add(pcb);

    // Dual silver transducer cans (TX & RX cylinders)
    const canGeom = new THREE.CylinderGeometry(0.068, 0.068, 0.11, 16);
    const tx = new THREE.Mesh(canGeom, chromeMat);
    tx.rotation.x = Math.PI / 2;
    tx.position.set(-0.10, 0, 0.065);
    usGroup.add(tx);

    const rx = new THREE.Mesh(canGeom, chromeMat);
    rx.rotation.x = Math.PI / 2;
    rx.position.set(0.10, 0, 0.065);
    usGroup.add(rx);

    // Front silver transducer mesh grill
    const meshCircleGeom = new THREE.CircleGeometry(0.065, 12);
    const meshCircleMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const txFace = new THREE.Mesh(meshCircleGeom, meshCircleMat);
    txFace.position.set(-0.10, 0, 0.122);
    usGroup.add(txFace);

    const rxFace = new THREE.Mesh(meshCircleGeom, meshCircleMat);
    rxFace.position.set(0.10, 0, 0.122);
    usGroup.add(rxFace);

    return usGroup;
  }

  // Helper: Saddle Mounting Bracket for attaching sensors directly to round PVC pipes
  function createPvcSensorBracket(pipeRad: number): THREE.Group {
    const bracketGroup = new THREE.Group();
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
    });

    // Curved saddle block that hugs the cylindrical pipe surface
    const saddleGeom = new THREE.CylinderGeometry(pipeRad * 1.18, pipeRad * 1.18, 0.22, 14, 1, false, 0, Math.PI);
    const saddle = new THREE.Mesh(saddleGeom, bracketMat);
    saddle.rotation.y = Math.PI / 2;
    saddle.position.set(0, 0, -pipeRad * 0.15);
    bracketGroup.add(saddle);

    // Front flat mounting flange for HC-SR04 PCB
    const flangeGeom = new THREE.BoxGeometry(0.32, 0.16, 0.018);
    const flange = new THREE.Mesh(flangeGeom, bracketMat);
    flange.position.set(0, 0, pipeRad * 0.45);
    bracketGroup.add(flange);

    return bracketGroup;
  }

  // Ultrasonic Range Indicator Cone Factory (Visual Radar)
  function createRangeCone(): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
    const coneGeom = new THREE.ConeGeometry(0.65, 2.5, 16, 1, true);
    coneGeom.translate(0, -1.25, 0); // pivot at apex
    coneGeom.rotateX(-Math.PI / 2);  // point forward along +Z

    const mat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(coneGeom, mat);
    return { mesh, mat };
  }

  const midRailY = trayFloorY - 0.03; // Exact height of the horizontal PVC rails (1.42m)

  // ───────────────────────────────────────────────────────────────────────────
  // (A) HC-SR04 Mounted on the Right Horizontal PVC Rail (Facing RIGHT along +X)
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Black mounting saddle bracket hugging rightMidRail pipe
  const rightBracket = createPvcSensorBracket(pipeRadius);
  rightBracket.position.set(trackX, midRailY, 0.0);
  rightBracket.rotation.y = Math.PI / 2;
  chassisGroup.add(rightBracket);

  // 2. HC-SR04 Sensor seated flush on the bracket
  const rightUS = createHCSR04();
  rightUS.position.set(trackX + pipeRadius + 0.02, midRailY, 0.0);
  rightUS.rotation.y = Math.PI / 2; // Pointing outward to the RIGHT (+X)
  chassisGroup.add(rightUS);

  // 3. Black Zip Ties fastening the bracket and sensor tightly around rightMidRail
  [-0.10, 0.10].forEach((zOffset) => {
    const tie = createZipTie(pipeRadius * 1.25, true);
    tie.position.set(trackX, midRailY, zOffset);
    chassisGroup.add(tie);
  });

  // 4. Jumper wires from sensor to electronics tray
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(trackX + 0.01, midRailY, 0.0),
        new THREE.Vector3(trackX - 0.03, midRailY + 0.10, 0.05),
        new THREE.Vector3(trayWidth / 2 - 0.05, trayFloorY + 0.12, 0.1),
        new THREE.Vector3(0.1, deckY + 0.05, 0.2),
      ],
      0x3b82f6
    )
  );

  const rightConeData = createRangeCone();
  rightUS.add(rightConeData.mesh);

  // ───────────────────────────────────────────────────────────────────────────
  // (B) HC-SR04 Mounted Centrally on the Front Horizontal PVC Cross Pipe (Facing FORWARD along +Z)
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Black mounting saddle bracket hugging midFrontCross pipe
  const centerBracket = createPvcSensorBracket(pipeRadius);
  centerBracket.position.set(0.0, midRailY, baseZ);
  centerBracket.rotation.z = Math.PI / 2;
  centerBracket.rotation.y = 0;
  chassisGroup.add(centerBracket);

  // 2. HC-SR04 Sensor seated flush on the bracket
  const centerUS = createHCSR04();
  centerUS.position.set(0.0, midRailY, baseZ + pipeRadius + 0.02);
  centerUS.rotation.y = 0; // Pointing straight FORWARD (+Z)
  chassisGroup.add(centerUS);

  // 3. Black Zip Ties fastening the bracket and sensor tightly around midFrontCross
  [-0.10, 0.10].forEach((xOffset) => {
    const tie = createZipTie(pipeRadius * 1.25, true);
    tie.rotation.y = Math.PI / 2;
    tie.position.set(xOffset, midRailY, baseZ);
    chassisGroup.add(tie);
  });

  // 4. Jumper wires from front sensor into the electronics tray
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(0.0, midRailY, baseZ + 0.01),
        new THREE.Vector3(0.0, midRailY + 0.12, baseZ - 0.04),
        new THREE.Vector3(0.0, trayFloorY + 0.12, trayLength / 2 - 0.08),
        new THREE.Vector3(-0.15, deckY + 0.05, 0.25),
      ],
      0x10b981
    )
  );

  const centerConeData = createRangeCone();
  centerUS.add(centerConeData.mesh);

  // ───────────────────────────────────────────────────────────────────────────
  // (C) HC-SR04 Mounted on the Left Horizontal PVC Rail (Facing LEFT along -X)
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Black mounting saddle bracket hugging leftMidRail pipe
  const leftBracket = createPvcSensorBracket(pipeRadius);
  leftBracket.position.set(-trackX, midRailY, 0.0);
  leftBracket.rotation.y = -Math.PI / 2;
  chassisGroup.add(leftBracket);

  // 2. HC-SR04 Sensor seated flush on the bracket
  const leftUS = createHCSR04();
  leftUS.position.set(-trackX - pipeRadius - 0.02, midRailY, 0.0);
  leftUS.rotation.y = -Math.PI / 2; // Pointing outward to the LEFT (-X)
  chassisGroup.add(leftUS);

  // 3. Black Zip Ties fastening the bracket and sensor tightly around leftMidRail
  [-0.10, 0.10].forEach((zOffset) => {
    const tie = createZipTie(pipeRadius * 1.25, true);
    tie.position.set(-trackX, midRailY, zOffset);
    chassisGroup.add(tie);
  });

  // 4. Jumper wires from left sensor into the electronics tray
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(-trackX - 0.01, midRailY, 0.0),
        new THREE.Vector3(-trackX + 0.03, midRailY + 0.10, 0.05),
        new THREE.Vector3(-trayWidth / 2 + 0.05, trayFloorY + 0.12, 0.1),
        new THREE.Vector3(-0.1, deckY + 0.05, 0.2),
      ],
      0x8b5cf6
    )
  );

  const leftConeData = createRangeCone();
  leftUS.add(leftConeData.mesh);

  const ultrasonicCones: UltrasonicConeRefs = {
    leftMesh: leftConeData.mesh,
    centerMesh: centerConeData.mesh,
    rightMesh: rightConeData.mesh,
    leftMaterial: leftConeData.mat,
    centerMaterial: centerConeData.mat,
    rightMaterial: rightConeData.mat,
  };

  // (D) DHT Temperature & Humidity Sensor Strapped to Outer Foam Wall (Photo 2)
  const dhtHousingGeom = new THREE.BoxGeometry(0.16, 0.22, 0.08);
  const dhtHousing = new THREE.Mesh(
    dhtHousingGeom,
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })
  );
  dhtHousing.position.set(trayWidth / 2 + 0.05, trayFloorY + wallHeight * 0.45, 0.6);
  chassisGroup.add(dhtHousing);

  // Zip-tie holding the DHT sensor to the wall
  const dhtTie = createZipTie(0.09, true);
  dhtTie.position.set(trayWidth / 2 + 0.05, trayFloorY + wallHeight * 0.45, 0.6);
  dhtTie.rotation.y = Math.PI / 2;
  chassisGroup.add(dhtTie);

  // Wires curling over the top rim into the breadboard
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(trayWidth / 2 + 0.05, trayFloorY + wallHeight * 0.45 + 0.12, 0.6),
        new THREE.Vector3(trayWidth / 2 - 0.02, trayFloorY + wallHeight + 0.02, 0.55),
        new THREE.Vector3(0.0, trayFloorY + 0.08, 0.2),
        new THREE.Vector3(-0.35, deckY + 0.03, 0.05),
      ],
      0x38bdf8
    )
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Multi-Tank Precision Treatment Delivery System (Real Hardware Architecture)
  //    - Tank 1: Treatment A (Copper Hydroxide)
  //    - Tank 2: Treatment B (Organic Bio-Neem)
  //    - Tank 3: Treatment C (Clean Rinsing & Mineral)
  //    - 3 Solenoid Valves with OPEN/CLOSED status indicators
  //    - 12V Diaphragm Pump & 3-Way Manifold Block
  //    - 3 Routed Vinyl Pipes with Animated Liquid Flow Cores
  //    - 3 Brass Atomizing Cone Nozzles
  // ───────────────────────────────────────────────────────────────────────────
  const bottleY = 0.82;
  const bottleZ = -0.32;
  const tankRadius = 0.105;
  const tankHeight = 0.48;

  function createTankBadgeTexture(tankLabel: string, trtLabel: string, colorHexStr: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#060d17';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = colorHexStr;
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 248, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tankLabel, 128, 50);

      ctx.fillStyle = colorHexStr;
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(trtLabel, 128, 96);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function createPipeFlowTexture(fluidColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, fluidColor);
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.5, fluidColor);
      grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, fluidColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 64);

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 20; i++) {
        const bx = (i * 26) % 512;
        const by = 20 + Math.sin(i) * 12;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
  }

  const tankConfigs = [
    { num: 1 as const, x: -0.26, label: 'TANK 1', trt: 'TRT-A', colorHex: 0x06b6d4, colorCss: '#06b6d4', initialLevel: 68 },
    { num: 2 as const, x:  0.00, label: 'TANK 2', trt: 'TRT-B', colorHex: 0x10b981, colorCss: '#10b981', initialLevel: 42 },
    { num: 3 as const, x:  0.26, label: 'TANK 3', trt: 'TRT-C', colorHex: 0x38bdf8, colorCss: '#38bdf8', initialLevel: 0 },
  ];

  const bottleGeom = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 16);
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.42,
    roughness: 0.15,
    transmission: 0.85,
  });

  const capGeom = new THREE.CylinderGeometry(0.048, 0.048, 0.045, 14);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
  const badgeGeom = new THREE.PlaneGeometry(0.12, 0.06);

  const tanksRefMap: Record<1 | 2 | 3, TankRefs> = {} as any;
  const valvesRefMap: Record<1 | 2 | 3, ValveRefs> = {} as any;

  tankConfigs.forEach((cfg) => {
    const tGroup = new THREE.Group();
    tGroup.name = `ChemicalTank_${cfg.num}`;
    tGroup.position.set(cfg.x, bottleY, bottleZ);
    chassisGroup.add(tGroup);

    // 1. Translucent Bottle Body
    const bMesh = new THREE.Mesh(bottleGeom, bottleMat);
    tGroup.add(bMesh);

    // 2. Liquid Fill Mesh
    const liqGeom = new THREE.CylinderGeometry(tankRadius * 0.92, tankRadius * 0.92, tankHeight * 0.90, 14);
    const liqMat = new THREE.MeshStandardMaterial({
      color: cfg.colorHex,
      transparent: true,
      opacity: 0.85,
      roughness: 0.12,
    });
    const liqMesh = new THREE.Mesh(liqGeom, liqMat);
    const initScaleY = Math.max(0.01, cfg.initialLevel / 100);
    liqMesh.scale.set(1, initScaleY, 1);
    const baseY = -tankHeight * 0.45;
    liqMesh.position.set(0, baseY + (tankHeight * 0.90 * initScaleY) / 2, 0);
    tGroup.add(liqMesh);

    // 3. Screw Cap
    const cMesh = new THREE.Mesh(capGeom, capMat);
    cMesh.position.set(0, tankHeight / 2 + 0.02, 0);
    tGroup.add(cMesh);

    // 4. Tank Label Badge
    const badgeMat = new THREE.MeshBasicMaterial({
      map: createTankBadgeTexture(cfg.label, cfg.trt, cfg.colorCss),
      transparent: true,
      side: THREE.DoubleSide,
    });
    const badgeMesh = new THREE.Mesh(badgeGeom, badgeMat);
    badgeMesh.position.set(0, 0, tankRadius + 0.005);
    tGroup.add(badgeMesh);

    // Aluminum mounting ring
    const bracketGeom = new THREE.TorusGeometry(tankRadius + 0.006, 0.008, 6, 20);
    const bracketMesh = new THREE.Mesh(bracketGeom, aluminumMat);
    bracketMesh.rotation.x = Math.PI / 2;
    bracketMesh.position.set(0, 0.05, 0);
    tGroup.add(bracketMesh);

    tanksRefMap[cfg.num] = {
      group: tGroup,
      bottleMesh: bMesh,
      liquidMesh: liqMesh,
      liquidMat: liqMat,
      labelMesh: badgeMesh,
      baseY,
      fullHeight: tankHeight * 0.90,
    };

    // ── Solenoid Valve Under Tank ────────────────────────────────────────────
    const vGroup = new THREE.Group();
    vGroup.name = `SolenoidValve_${cfg.num}`;
    vGroup.position.set(cfg.x, bottleY - tankHeight / 2 - 0.07, bottleZ);
    chassisGroup.add(vGroup);

    const vBodyGeom = new THREE.BoxGeometry(0.065, 0.055, 0.055);
    const vBodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.6 });
    const vBody = new THREE.Mesh(vBodyGeom, vBodyMat);
    vGroup.add(vBody);

    const coilGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10);
    const coilMesh = new THREE.Mesh(coilGeom, new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }));
    coilMesh.position.set(0, 0.045, 0);
    vGroup.add(coilMesh);

    const indGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12);
    const indMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // CLOSED red
    const indMesh = new THREE.Mesh(indGeom, indMat);
    indMesh.rotation.x = Math.PI / 2;
    indMesh.position.set(0, 0, 0.032);
    vGroup.add(indMesh);

    valvesRefMap[cfg.num] = {
      group: vGroup,
      indicatorMesh: indMesh,
      indicatorMat: indMat,
      state: 'CLOSED',
    };
  });

  // ── Central 12V Diaphragm Pump & Manifold Block ───────────────────────────
  const pumpGroup = new THREE.Group();
  pumpGroup.name = 'DiaphragmPumpAssembly';
  pumpGroup.position.set(0.0, 0.50, -0.16);
  chassisGroup.add(pumpGroup);

  const pumpCasingGeom = new THREE.BoxGeometry(0.12, 0.08, 0.14);
  const pumpCasingMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.35, metalness: 0.4 });
  const pumpCasing = new THREE.Mesh(pumpCasingGeom, pumpCasingMat);
  pumpGroup.add(pumpCasing);

  const motorGeom = new THREE.CylinderGeometry(0.038, 0.038, 0.11, 14);
  const motorMesh = new THREE.Mesh(motorGeom, aluminumMat);
  motorMesh.rotation.x = Math.PI / 2;
  motorMesh.position.set(0, 0, -0.09);
  pumpGroup.add(motorMesh);

  const pumpLedGeom = new THREE.SphereGeometry(0.014, 10, 10);
  const pumpLedMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  const pumpLedMesh = new THREE.Mesh(pumpLedGeom, pumpLedMat);
  pumpLedMesh.position.set(0, 0.045, 0.04);
  pumpGroup.add(pumpLedMesh);

  const manifoldGeom = new THREE.BoxGeometry(0.24, 0.035, 0.05);
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 });
  const manifoldMesh = new THREE.Mesh(manifoldGeom, brassMat);
  manifoldMesh.position.set(0, -0.045, 0.01);
  pumpGroup.add(manifoldMesh);

  // ── Three Individual Pipes & Brass Nozzles ────────────────────────────────
  const pipeConfigs = [
    {
      num: 1 as const,
      colorCss: '#06b6d4',
      colorHex: 0x06b6d4,
      pts: [
        new THREE.Vector3(-0.26, bottleY - tankHeight / 2 - 0.09, bottleZ),
        new THREE.Vector3(-0.22, 0.54, -0.24),
        new THREE.Vector3(-0.08, 0.47, -0.16),
        new THREE.Vector3(-0.11, 0.43, -0.08),
        new THREE.Vector3(-0.18, 0.36, 0.04),
      ],
      nozzlePos: new THREE.Vector3(-0.18, 0.34, 0.05),
    },
    {
      num: 2 as const,
      colorCss: '#10b981',
      colorHex: 0x10b981,
      pts: [
        new THREE.Vector3(0.00, bottleY - tankHeight / 2 - 0.09, bottleZ),
        new THREE.Vector3(0.00, 0.54, -0.24),
        new THREE.Vector3(0.00, 0.47, -0.16),
        new THREE.Vector3(0.00, 0.43, -0.08),
        new THREE.Vector3(0.00, 0.36, 0.04),
      ],
      nozzlePos: new THREE.Vector3(0.00, 0.34, 0.05),
    },
    {
      num: 3 as const,
      colorCss: '#38bdf8',
      colorHex: 0x38bdf8,
      pts: [
        new THREE.Vector3(0.26, bottleY - tankHeight / 2 - 0.09, bottleZ),
        new THREE.Vector3(0.22, 0.54, -0.24),
        new THREE.Vector3(0.08, 0.47, -0.16),
        new THREE.Vector3(0.11, 0.43, -0.08),
        new THREE.Vector3(0.18, 0.36, 0.04),
      ],
      nozzlePos: new THREE.Vector3(0.18, 0.34, 0.05),
    },
  ];

  const pipesRefMap: Record<1 | 2 | 3, PipeRefs> = {} as any;
  const nozzlesRefMap: Record<1 | 2 | 3, THREE.Mesh> = {} as any;

  const vinylOuterMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    transparent: true,
    opacity: 0.38,
    roughness: 0.12,
    transmission: 0.82,
    depthWrite: false,
  });

  const nozzleGeom = new THREE.ConeGeometry(0.038, 0.09, 12);

  pipeConfigs.forEach((pc) => {
    const curve = new THREE.CatmullRomCurve3(pc.pts);

    // 1. Clear outer tube
    const outerGeom = new THREE.TubeGeometry(curve, 32, 0.012, 8, false);
    const outerMesh = new THREE.Mesh(outerGeom, vinylOuterMat);
    chassisGroup.add(outerMesh);

    // 2. Inner fluid core with animated procedural flow texture
    const flowTex = createPipeFlowTexture(pc.colorCss);
    const coreMat = new THREE.MeshStandardMaterial({
      color: pc.colorHex,
      map: flowTex,
      transparent: true,
      opacity: 0.06,
      roughness: 0.18,
      metalness: 0.1,
    });
    const coreGeom = new THREE.TubeGeometry(curve, 32, 0.0085, 8, false);
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    chassisGroup.add(coreMesh);

    pipesRefMap[pc.num] = {
      outerTubeMesh: outerMesh,
      fluidCoreMesh: coreMesh,
      fluidCoreMat: coreMat,
      flowTexture: flowTex,
      isActive: false,
    };

    // 3. Atomizing Brass Cone Nozzle at pipe termination
    const nMesh = new THREE.Mesh(nozzleGeom, brassMat);
    nMesh.name = `SprayNozzle_${pc.num}`;
    nMesh.rotation.x = Math.PI * 0.72;
    nMesh.position.copy(pc.nozzlePos);
    chassisGroup.add(nMesh);
    nozzlesRefMap[pc.num] = nMesh;
  });

  const setTankLevel = (tankNum: 1 | 2 | 3, pct: number) => {
    const t = tanksRefMap[tankNum];
    if (!t) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const scaleY = Math.max(0.01, clamped / 100);
    t.liquidMesh.scale.set(1, scaleY, 1);
    t.liquidMesh.position.y = t.baseY + (t.fullHeight * scaleY) / 2;
  };

  const setValveState = (valveNum: 1 | 2 | 3, state: 'OPEN' | 'CLOSED') => {
    const v = valvesRefMap[valveNum];
    if (!v) return;
    v.state = state;
    v.indicatorMat.color.setHex(state === 'OPEN' ? 0x22c55e : 0xef4444);
  };

  const setPumpState = (state: 'OFF' | 'ON') => {
    pumpLedMat.color.setHex(state === 'ON' ? 0x38bdf8 : 0x1e293b);
  };

  const setPipeFlow = (pipeNum: 1 | 2 | 3, active: boolean) => {
    [1, 2, 3].forEach((pNum) => {
      const p = pipesRefMap[pNum as 1 | 2 | 3];
      if (!p) return;
      if (pNum === pipeNum && active) {
        p.isActive = true;
        p.fluidCoreMat.opacity = 0.92;
      } else {
        p.isActive = false;
        p.fluidCoreMat.opacity = 0.05;
      }
    });
  };

  const updateFlowAnimation = (deltaSec: number) => {
    [1, 2, 3].forEach((pNum) => {
      const p = pipesRefMap[pNum as 1 | 2 | 3];
      if (p && p.isActive) {
        p.flowTexture.offset.x -= deltaSec * 3.2;
      }
    });
  };

  const plumbing: TreatmentPlumbingRefs = {
    tanks: tanksRefMap,
    valves: valvesRefMap,
    pump: {
      group: pumpGroup,
      ledMesh: pumpLedMesh,
      ledMat: pumpLedMat,
      state: 'OFF',
    },
    pipes: pipesRefMap,
    nozzles: nozzlesRefMap,
    setTankLevel,
    setValveState,
    setPumpState,
    setPipeFlow,
    updateFlowAnimation,
  };

  const sprayNozzleMesh = nozzlesRefMap[2];
  const tankLiquidMesh = tanksRefMap[2].liquidMesh;

  // Dynamic Spray Particle System (Mist fountain)
  const particleCount = 260;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = 0.0;
    positions[i * 3 + 1] = 0.36;
    positions[i * 3 + 2] = 0.05;

    const spread = 0.45;
    velocities[i * 3 + 0] = (Math.random() - 0.5) * spread;
    velocities[i * 3 + 1] = -1.8 - Math.random() * 1.5;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.075,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  particleSystem.visible = false;
  chassisGroup.add(particleSystem);

  const sprayParticles: SprayParticleRefs = {
    particleSystem,
    particleGeometry,
    particleMaterial,
    positions,
    velocities,
    count: particleCount,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 7. 4 Geared Motors & Agricultural Wheels (At Base of PVC Legs)
  // ───────────────────────────────────────────────────────────────────────────
  function createWheel(): THREE.Group {
    const wheelGroup = new THREE.Group();

    // Rubber Tire
    const tireRadius = 0.35;
    const tireThickness = 0.22;
    const tireGeom = new THREE.CylinderGeometry(tireRadius, tireRadius, tireThickness, 20);
    const tire = new THREE.Mesh(tireGeom, tireRubberMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Tread Knobs around circumference
    const treadCount = 10;
    const knobGeom = new THREE.BoxGeometry(tireThickness * 0.92, 0.035, 0.08);
    for (let k = 0; k < treadCount; k++) {
      const angle = (k / treadCount) * Math.PI * 2;
      const knob = new THREE.Mesh(knobGeom, tireRubberMat);
      knob.position.set(0, Math.cos(angle) * (tireRadius + 0.015), Math.sin(angle) * (tireRadius + 0.015));
      knob.rotation.x = -angle;
      wheelGroup.add(knob);
    }

    // Wheel Rim
    const rimGeom = new THREE.CylinderGeometry(tireRadius * 0.55, tireRadius * 0.55, tireThickness + 0.02, 16);
    const rim = new THREE.Mesh(rimGeom, wheelHubMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Center Axle Hex Nut
    const nutGeom = new THREE.CylinderGeometry(0.08, 0.08, tireThickness + 0.05, 8);
    const nut = new THREE.Mesh(nutGeom, aluminumMat);
    nut.rotation.z = Math.PI / 2;
    wheelGroup.add(nut);

    return wheelGroup;
  }

  const wheelTrackX = trackX + 0.22;

  const wheelFL = createWheel();
  wheelFL.position.set(-wheelTrackX, wheelAxleY, baseZ);
  chassisGroup.add(wheelFL);

  const wheelFR = createWheel();
  wheelFR.position.set(wheelTrackX, wheelAxleY, baseZ);
  chassisGroup.add(wheelFR);

  const wheelRL = createWheel();
  wheelRL.position.set(-wheelTrackX, wheelAxleY, -baseZ);
  chassisGroup.add(wheelRL);

  const wheelRR = createWheel();
  wheelRR.position.set(wheelTrackX, wheelAxleY, -baseZ);
  chassisGroup.add(wheelRR);

  // Motor Axle Shafts extending from PVC elbows to wheels
  const axleGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.22, 12);
  const makeAxle = (x: number, z: number) => {
    const ax = new THREE.Mesh(axleGeom, aluminumMat);
    ax.rotation.z = Math.PI / 2;
    ax.position.set(x, wheelAxleY, z);
    chassisGroup.add(ax);
  };
  makeAxle(-trackX - 0.11, baseZ);
  makeAxle(trackX + 0.11, baseZ);
  makeAxle(-trackX - 0.11, -baseZ);
  makeAxle(trackX + 0.11, -baseZ);

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Capacitive Soil Moisture Sensor Probe (Hanging from Frame)
  // ───────────────────────────────────────────────────────────────────────────
  const soilProbeGeom = new THREE.BoxGeometry(0.03, 0.35, 0.08);
  const soilProbe = new THREE.Mesh(
    soilProbeGeom,
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 })
  );
  soilProbe.position.set(-trackX - 0.06, 0.38, 0.2);
  chassisGroup.add(soilProbe);

  // Black insulated wire routing up the leg
  chassisGroup.add(
    createWire(
      [
        new THREE.Vector3(-trackX - 0.06, 0.55, 0.2),
        new THREE.Vector3(-trackX, 0.9, 0.2),
        new THREE.Vector3(-trackX, trayFloorY + 0.1, 0.2),
        new THREE.Vector3(-0.35, deckY + 0.03, 0.1),
      ],
      0x18181b,
      0.008
    )
  );

  return {
    rootGroup,
    chassisGroup,
    wheels: {
      frontLeft: wheelFL,
      frontRight: wheelFR,
      rearLeft: wheelRL,
      rearRight: wheelRR,
    },
    ultrasonicCones,
    sprayParticles,
    statusLedMaterial,
    sprayNozzleMesh,
    tankLiquidMesh,
    plumbing,
  };
}
