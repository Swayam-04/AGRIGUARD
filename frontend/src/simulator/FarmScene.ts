/**
 * AgriGuard Simulator — Three.js Realistic 3D Farm Environment & Digital Twin Physics
 *
 * Implements:
 * - Large Realistic Working Agricultural Field (6 long crop rows, furrow mounds, drip lines, stakes)
 * - Botanical Low-Poly Tomato Crop Bushes (stems, compound leaves, tomato fruits, healthy/warning/diseased/treated states)
 * - Non-drivable Crop Boundaries & Solid Collision System (Rover cannot drive through crops)
 * - Correct Cardinal Coordinates & Heading (North = -Z, East = +X, South = +Z, West = -X)
 * - Corrected Steering Kinematics (Left turns counter-clockwise towards West, Right turns clockwise towards East)
 * - Genuine 3-way Raycast Ultrasonic Sensor calculation terminating at true obstacle distances
 * - 3D Volumetric Sensor Beams (Left Amber, Center Green, Right Red) with floating in-scene distance tags
 * - Dedicated Secondary FPV Bumper Camera rendering to a live canvas thumbnail
 * - Scenic Farm Environment: Water tank, greenhouse, distant trees, perimeter fence, rocks & crates
 * - Localized precision spray mist particle physics
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAgriGuardRobot, RobotModelRefs } from '../digitalTwin/RobotGeometry';
import { FarmPlant, FieldZone, ObstacleObject, PlantHealthState } from './types';
import { SAFETY_THRESHOLDS } from '../digitalTwin/types';

export type SimCameraMode = 'FOLLOW' | 'CHASE' | 'FREE' | 'OVERHEAD' | 'ISOMETRIC' | 'BUMPER';

export interface RaycastSensorDistances {
  leftCm: number;
  centerCm: number;
  rightCm: number;
}

export class FarmScene {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public robotRefs: RobotModelRefs;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  // Secondary FPV Bumper Camera (renders live thumbnail)
  public bumperCamera: THREE.PerspectiveCamera;
  private bumperCanvas: HTMLCanvasElement | null = null;
  private bumperRenderer: THREE.WebGLRenderer | null = null;

  // Large Farm Dimensions (in meters)
  public readonly fieldWidth = 26.0;  // X: -13m to +13m
  public readonly fieldLength = 40.0; // Z: -20m to +20m

  // Collections
  public plants: FarmPlant[] = [];
  private plantGroups: Map<string, THREE.Group> = new Map();
  private obstacles: ObstacleObject[] = [];
  private obstacleMeshes: THREE.Object3D[] = [];
  private raycastTargets: THREE.Object3D[] = [];

  // Collision Boundaries
  private colliders: { x: number; z: number; radius: number }[] = [];

  // Robot Kinematics (Physical 4-Wheel Rover Simulation)
  // Coordinates: Heading 0 rad = North (along -Z).
  // +X is East (Right), -X is West (Left), +Z is South (Backward), -Z is North (Forward)
  public robotX = 0.0;
  public robotZ = 2.0;       // Started in center driving lane between Row 3 & 4
  public robotHeading = 0.0; // radians (0 = facing North along -Z)
  public robotSpeed = 0.0;   // m/s
  public targetSpeed = 0.0;
  public turnRate = 0.0;     // rad/s
  public targetTurnRate = 0.0;
  public wheelAngleLeft = 0.0;
  public wheelAngleRight = 0.0;

  // Camera Management & Smooth Relative Follow Tracking
  public cameraMode: SimCameraMode = 'FOLLOW';
  public followRobot = true;
  public prevRobotX = 0.0;
  public prevRobotZ = 2.0;
  public isUserInteracting = false;

  // 3D AI Target Inspection Reticle (AR Marker over detected plant)
  private targetReticleGroup!: THREE.Group;
  private reticleRingMesh!: THREE.Mesh;
  private reticleBrackets!: THREE.Group;
  private reticleMat!: THREE.MeshBasicMaterial;

  // Raycasting & Ultrasonic Radar Beams
  private raycaster = new THREE.Raycaster();
  private centerBeamMesh!: THREE.Mesh;
  private leftBeamMesh!: THREE.Mesh;
  private rightBeamMesh!: THREE.Mesh;
  private centerTagSprite!: THREE.Sprite;
  private leftTagSprite!: THREE.Sprite;
  private rightTagSprite!: THREE.Sprite;

  // Targeted Spray Particle Mist
  private sprayParticles!: THREE.Points;
  private sprayPositions!: Float32Array;
  private sprayVelocities!: Float32Array;
  private sprayActive = false;
  private sprayTargetPos = new THREE.Vector3();

  // Cached Botanical Materials
  private healthyLeafMat!: THREE.MeshStandardMaterial;
  private warningLeafMat!: THREE.MeshStandardMaterial;
  private diseasedLeafMat!: THREE.MeshStandardMaterial;
  private treatedLeafMat!: THREE.MeshStandardMaterial;
  private stemMat!: THREE.MeshStandardMaterial;
  private redTomatoMat!: THREE.MeshStandardMaterial;
  private greenTomatoMat!: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Natural clear sky blue
    this.scene.fog = new THREE.FogExp2(0xd6e6f2, 0.016); // Soft atmospheric farm haze

    // 2. Main Simulation Perspective Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 160);
    // Elevated 3rd-person perspective behind robot looking down the rows (matches reference image)
    this.camera.position.set(0, 4.8, 9.5);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. Secondary FPV Bumper Camera (Mounted on robot front)
    this.bumperCamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 40);
    this.bumperCamera.position.set(0, 1.25, -0.6);
    this.bumperCamera.lookAt(0, 0.8, -5.0);

    // 5. OrbitControls (Smooth Free-Look & Follow)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't clip below ground
    this.controls.minDistance = 1.2; // Allow close inspection of chassis & crops
    this.controls.maxDistance = 65.0;
    this.controls.target.set(this.robotX, 0.9, this.robotZ);

    this.controls.addEventListener('start', () => {
      this.isUserInteracting = true;
    });
    this.controls.addEventListener('end', () => {
      this.isUserInteracting = false;
    });

    // 6. Setup Botanical Materials
    this.setupMaterials();

    // 7. Lighting & Environment
    this.setupLighting();

    // 8. Large Agricultural Ground, Furrows & Scenery
    this.setupTerrainAndScenery();

    // 9. Structured Row-based Tomato Plants & Obstacles
    this.setupCropsAndObstacles();

    // 10. Authentic AgriGuard Robot Model
    this.robotRefs = createAgriGuardRobot();
    this.scene.add(this.robotRefs.rootGroup);

    // Attach bumper camera rig to robot
    this.robotRefs.rootGroup.add(this.bumperCamera);

    // 11. Ultrasonic 3D Radar Cones & In-Scene Floating Tags
    this.setupUltrasonicRadarCones();

    // 12. Localized Precision Spray Particle Mist
    this.setupSpraySystem();

    // 13. AI Crop Target Inspection Reticle (AR Visual Identifier)
    this.setupTargetReticle();

    // Initial transform sync
    this.prevRobotX = this.robotX;
    this.prevRobotZ = this.robotZ;
    this.syncRobotTransform();

    // 14. 60 FPS Render Loop
    this.animate = this.animate.bind(this);
    this.animFrameId = requestAnimationFrame(this.animate);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Setup Botanical Materials
  // ───────────────────────────────────────────────────────────────────────────
  private setupMaterials() {
    this.stemMat = new THREE.MeshStandardMaterial({
      color: 0x3a5a2a,
      roughness: 0.8,
      metalness: 0.05,
    });

    this.healthyLeafMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32, // Lush vibrant tomato green
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    this.warningLeafMat = new THREE.MeshStandardMaterial({
      color: 0xa18b28, // Early chlorosis yellow-olive
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    this.diseasedLeafMat = new THREE.MeshStandardMaterial({
      color: 0x6d4323, // Early Blight dark necrotic brown lesions
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    this.treatedLeafMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Resilient treated green with slight foliar spray sheen
      emissive: 0x065f46,
      emissiveIntensity: 0.12,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.redTomatoMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Ripe red tomato
      roughness: 0.28,
      metalness: 0.05,
    });

    this.greenTomatoMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d, // Unripe green tomato
      roughness: 0.35,
      metalness: 0.05,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Outdoor Farm Lighting
  // ───────────────────────────────────────────────────────────────────────────
  private setupLighting() {
    // Ambient natural sky fill
    const ambientLight = new THREE.AmbientLight(0xfff8ed, 0.75);
    this.scene.add(ambientLight);

    // Warm Sun Directional Light casting realistic farm shadows
    const sunLight = new THREE.DirectionalLight(0xfffaea, 1.25);
    sunLight.position.set(18, 30, 16);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -26;
    sunLight.shadow.bias = -0.0006;
    this.scene.add(sunLight);

    // Soft sky hemisphere bounce
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a3525, 0.45);
    this.scene.add(hemiLight);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Large Agricultural Ground, Furrows, Irrigation, & Farm Scenery
  // ───────────────────────────────────────────────────────────────────────────
  private setupTerrainAndScenery() {
    // 1. Base Soil Plane (Tilled agricultural brown earth)
    const groundGeom = new THREE.PlaneGeometry(this.fieldWidth + 12, this.fieldLength + 12, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x422f20, // Natural dark farm soil
      roughness: 0.95,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Compacted Tractor Driving Furrow Tracks in Open Corridors
    const laneXCoordinates = [-6.0, -3.0, 0.0, 3.0, 6.0];
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x332316,
      roughness: 0.9,
    });

    laneXCoordinates.forEach((lx) => {
      const trackGeom = new THREE.PlaneGeometry(1.6, this.fieldLength * 0.92);
      const track = new THREE.Mesh(trackGeom, trackMat);
      track.rotation.x = -Math.PI / 2;
      track.position.set(lx, 0.003, 0);
      track.receiveShadow = true;
      this.scene.add(track);
    });

    // 3. Raised Earthen Furrow Soil Berms (Mounded ridges under each of the 6 rows)
    const rowXCoordinates = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    const bermMat = new THREE.MeshStandardMaterial({
      color: 0x3b2819,
      roughness: 0.95,
    });

    const dripTubeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark polyethylene black drip tape
      roughness: 0.6,
    });

    const stakeMat = new THREE.MeshStandardMaterial({
      color: 0x6b4f36, // Weathered wood trellis stake
      roughness: 0.85,
    });

    rowXCoordinates.forEach((rx) => {
      // Raised furrow ridge
      const ridgeGeom = new THREE.BoxGeometry(0.85, 0.14, 32.0);
      const ridge = new THREE.Mesh(ridgeGeom, bermMat);
      ridge.position.set(rx, 0.07, 0);
      ridge.receiveShadow = true;
      this.scene.add(ridge);

      // Black Drip Irrigation Line resting on ridge alongside crop roots
      const tubeGeom = new THREE.CylinderGeometry(0.016, 0.016, 32.0, 8);
      const tube = new THREE.Mesh(tubeGeom, dripTubeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(rx + 0.28, 0.15, 0);
      this.scene.add(tube);

      // Wooden Trellis Stakes spaced along the row
      for (let z = -15; z <= 15; z += 5) {
        const stakeGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8);
        const stake = new THREE.Mesh(stakeGeom, stakeMat);
        stake.position.set(rx, 0.8, z);
        stake.castShadow = true;
        this.scene.add(stake);
        this.raycastTargets.push(stake);
        this.colliders.push({ x: rx, z, radius: 0.35 });
      }
    });

    // 4. Perimeter Wooden Ranch Fence
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6d4c31, roughness: 0.85 });
    const postGeom = new THREE.CylinderGeometry(0.07, 0.07, 1.25, 8);

    const halfW = this.fieldWidth / 2 + 1.5;
    const halfL = this.fieldLength / 2 + 1.5;

    // Boundary Fence Posts
    for (let x = -halfW; x <= halfW; x += 3.5) {
      [-halfL, halfL].forEach((z) => {
        const post = new THREE.Mesh(postGeom, fenceMat);
        post.position.set(x, 0.62, z);
        post.castShadow = true;
        this.scene.add(post);
        this.raycastTargets.push(post);
        this.colliders.push({ x, z, radius: 0.5 });
      });
    }

    for (let z = -halfL; z <= halfL; z += 3.5) {
      [-halfW, halfW].forEach((x) => {
        const post = new THREE.Mesh(postGeom, fenceMat);
        post.position.set(x, 0.62, z);
        post.castShadow = true;
        this.scene.add(post);
        this.raycastTargets.push(post);
        this.colliders.push({ x, z, radius: 0.5 });
      });
    }

    // 5. Authentic Farm Scenery: Agricultural Water Tank on Concrete Pad (as shown in reference image left)
    const padGeom = new THREE.BoxGeometry(2.2, 0.25, 2.2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const pad = new THREE.Mesh(padGeom, padMat);
    pad.position.set(-11.5, 0.12, -12.0);
    pad.receiveShadow = true;
    this.scene.add(pad);

    const tankGeom = new THREE.CylinderGeometry(0.9, 0.9, 2.2, 20);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const tank = new THREE.Mesh(tankGeom, tankMat);
    tank.position.set(-11.5, 1.35, -12.0);
    tank.castShadow = true;
    this.scene.add(tank);
    this.raycastTargets.push(tank);
    this.colliders.push({ x: -11.5, z: -12.0, radius: 1.3 });

    // 6. Hoop Tunnel Polyhouse / Greenhouse (as shown in reference image right background)
    const ghGroup = new THREE.Group();
    ghGroup.position.set(9.5, 0, -18.5);

    const hoopMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    const tunnelGeom = new THREE.CylinderGeometry(2.0, 2.0, 7.0, 16, 1, true, 0, Math.PI);
    const tunnel = new THREE.Mesh(tunnelGeom, hoopMat);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.rotation.z = Math.PI / 2;
    tunnel.position.set(0, 0, 0);
    ghGroup.add(tunnel);

    this.scene.add(ghGroup);
    this.colliders.push({ x: 9.5, z: -18.5, radius: 2.5 });

    // 7. Distant Windbreak Trees along Horizon
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.8 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });

    for (let x = -24; x <= 24; x += 4.5) {
      const tree = new THREE.Group();
      const trH = 1.6 + Math.random() * 0.8;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, trH, 8), trunkMat);
      trunk.position.y = trH / 2;
      tree.add(trunk);

      const folR = 1.4 + Math.random() * 0.6;
      const fol = new THREE.Mesh(new THREE.DodecahedronGeometry(folR, 1), foliageMat);
      fol.position.y = trH + folR * 0.85;
      tree.add(fol);

      tree.position.set(x + (Math.random() - 0.5) * 1.5, 0, -25.0);
      this.scene.add(tree);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Structured Row-Based Tomato Crop Bushes & Obstacles
  // ───────────────────────────────────────────────────────────────────────────
  private setupCropsAndObstacles() {
    // 6 Long Rows: X = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]
    // 17 plants per row from Z = -16.0 to Z = +16.0 (2.0m spacing)
    // Total: 102 individual structured plants with explicit world coordinates
    const rowXCoords = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    const zSpacing = 2.0;
    const zStart = -16.0;
    const plantsPerRow = 17;

    let plantCounter = 1;

    rowXCoords.forEach((rx, rowIdx) => {
      for (let colIdx = 0; colIdx < plantsPerRow; colIdx++) {
        const pz = zStart + colIdx * zSpacing;
        let id = `PLANT-#${String(plantCounter).padStart(3, '0')}`;

        // Specific disease targets positioned along robot's path
        let state: PlantHealthState = 'HEALTHY';
        let healthScore = 91 + Math.floor(Math.random() * 7);
        let diseaseInfo = undefined;

        // Target plant in Row 3 near starting corridor: Plant #023 (Tomato, Early Blight, 94%, Moderate)
        if (rx === -1.5 && pz === 2.0) {
          id = 'Plant #023';
          state = 'DISEASED';
          healthScore = 41;
          diseaseInfo = {
            name: 'Early Blight',
            pathogen: 'Alternaria solani',
            confidence: 0.94,
            severity: 'Moderate',
            symptoms: 'Dark concentric brown necrotic rings with chlorotic yellow halo on lower foliage',
            recommendedTreatment: 'Treatment B',
            chemicalProduct: 'Cold-Pressed Bio-Neem Solution',
            recommendedDoseMl: 40,
            inventoryAvailable: true,
          };
        } else if (rx === -1.5 && pz === 0.0) {
          id = 'Plant #022';
          state = 'DISEASED';
          healthScore = 38;
          diseaseInfo = {
            name: 'Late Blight',
            pathogen: 'Phytophthora infestans',
            confidence: 0.91,
            severity: 'Severe',
            symptoms: 'Water-soaked irregular necrotic patches on leaf margins with white sporulation',
            recommendedTreatment: 'Treatment A',
            chemicalProduct: 'Copper Hydroxide 77% Solution',
            recommendedDoseMl: 45,
            inventoryAvailable: true,
          };
        } else if (rx === 1.5 && pz === 2.0) {
          id = 'Plant #054';
          state = 'WARNING';
          healthScore = 71;
          diseaseInfo = {
            name: 'Nutrient Imbalance & Chlorosis',
            pathogen: 'Physiological Stress',
            confidence: 0.82,
            severity: 'Mild',
            symptoms: 'Interveinal yellowing on lower leaves; foliar wash and nutrient boost indicated',
            recommendedTreatment: 'Treatment C',
            chemicalProduct: 'Clean Rinsing & Mineral Protectant',
            recommendedDoseMl: 30,
            inventoryAvailable: true,
          };
        } else if (rx === 1.5 && pz === -6.0) {
          // Another diseased target in Row 4
          state = 'DISEASED';
          healthScore = 48;
          diseaseInfo = {
            name: 'Septoria Leaf Spot',
            pathogen: 'Septoria lycopersici',
            confidence: 0.88,
            symptoms: 'Small circular spots with dark brown margins and gray centers',
            recommendedTreatment: 'Bio-fungicide Bacillus subtilis foliar spray',
            chemicalProduct: 'Serenade ASO',
            recommendedDoseMl: 35,
            inventoryAvailable: true,
          };
        } else if (rx === -4.5 && pz === 0.0) {
          // Diseased target in West Row 2
          state = 'DISEASED';
          healthScore = 39;
          diseaseInfo = {
            name: 'Powdery Mildew',
            pathogen: 'Oidium neolycopersici',
            confidence: 0.91,
            symptoms: 'White powdery fungal patches on upper leaf surfaces and stems',
            recommendedTreatment: 'Potassium Bicarbonate (3 g/L) organic contact fungicide',
            chemicalProduct: 'MilStop Broad Spectrum',
            recommendedDoseMl: 45,
            inventoryAvailable: true,
          };
        }

        const plant: FarmPlant = {
          id,
          row: rowIdx + 1,
          col: colIdx + 1,
          position: { x: rx, z: pz },
          state,
          cropType: 'Tomato',
          variety: 'San Marzano Vine',
          healthScore,
          disease: diseaseInfo,
          treatmentHistory: [],
        };

        this.plants.push(plant);
        this.createBotanicalCropMesh(plant);

        // Realistic collision cylinder around plant stalk and root mound
        this.colliders.push({ x: rx, z: pz, radius: 0.18 });
        plantCounter++;
      }
    });

    // Realistic Field Obstacles (Exactly matching the reference image):
    // 1. Natural Granite Boulder sitting on right side of Center Lane (X: 0.92, Z: -2.2)
    // 2. Plastic Harvesting Crate sitting in lane (X: 0.0, Z: 6.5)
    // 3. Smaller rock obstacle
    const fieldObstacles: ObstacleObject[] = [
      { id: 'OBS-BOULDER-1', type: 'ROCK', position: { x: 0.92, y: 0.38, z: -2.2 }, radius: 0.42, height: 0.72 },
      { id: 'OBS-CRATE-1', type: 'CRATE', position: { x: 0.0, y: 0.28, z: 6.5 }, radius: 0.38, height: 0.55 },
      { id: 'OBS-BOULDER-2', type: 'ROCK', position: { x: -3.0, y: 0.32, z: -8.0 }, radius: 0.40, height: 0.65 },
      { id: 'OBS-IRRIG-1', type: 'IRRIGATION_BOX', position: { x: 3.0, y: 0.35, z: 8.5 }, radius: 0.35, height: 0.7 },
    ];

    fieldObstacles.forEach((obs) => {
      this.obstacles.push(obs);
      this.createObstacle3DMesh(obs);
      this.colliders.push({ x: obs.position.x, z: obs.position.z, radius: obs.radius });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Botanical Tomato Crop Geometry (NO Cartoon Balls / Spheres!)
  // ───────────────────────────────────────────────────────────────────────────
  private createBotanicalCropMesh(plant: FarmPlant) {
    const group = new THREE.Group();
    group.name = plant.id;
    group.position.set(plant.position.x, 0, plant.position.z);

    // 1. Central Woody Stalk / Stem
    const stemGeom = new THREE.CylinderGeometry(0.022, 0.038, 0.95, 8);
    const stem = new THREE.Mesh(stemGeom, this.stemMat);
    stem.position.y = 0.48;
    stem.castShadow = true;
    group.add(stem);

    // 2. Multi-Tiered Compound Leaflet Foliage (Botanical branching structure)
    const leafMat = this.getFoliageMaterial(plant.state);

    // Create 4 natural lateral branches with pinnate compound leaflets
    const branchConfigs = [
      { y: 0.32, rotY: 0.3, len: 0.45, tilt: 0.35 },
      { y: 0.48, rotY: 1.8, len: 0.52, tilt: 0.30 },
      { y: 0.62, rotY: 3.4, len: 0.48, tilt: 0.25 },
      { y: 0.76, rotY: 5.1, len: 0.40, tilt: 0.20 },
      { y: 0.90, rotY: 1.0, len: 0.32, tilt: 0.12 }, // Top crown
    ];

    branchConfigs.forEach((cfg) => {
      const branchGroup = new THREE.Group();
      branchGroup.position.set(0, cfg.y, 0);
      branchGroup.rotation.y = cfg.rotY;
      branchGroup.rotation.z = cfg.tilt;

      // Slender branch twig
      const twigGeom = new THREE.CylinderGeometry(0.008, 0.014, cfg.len, 6);
      const twig = new THREE.Mesh(twigGeom, this.stemMat);
      twig.position.set(cfg.len / 2, 0, 0);
      twig.rotation.z = -Math.PI / 2;
      branchGroup.add(twig);

      // Serrated botanical leaf blades (compound leaflets arranged along twig)
      const numLeaflets = 3;
      for (let i = 0; i < numLeaflets; i++) {
        const leafDist = (cfg.len / numLeaflets) * (i + 1);
        const leafW = 0.14 * (1 - i * 0.15);
        const leafL = 0.22 * (1 - i * 0.15);

        // Elongated diamond leaf blade profile
        const leafGeom = new THREE.PlaneGeometry(leafW, leafL, 2, 2);
        // Add subtle natural organic curvature along leaf centerline
        const pos = leafGeom.attributes.position;
        pos.setZ(0, -0.02);
        pos.setZ(1, 0.0);
        pos.setZ(2, -0.02);
        leafGeom.computeVertexNormals();

        const leafMesh = new THREE.Mesh(leafGeom, leafMat);
        leafMesh.position.set(leafDist, 0.02, (i % 2 === 0 ? 1 : -1) * 0.04);
        leafMesh.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.3 : -0.3);
        leafMesh.rotation.y = (Math.random() - 0.5) * 0.4;
        leafMesh.castShadow = true;
        branchGroup.add(leafMesh);
      }

      group.add(branchGroup);
    });

    // 3. Hanging Tomato Fruits (Subtle agricultural realism)
    const numTomatoes = plant.state === 'DISEASED' ? 1 : 2;
    for (let i = 0; i < numTomatoes; i++) {
      const isRed = plant.state !== 'WARNING';
      const fruitGeom = new THREE.SphereGeometry(0.048, 8, 8);
      const fruitMesh = new THREE.Mesh(fruitGeom, isRed ? this.redTomatoMat : this.greenTomatoMat);
      const ang = (i * 2.2) + Math.random();
      fruitMesh.position.set(Math.cos(ang) * 0.14, 0.38 + i * 0.12, Math.sin(ang) * 0.14);
      fruitMesh.castShadow = true;
      group.add(fruitMesh);
    }

    this.scene.add(group);
    this.plantGroups.set(plant.id, group);
    this.raycastTargets.push(stem);
  }

  private getFoliageMaterial(state: PlantHealthState): THREE.MeshStandardMaterial {
    switch (state) {
      case 'HEALTHY':
        return this.healthyLeafMat;
      case 'WARNING':
        return this.warningLeafMat;
      case 'DISEASED':
        return this.diseasedLeafMat;
      case 'TREATED':
        return this.treatedLeafMat;
    }
  }

  public updatePlantState(plantId: string, newState: PlantHealthState) {
    const plant = this.plants.find((p) => p.id === plantId);
    if (!plant) return;

    plant.state = newState;
    const group = this.plantGroups.get(plantId);
    if (group) {
      const newMat = this.getFoliageMaterial(newState);
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry instanceof THREE.PlaneGeometry) {
          mesh.material = newMat;
        }
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Physical Obstacle Meshes (Rock boulders, harvest crates, irrigation boxes)
  // ───────────────────────────────────────────────────────────────────────────
  private createObstacle3DMesh(obs: ObstacleObject) {
    let mesh: THREE.Mesh;
    if (obs.type === 'ROCK') {
      // Natural textured granite boulder (as shown in reference image right of rover)
      const geom = new THREE.DodecahedronGeometry(obs.radius, 2);
      // Displace vertices to create authentic organic jagged rock facets
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const noise = 1.0 + (Math.sin(vx * 7) * Math.cos(vz * 7)) * 0.14;
        pos.setXYZ(i, vx * noise, vy * (noise * 0.85), vz * noise);
      }
      geom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0x8b8578, // Rustic granite rock
        roughness: 0.95,
        metalness: 0.05,
      });
      mesh = new THREE.Mesh(geom, mat);
    } else if (obs.type === 'CRATE') {
      // Plastic harvest field crate
      const geom = new THREE.BoxGeometry(obs.radius * 2, obs.height, obs.radius * 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
      mesh = new THREE.Mesh(geom, mat);
    } else {
      const geom = new THREE.CylinderGeometry(obs.radius, obs.radius, obs.height, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      mesh = new THREE.Mesh(geom, mat);
    }

    mesh.position.set(obs.position.x, obs.position.y, obs.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isObstacle: true, id: obs.id };

    this.scene.add(mesh);
    this.obstacleMeshes.push(mesh);
    this.raycastTargets.push(mesh);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ultrasonic 3D Radar Cones & In-Scene Distance Tags
  // ───────────────────────────────────────────────────────────────────────────
  private setupUltrasonicRadarCones() {
    const createBeamMesh = (colorHex: number) => {
      // Cone with apex at (0, 0, 0) pointing along -Z
      const geom = new THREE.ConeGeometry(0.35, 1.0, 16, 1, true);
      geom.translate(0, -0.5, 0);
      geom.rotateX(Math.PI / 2); // Orient forward along -Z

      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.38,
        wireframe: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      this.scene.add(mesh);
      return mesh;
    };

    this.centerBeamMesh = createBeamMesh(0x10b981);
    this.leftBeamMesh = createBeamMesh(0xf59e0b);
    this.rightBeamMesh = createBeamMesh(0xf43f5e);

    // Floating 3D In-Scene Distance Tags (Black badge with distance text)
    this.centerTagSprite = this.createTagSprite('72 cm', '#10b981');
    this.leftTagSprite = this.createTagSprite('48 cm', '#f59e0b');
    this.rightTagSprite = this.createTagSprite('18 cm', '#f43f5e');

    this.scene.add(this.centerTagSprite);
    this.scene.add(this.leftTagSprite);
    this.scene.add(this.rightTagSprite);
  }

  private createTagSprite(text: string, colorCss: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Rounded badge background
    ctx.fillStyle = 'rgba(11, 19, 32, 0.88)';
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 8, 144, 48, 10);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 80, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.36, 1.0);
    return sprite;
  }

  private updateTagSprite(sprite: THREE.Sprite, text: string, colorCss: string) {
    const canvas = (sprite.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(11, 19, 32, 0.90)';
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 8, 144, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 80, 32);

    sprite.material.map!.needsUpdate = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Targeted Precision Spray Particles
  // ───────────────────────────────────────────────────────────────────────────
  private setupSpraySystem() {
    const count = 160;
    this.sprayPositions = new Float32Array(count * 3);
    this.sprayVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.sprayPositions[i * 3 + 0] = 0;
      this.sprayPositions[i * 3 + 1] = -100;
      this.sprayPositions[i * 3 + 2] = 0;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.055,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });

    this.sprayParticles = new THREE.Points(geom, mat);
    this.scene.add(this.sprayParticles);
  }

  private activeNozzleNum: 1 | 2 | 3 = 2;
  private activeTankNum: 1 | 2 | 3 = 2;
  private lastAnimTime = 0;

  public activateTreatmentSpray(targetPlant: FarmPlant, nozzleNum: 1 | 2 | 3 = 2, tankNum: 1 | 2 | 3 = 2) {
    this.sprayActive = true;
    this.activeNozzleNum = nozzleNum;
    this.activeTankNum = tankNum;
    this.sprayTargetPos.set(targetPlant.position.x, 0.45, targetPlant.position.z);

    // Color particles according to selected tank
    const tankColors: Record<1 | 2 | 3, number> = {
      1: 0x06b6d4, // Treatment A (Copper)
      2: 0x10b981, // Treatment B (Organic Bio-Neem)
      3: 0x38bdf8, // Treatment C (Mineral)
    };
    (this.sprayParticles.material as THREE.PointsMaterial).color.setHex(tankColors[tankNum] || 0x10b981);
    (this.sprayParticles.material as THREE.PointsMaterial).opacity = 0.88;

    const nozzleWorldPos = this.getNozzleWorldPosition(nozzleNum);

    const count = this.sprayPositions.length / 3;
    for (let i = 0; i < count; i++) {
      this.sprayPositions[i * 3 + 0] = nozzleWorldPos.x;
      this.sprayPositions[i * 3 + 1] = nozzleWorldPos.y;
      this.sprayPositions[i * 3 + 2] = nozzleWorldPos.z;

      const toTarget = this.sprayTargetPos.clone().sub(nozzleWorldPos).normalize();
      this.sprayVelocities[i * 3 + 0] = toTarget.x * 2.8 + (Math.random() - 0.5) * 0.35;
      this.sprayVelocities[i * 3 + 1] = toTarget.y * 2.8 + (Math.random() - 0.5) * 0.35;
      this.sprayVelocities[i * 3 + 2] = toTarget.z * 2.8 + (Math.random() - 0.5) * 0.35;
    }
  }

  public activateSpray(targetPlant: FarmPlant) {
    this.activateTreatmentSpray(targetPlant, 2, 2);
  }

  public deactivateSpray() {
    this.sprayActive = false;
    (this.sprayParticles.material as THREE.PointsMaterial).opacity = 0.0;
  }

  public getNozzleWorldPosition(nozzleNum: 1 | 2 | 3 = 2): THREE.Vector3 {
    const n = this.robotRefs?.plumbing?.nozzles?.[nozzleNum];
    const out = new THREE.Vector3();
    if (n) {
      n.getWorldPosition(out);
      return out;
    }
    return new THREE.Vector3(this.robotX, 0.42, this.robotZ);
  }

  public getDistanceToPlant(plant: FarmPlant): number {
    return Math.hypot(plant.position.x - this.robotX, plant.position.z - this.robotZ);
  }

  public isTargetInRange(plant: FarmPlant, maxRangeMeters = 2.2): boolean {
    return this.getDistanceToPlant(plant) <= maxRangeMeters;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3D AI Target Inspection Reticle (AR Visual Identifier)
  // ───────────────────────────────────────────────────────────────────────────
  private setupTargetReticle() {
    this.targetReticleGroup = new THREE.Group();
    this.targetReticleGroup.name = 'AITargetReticle';
    this.targetReticleGroup.visible = false;

    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    // 1. Concentric Targeting Ring
    const ringGeom = new THREE.RingGeometry(0.35, 0.40, 32);
    this.reticleRingMesh = new THREE.Mesh(ringGeom, this.reticleMat);
    this.reticleRingMesh.rotation.x = -Math.PI / 2;
    this.targetReticleGroup.add(this.reticleRingMesh);

    // 2. 4 HUD Corner Brackets
    this.reticleBrackets = new THREE.Group();
    const bLen = 0.14;
    const bRad = 0.44;
    [
      { x: bRad, z: bRad, rotY: 0 },
      { x: -bRad, z: bRad, rotY: Math.PI / 2 },
      { x: -bRad, z: -bRad, rotY: Math.PI },
      { x: bRad, z: -bRad, rotY: -Math.PI / 2 },
    ].forEach((b) => {
      const bGeom = new THREE.BufferGeometry();
      const pts = [
        new THREE.Vector3(-bLen, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -bLen),
      ];
      bGeom.setFromPoints(pts);
      const line = new THREE.Line(bGeom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 }));
      line.position.set(b.x, 0, b.z);
      line.rotation.y = b.rotY;
      this.reticleBrackets.add(line);
    });
    this.targetReticleGroup.add(this.reticleBrackets);

    this.scene.add(this.targetReticleGroup);
  }

  public updateTargetReticle(plant: FarmPlant | null) {
    if (!plant) {
      if (this.targetReticleGroup) this.targetReticleGroup.visible = false;
      return;
    }

    if (this.targetReticleGroup) {
      this.targetReticleGroup.visible = true;
      this.targetReticleGroup.position.set(plant.position.x, 1.05, plant.position.z);

      let colorHex = 0x10b981; // Safe Green
      if (plant.state === 'DISEASED') {
        colorHex = 0xef4444; // Diseased Red
      } else if (plant.state === 'WARNING') {
        colorHex = 0xf59e0b; // Warning Amber
      } else if (plant.state === 'TREATED') {
        colorHex = 0xa855f7; // Treated Purple
      }

      this.reticleMat.color.setHex(colorHex);
      this.reticleBrackets.traverse((child) => {
        if ((child as THREE.Line).isLine) {
          ((child as THREE.Line).material as THREE.LineBasicMaterial).color.setHex(colorHex);
        }
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Genuine 3-Way Ultrasonic Raycast Distance Calculation
  // ───────────────────────────────────────────────────────────────────────────
  public computeUltrasonicDistances(): RaycastSensorDistances {
    const originY = 1.42; // Sensor mounting height on PVC rails
    const maxRangeMeters = 3.0;

    // Robot Heading Direction (Heading 0 = North along -Z)
    // Forward Vector f = (sin(theta), 0, -cos(theta))
    const fwdX = Math.sin(this.robotHeading);
    const fwdZ = -Math.cos(this.robotHeading);

    // Left Vector = 90 deg counter-clockwise from fwd = (-cos(theta), 0, -sin(theta))
    const leftDirX = -Math.cos(this.robotHeading);
    const leftDirZ = -Math.sin(this.robotHeading);

    // Right Vector = 90 deg clockwise from fwd = (cos(theta), 0, sin(theta))
    const rightDirX = Math.cos(this.robotHeading);
    const rightDirZ = Math.sin(this.robotHeading);

    // Sensor Mount Origins on Rover (Front PVC bumper & lateral frame rails)
    const centerOrigin = new THREE.Vector3(this.robotX + fwdX * 0.75, originY, this.robotZ + fwdZ * 0.75);
    const leftOrigin = new THREE.Vector3(this.robotX + leftDirX * 0.55, originY, this.robotZ + leftDirZ * 0.55);
    const rightOrigin = new THREE.Vector3(this.robotX + rightDirX * 0.55, originY, this.robotZ + rightDirZ * 0.55);

    const centerDir = new THREE.Vector3(fwdX, 0, fwdZ).normalize();
    const leftDir = new THREE.Vector3(leftDirX, 0, leftDirZ).normalize();
    const rightDir = new THREE.Vector3(rightDirX, 0, rightDirZ).normalize();

    const measureSensorDistance = (origin: THREE.Vector3, dir: THREE.Vector3): number => {
      let minDist = maxRangeMeters;

      // 1. Raycast mesh targets (horizontal ray + downward angled ray)
      this.raycaster.set(origin, dir);
      this.raycaster.near = 0.05;
      this.raycaster.far = maxRangeMeters;
      const hits = this.raycaster.intersectObjects(this.raycastTargets, true);
      if (hits.length > 0 && hits[0].distance < minDist) {
        minDist = hits[0].distance;
      }

      // Slightly downward angled ray (-15 deg) to detect lower ground boulders and crates
      const downDir = dir.clone().setY(-0.25).normalize();
      this.raycaster.set(origin, downDir);
      const downHits = this.raycaster.intersectObjects(this.raycastTargets, true);
      if (downHits.length > 0 && downHits[0].distance < minDist) {
        minDist = downHits[0].distance;
      }

      // 2. Analytical Acoustic Cone Intersection against all physical field colliders
      // HC-SR04 ultrasonic sound waves emanate in a ~20 degree acoustic cone
      for (const col of this.colliders) {
        const dx = col.x - origin.x;
        const dz = col.z - origin.z;
        const proj = dx * dir.x + dz * dir.z;
        if (proj > 0.08 && proj < minDist) {
          const perp = Math.abs(dx * (-dir.z) + dz * dir.x);
          const coneRadiusAtDist = col.radius + proj * 0.26;
          if (perp <= coneRadiusAtDist) {
            const surfaceDist = Math.max(0.12, proj - col.radius * 0.6);
            if (surfaceDist < minDist) {
              minDist = surfaceDist;
            }
          }
        }
      }

      return minDist;
    };

    const centerDistM = measureSensorDistance(centerOrigin, centerDir);
    const leftDistM = measureSensorDistance(leftOrigin, leftDir);
    const rightDistM = measureSensorDistance(rightOrigin, rightDir);

    const centerCm = Math.max(8, Math.round(centerDistM * 100));
    const leftCm = Math.max(8, Math.round(leftDistM * 100));
    const rightCm = Math.max(8, Math.round(rightDistM * 100));

    // Update 3D Visual Radar Cones & Tags
    this.updateRadarCone(this.centerBeamMesh, this.centerTagSprite, centerOrigin, centerDir, centerDistM, centerCm);
    this.updateRadarCone(this.leftBeamMesh, this.leftTagSprite, leftOrigin, leftDir, leftDistM, leftCm);
    this.updateRadarCone(this.rightBeamMesh, this.rightTagSprite, rightOrigin, rightDir, rightDistM, rightCm);

    return { centerCm, leftCm, rightCm };
  }

  private updateRadarCone(
    cone: THREE.Mesh,
    tag: THREE.Sprite,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    distMeters: number,
    distCm: number
  ) {
    // 1. Position and scale cone so its apex is at sensor origin and height equals distance
    cone.position.copy(origin);

    // Look in raycast direction
    const target = origin.clone().add(dir);
    cone.lookAt(target);

    // Scale cone along Z (height) and radial expansion
    const beamRadiusScale = Math.max(0.4, distMeters * 0.45);
    cone.scale.set(beamRadiusScale, beamRadiusScale, distMeters);

    // Color code based on obstacle safety thresholds
    let colorHex = 0x10b981; // Safe Green (> 60 cm)
    let colorCss = '#10b981';
    if (distCm < SAFETY_THRESHOLDS.OBSTACLE_CM) {
      colorHex = 0xf43f5e; // Obstacle Red (< 25 cm)
      colorCss = '#f43f5e';
    } else if (distCm <= SAFETY_THRESHOLDS.WARNING_CM) {
      colorHex = 0xf59e0b; // Warning Amber (25 - 60 cm)
      colorCss = '#f59e0b';
    }

    (cone.material as THREE.MeshBasicMaterial).color.setHex(colorHex);

    // 2. Position floating distance tag midway along the beam
    const midPoint = origin.clone().add(dir.clone().multiplyScalar(distMeters * 0.55));
    tag.position.set(midPoint.x, origin.y + 0.35, midPoint.z);
    this.updateTagSprite(tag, `${distCm} cm`, colorCss);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Non-Drivable Crop Boundaries & Collision Checking
  // ───────────────────────────────────────────────────────────────────────────
  public checkCollision(proposedX: number, proposedZ: number, currX?: number, currZ?: number): boolean {
    const robotRadius = 0.42; // Real bounding radius of AgriGuard prototype rover chassis footprint

    // 1. Field Boundary Collisions (Keep inside ranch fence perimeter)
    const maxHalfW = this.fieldWidth / 2 - 1.2;
    const maxHalfL = this.fieldLength / 2 - 1.2;
    if (Math.abs(proposedX) > maxHalfW || Math.abs(proposedZ) > maxHalfL) {
      return true; // Collided with field perimeter fence
    }

    // 2. Solid Obstacle and Crop Stalk Collisions
    for (const collider of this.colliders) {
      const dx = proposedX - collider.x;
      const dz = proposedZ - collider.z;
      const minDist = robotRadius + collider.radius;
      const proposedDistSq = dx * dx + dz * dz;
      const minDistSq = minDist * minDist;

      if (proposedDistSq < minDistSq) {
        // If moving AWAY from the collider (e.g. reversing or steering out), ALLOW IT!
        if (currX !== undefined && currZ !== undefined) {
          const currDx = currX - collider.x;
          const currDz = currZ - collider.z;
          const currDistSq = currDx * currDx + currDz * currDz;
          if (proposedDistSq >= currDistSq) {
            // Distance is increasing -> moving away from obstacle!
            continue;
          }
        }
        return true; // Path blocked by crop or obstacle
      }
    }

    return false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Physics & Kinematic Step (Differential Drive Simulation)
  // ───────────────────────────────────────────────────────────────────────────
  public updateKinematics(deltaSec: number, centerUltrasonicCm: number): { safetyStop: boolean; blocked: boolean } {
    let safetyStop = false;
    let blocked = false;

    // 1. Center Obstacle Safety Hard-Stop
    // Only triggers when attempting to drive forward directly into an obstacle < 25cm
    if (centerUltrasonicCm < SAFETY_THRESHOLDS.OBSTACLE_CM && this.targetSpeed > 0) {
      this.targetSpeed = 0;
      safetyStop = true;
    }

    // 2. Smooth acceleration / deceleration
    this.robotSpeed = THREE.MathUtils.lerp(this.robotSpeed, this.targetSpeed, 0.18);
    this.turnRate = THREE.MathUtils.lerp(this.turnRate, this.targetTurnRate, 0.18);

    // 3. Differential Heading Integration
    if (Math.abs(this.turnRate) > 0.001) {
      this.robotHeading += this.turnRate * deltaSec;
      // Wrap to 0..2PI
      this.robotHeading = (this.robotHeading + Math.PI * 2) % (Math.PI * 2);
    }

    // 4. Proposed Position Step & Corridor Sliding
    if (Math.abs(this.robotSpeed) > 0.001) {
      const moveDelta = this.robotSpeed * deltaSec;
      // Heading 0 = North (along -Z)
      const fwdX = Math.sin(this.robotHeading);
      const fwdZ = -Math.cos(this.robotHeading);

      const proposedX = this.robotX + fwdX * moveDelta;
      const proposedZ = this.robotZ + fwdZ * moveDelta;

      // Check Collision against crops, boundaries, and obstacles
      if (this.checkCollision(proposedX, proposedZ, this.robotX, this.robotZ)) {
        // Try corridor sliding down Z (along crop furrows)
        if (!this.checkCollision(this.robotX, proposedZ, this.robotX, this.robotZ)) {
          this.robotZ = proposedZ;
        } else if (!this.checkCollision(proposedX, this.robotZ, this.robotX, this.robotZ)) {
          // Slide along X
          this.robotX = proposedX;
        } else {
          // Both axes blocked: halt forward motion smoothly
          this.robotSpeed = 0;
          this.targetSpeed = 0;
          blocked = true;
        }
      } else {
        this.robotX = proposedX;
        this.robotZ = proposedZ;
      }
    }

    // 5. Differential Wheel Rotation Animation (runs on translation OR pivot in place)
    if (Math.abs(this.robotSpeed) > 0.001 || Math.abs(this.turnRate) > 0.001) {
      const wheelCircumference = Math.PI * 0.7; // ~0.35m radius wheels
      const leftSpeed = this.robotSpeed - this.turnRate * 0.55;
      const rightSpeed = this.robotSpeed + this.turnRate * 0.55;

      this.wheelAngleLeft += (leftSpeed * deltaSec / wheelCircumference) * Math.PI * 2 * 3.5;
      this.wheelAngleRight += (rightSpeed * deltaSec / wheelCircumference) * Math.PI * 2 * 3.5;

      const { frontLeft, rearLeft, frontRight, rearRight } = this.robotRefs.wheels;
      frontLeft.rotation.x = this.wheelAngleLeft;
      rearLeft.rotation.x = this.wheelAngleLeft;
      frontRight.rotation.x = this.wheelAngleRight;
      rearRight.rotation.x = this.wheelAngleRight;
    }

    // Synchronize 3D Robot Model Transform
    this.syncRobotTransform();

    // Animate Spray mist if active
    if (this.sprayActive) {
      this.animateSprayMist(deltaSec);
    }

    return { safetyStop, blocked };
  }

  public syncRobotTransform() {
    this.robotRefs.rootGroup.position.set(this.robotX, 0, this.robotZ);
    // Orient model so its front faces along the heading direction
    this.robotRefs.rootGroup.rotation.y = -this.robotHeading + Math.PI;
    this.robotRefs.chassisGroup.rotation.set(0, 0, 0);
  }

  private animateSprayMist(delta: number) {
    const pos = this.sprayPositions;
    const vel = this.sprayVelocities;
    const count = pos.length / 3;
    const nozzleWorldPos = this.getNozzleWorldPosition(this.activeNozzleNum);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] += vel[i * 3 + 0] * delta;
      pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
      pos[i * 3 + 2] += vel[i * 3 + 2] * delta;

      if (pos[i * 3 + 1] < 0.15 || pos[i * 3 + 1] > 2.5) {
        // Reset particle from selected nozzle
        pos[i * 3 + 0] = nozzleWorldPos.x;
        pos[i * 3 + 1] = nozzleWorldPos.y;
        pos[i * 3 + 2] = nozzleWorldPos.z;

        const toTarget = this.sprayTargetPos.clone().sub(nozzleWorldPos).normalize();
        vel[i * 3 + 0] = toTarget.x * 2.8 + (Math.random() - 0.5) * 0.35;
        vel[i * 3 + 1] = toTarget.y * 2.8 + (Math.random() - 0.5) * 0.35;
        vel[i * 3 + 2] = toTarget.z * 2.8 + (Math.random() - 0.5) * 0.35;
      }
    }
    this.sprayParticles.geometry.attributes.position.needsUpdate = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Inspection & Target Plant Acquisition (AI Vision Model)
  // ───────────────────────────────────────────────────────────────────────────
  public getDetectedPlantInFront(): FarmPlant | null {
    // Rover orientation axes: Heading 0 = North along -Z
    const fwdX = Math.sin(this.robotHeading);
    const fwdZ = -Math.cos(this.robotHeading);
    const rightX = Math.cos(this.robotHeading);
    const rightZ = Math.sin(this.robotHeading);

    let bestPlant: FarmPlant | null = null;
    let highestScore = -Infinity;

    for (const plant of this.plants) {
      const dx = plant.position.x - this.robotX;
      const dz = plant.position.z - this.robotZ;
      const totalDist = Math.hypot(dx, dz);

      // Max visual inspection envelope (3.4 meters)
      if (totalDist > 3.4) continue;

      // Project into rover's coordinate frame
      // fwdDist covers alongside the rover body (-1.0m) to forward horizon (+2.8m)
      const fwdDist = dx * fwdX + dz * fwdZ;
      // latDist covers adjacent furrow canopies on left and right beds (~1.5m, up to 2.5m)
      const latDist = Math.abs(dx * rightX + dz * rightZ);

      if (fwdDist < -1.0 || fwdDist > 2.8 || latDist > 2.5) continue;

      // Prioritize diseased and warning crops for AI intervention
      let basePriority = 100;
      if (plant.state === 'DISEASED') {
        basePriority = 600;
      } else if (plant.state === 'WARNING') {
        basePriority = 350;
      } else if (plant.state === 'TREATED') {
        basePriority = 60;
      }

      // Proximity score: closest plant along forward inspection focus
      const score = basePriority - totalDist * 30 - latDist * 15;

      if (score > highestScore) {
        highestScore = score;
        bestPlant = plant;
      }
    }

    return bestPlant;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Camera Perspectives & Follow Management (Preserves User Orbit & Zoom)
  // ───────────────────────────────────────────────────────────────────────────
  public setCameraMode(mode: SimCameraMode) {
    this.cameraMode = mode;

    if (mode === 'OVERHEAD') {
      this.followRobot = true;
      this.controls.enabled = true;
      this.camera.position.set(this.robotX, 30.0, this.robotZ + 0.05);
      this.controls.target.set(this.robotX, 0, this.robotZ);
      this.controls.update();
    } else if (mode === 'ISOMETRIC') {
      this.followRobot = true;
      this.controls.enabled = true;
      this.camera.position.set(this.robotX + 9.5, 7.5, this.robotZ + 9.5);
      this.controls.target.set(this.robotX, 0.9, this.robotZ);
      this.controls.update();
    } else if (mode === 'CHASE') {
      this.followRobot = true;
      this.controls.enabled = true;
      this.resetCameraView();
    } else if (mode === 'FREE') {
      this.followRobot = false;
      this.controls.enabled = true;
    } else if (mode === 'FOLLOW') {
      this.followRobot = true;
      this.controls.enabled = true;
    }
  }

  public resetCameraView() {
    // 3rd-person elevated perspective looking down the crop row
    const backDist = 6.8;
    const height = 3.8;
    const fwdX = Math.sin(this.robotHeading);
    const fwdZ = -Math.cos(this.robotHeading);

    this.camera.position.set(
      this.robotX - fwdX * backDist,
      height,
      this.robotZ - fwdZ * backDist
    );
    this.controls.target.set(this.robotX, 1.0, this.robotZ + fwdZ * 2.0);
    this.controls.update();
  }

  // Bind external thumbnail canvas for the "Robot Camera View"
  public setBumperCanvas(canvas: HTMLCanvasElement | null) {
    this.bumperCanvas = canvas;
    if (canvas && !this.bumperRenderer) {
      this.bumperRenderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'low-power',
      });
      this.bumperRenderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 180);
      this.bumperRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Animation & Render Loop
  // ───────────────────────────────────────────────────────────────────────────
  private animate() {
    if (this.isDestroyed) return;

    this.animFrameId = requestAnimationFrame(this.animate);

    // Follow robot translation without overriding user orbit angle or zoom!
    const deltaX = this.robotX - this.prevRobotX;
    const deltaZ = this.robotZ - this.prevRobotZ;
    this.prevRobotX = this.robotX;
    this.prevRobotZ = this.robotZ;

    if (this.followRobot && (Math.abs(deltaX) > 0.0001 || Math.abs(deltaZ) > 0.0001)) {
      this.camera.position.x += deltaX;
      this.camera.position.z += deltaZ;
      this.controls.target.x += deltaX;
      this.controls.target.z += deltaZ;
    }

    // Animate 3D AI Target Reticle rotation & hover if active
    if (this.targetReticleGroup && this.targetReticleGroup.visible) {
      this.reticleRingMesh.rotation.z += 0.015;
      this.reticleBrackets.rotation.y -= 0.012;
      const hoverY = 1.05 + Math.sin(performance.now() * 0.004) * 0.04;
      this.targetReticleGroup.position.y = hoverY;
    }

    // Animate fluid flow inside active treatment pipes
    const now = performance.now();
    const animDelta = Math.min(0.05, (now - (this.lastAnimTime || now)) / 1000);
    this.lastAnimTime = now;
    if (this.robotRefs?.plumbing) {
      this.robotRefs.plumbing.updateFlowAnimation(animDelta);
    }

    this.controls.update();

    // 1. Render Main Simulation Viewport
    this.renderer.render(this.scene, this.camera);

    // 2. Render Secondary Robot Bumper Camera Viewport (Live FPV Feed)
    if (this.bumperRenderer && this.bumperCanvas) {
      this.bumperRenderer.render(this.scene, this.bumperCamera);
    }
  }

  public resize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    if (this.bumperRenderer && this.bumperCanvas) {
      this.bumperRenderer.setSize(this.bumperCanvas.clientWidth, this.bumperCanvas.clientHeight);
    }
  }

  public getAllPlants(): FarmPlant[] {
    return this.plants;
  }

  public resetRobotPosition() {
    this.resetFieldState();
  }

  public resetField() {
    this.resetFieldState();
  }

  public resetFieldState() {
    this.robotX = 0.0;
    this.robotZ = 2.0;
    this.robotHeading = 0.0;
    this.robotSpeed = 0.0;
    this.targetSpeed = 0.0;
    this.turnRate = 0.0;
    this.targetTurnRate = 0.0;
    this.syncRobotTransform();
    this.resetCameraView();
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.controls.dispose();
    this.renderer.dispose();
    if (this.bumperRenderer) this.bumperRenderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
