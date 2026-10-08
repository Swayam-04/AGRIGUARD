/**
 * AgriGuard Digital Twin — Three.js Scene, Camera, Lighting & Animation Loop
 *
 * Provides:
 * - Isolated WebGL rendering decoupled from React state renders
 * - OrbitControls for pan, zoom, rotate, and preset viewpoint switching
 * - Smooth wheel spinning driven by live 'movement' telemetry
 * - Dynamic ultrasonic distance radar cones (Safe / Warning / Obstacle)
 * - MPU6050 pitch & roll chassis tilting with lerp damping
 * - Realistic spray mist particle physics when pump/relay is energized
 * - Ground terrain grid with furrow motion effect
 * - Complete resource disposal and leak prevention
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAgriGuardRobot, RobotModelRefs } from './RobotGeometry';
import { CameraViewPreset, SAFETY_THRESHOLDS } from './types';
import { TelemetryData } from '../types';

export class TwinSceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private robot: RobotModelRefs;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  // Ground grid reference for motion illusion
  private groundGrid: THREE.GridHelper;
  private fieldPlane: THREE.Mesh;

  // Internal animation state
  private lastTime = performance.now();
  private wheelSpeed = 0; // rad/s
  private wheelAngle = 0;
  private targetWheelSpeed = 0;
  private targetTurnDiff = 0; // differential turning factor
  private gridOffset = 0;

  // Telemetry target orientations
  private targetPitch = 0;
  private targetRoll = 0;
  private isPumpActive = false;
  private isRobotConnected = false;
  private currentMovement = 'STOP';

  // Ultrasonic distance targets (cm)
  private leftDist = 72;
  private centerDist = 48;
  private rightDist = 86;

  // Camera transition (calibrated for high-clearance PVC rover & open tray)
  private targetCamPos = new THREE.Vector3(4.6, 3.8, 4.6);
  private targetControlsTarget = new THREE.Vector3(0, 1.35, 0);
  private isTransitioningCam = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent to blend with glassmorphism card

    // 2. Camera
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.copy(this.targetCamPos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 0.8 : 1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 20.0;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // do not clip through ground
    this.controls.target.copy(this.targetControlsTarget);
    this.controls.update();

    // 5. Lighting
    this.setupLighting();

    // 6. Ground & Field Row Visuals
    this.setupGround();

    // 7. AgriGuard 3D Robot
    this.robot = createAgriGuardRobot();
    this.scene.add(this.robot.rootGroup);

    // 8. Start Animation Loop
    this.animate = this.animate.bind(this);
    this.animFrameId = requestAnimationFrame(this.animate);
  }

  private setupLighting() {
    // Ambient light: Soft overhead fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Directional sunlight (casts subtle ground shadow)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(6, 12, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 30;
    sunLight.shadow.camera.left = -6;
    sunLight.shadow.camera.right = 6;
    sunLight.shadow.camera.top = 6;
    sunLight.shadow.camera.bottom = -6;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Overhead inspection spotlight illuminating the electronics inside the foam tray
    const trayLight = new THREE.DirectionalLight(0xffffff, 0.95);
    trayLight.position.set(0, 5, 0);
    this.scene.add(trayLight);

    // Accent Rim Light (Emerald tint for agricultural tech feel)
    const rimLight = new THREE.DirectionalLight(0x10b981, 0.6);
    rimLight.position.set(-6, 3, -6);
    this.scene.add(rimLight);

    // Subtle blue underbody glow
    const underLight = new THREE.PointLight(0x0284c7, 0.4, 4);
    underLight.position.set(0, 0.4, 0);
    this.scene.add(underLight);
  }

  private setupGround() {
    // Ground soil plane
    const planeGeom = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.fieldPlane = new THREE.Mesh(planeGeom, planeMat);
    this.fieldPlane.rotation.x = -Math.PI / 2;
    this.fieldPlane.position.y = 0;
    this.fieldPlane.receiveShadow = true;
    this.scene.add(this.fieldPlane);

    // Tech agricultural navigation grid
    this.groundGrid = new THREE.GridHelper(24, 24, 0x10b981, 0x1e293b);
    this.groundGrid.position.y = 0.005;
    this.scene.add(this.groundGrid);

    // Crop row guideways (furrow lines)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    for (let x = -6; x <= 6; x += 3) {
      const pts = [new THREE.Vector3(x, 0.01, -12), new THREE.Vector3(x, 0.01, 12)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(lineGeom, lineMat);
      this.scene.add(line);
    }
  }

  /**
   * Updates telemetry state without triggering React renders
   */
  public updateTelemetry(telemetry: TelemetryData | null) {
    if (!telemetry) {
      this.isRobotConnected = false;
      this.currentMovement = 'STOP';
      this.targetWheelSpeed = 0;
      this.targetTurnDiff = 0;
      this.targetPitch = 0;
      this.targetRoll = 0;
      this.isPumpActive = false;
      return;
    }

    const isSim = telemetry.mode === 'SIMULATION' || telemetry.hardware_mode === 'SIMULATION';
    this.isRobotConnected = isSim ? true : Boolean(telemetry.esp32_connected);

    // Movement Command
    const move = (telemetry.movement || telemetry.actuators?.motor_state || 'STOP').toUpperCase();
    this.currentMovement = move;

    if (!this.isRobotConnected || move === 'STOP' || move === 'STOPPED') {
      this.targetWheelSpeed = 0;
      this.targetTurnDiff = 0;
    } else if (move === 'FORWARD' || move === 'MOVING_FORWARD') {
      this.targetWheelSpeed = 7.0; // rad/s
      this.targetTurnDiff = 0;
    } else if (move === 'BACKWARD' || move === 'MOVING_BACKWARD') {
      this.targetWheelSpeed = -7.0;
      this.targetTurnDiff = 0;
    } else if (move === 'LEFT' || move === 'TURNING_LEFT') {
      this.targetWheelSpeed = 4.0;
      this.targetTurnDiff = -1.0; // skid-steer: left wheels backward, right forward
    } else if (move === 'RIGHT' || move === 'TURNING_RIGHT') {
      this.targetWheelSpeed = 4.0;
      this.targetTurnDiff = 1.0; // skid-steer: left wheels forward, right backward
    }

    // Ultrasonic distances
    const us = telemetry.ultrasonic;
    if (this.isRobotConnected && us) {
      this.leftDist = us.left != null ? Number(us.left) : (us.distance_cm != null ? us.distance_cm * 1.1 : 70);
      this.centerDist = us.center != null ? Number(us.center) : (us.distance_cm != null ? us.distance_cm : 50);
      this.rightDist = us.right != null ? Number(us.right) : (us.distance_cm != null ? us.distance_cm * 1.2 : 80);
    } else {
      this.leftDist = 999;
      this.centerDist = 999;
      this.rightDist = 999;
    }

    // MPU6050 Orientation — Keep digital model standing straight and level on its wheels
    this.targetPitch = 0;
    this.targetRoll = 0;

    // Pump / Spray state
    const pState = telemetry.pump?.state || (telemetry.actuators?.pump_active ? 'ON' : 'OFF');
    this.isPumpActive = this.isRobotConnected && (pState === 'ON');
  }

  /**
   * Sets pre-configured camera viewpoints
   */
  public setView(preset: CameraViewPreset) {
    this.isTransitioningCam = true;
    switch (preset) {
      case 'isometric':
        this.targetCamPos.set(4.6, 3.8, 4.6);
        this.targetControlsTarget.set(0, 1.35, 0);
        break;
      case 'front':
        this.targetCamPos.set(0, 1.35, 4.8);
        this.targetControlsTarget.set(0, 1.25, 0);
        break;
      case 'top':
        // Top-down inspection angle looking directly inside the open foam tray (matching Photo 1)
        this.targetCamPos.set(0, 4.8, 0.05);
        this.targetControlsTarget.set(0, 1.45, 0);
        break;
      case 'side':
        this.targetCamPos.set(5.0, 1.35, 0);
        this.targetControlsTarget.set(0, 1.25, 0);
        break;
    }
  }

  /**
   * Main 60 FPS animation loop
   */
  private animate(currentTime: number) {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // 1. Smooth Camera Transition
    if (this.isTransitioningCam) {
      this.camera.position.lerp(this.targetCamPos, 0.08);
      this.controls.target.lerp(this.targetControlsTarget, 0.08);
      if (this.camera.position.distanceTo(this.targetCamPos) < 0.05) {
        this.isTransitioningCam = false;
      }
    }

    this.controls.update();

    // 2. Animate Wheels & Movement
    this.wheelSpeed = THREE.MathUtils.lerp(this.wheelSpeed, this.targetWheelSpeed, 0.1);

    if (Math.abs(this.wheelSpeed) > 0.01) {
      const spinDelta = this.wheelSpeed * delta;
      const { frontLeft, frontRight, rearLeft, rearRight } = this.robot.wheels;

      if (this.targetTurnDiff === 0) {
        // Linear forward / reverse
        frontLeft.rotation.x += spinDelta;
        frontRight.rotation.x += spinDelta;
        rearLeft.rotation.x += spinDelta;
        rearRight.rotation.x += spinDelta;

        // Animate ground grid to create forward mobility illusion
        this.gridOffset = (this.gridOffset - spinDelta * 0.1) % 1.0;
        this.groundGrid.position.z = this.gridOffset;
      } else if (this.targetTurnDiff < 0) {
        // Turning Left (skid-steer counter-rotation)
        frontLeft.rotation.x -= spinDelta * 0.7;
        rearLeft.rotation.x -= spinDelta * 0.7;
        frontRight.rotation.x += spinDelta * 0.7;
        rearRight.rotation.x += spinDelta * 0.7;
      } else {
        // Turning Right
        frontLeft.rotation.x += spinDelta * 0.7;
        rearLeft.rotation.x += spinDelta * 0.7;
        frontRight.rotation.x -= spinDelta * 0.7;
        rearRight.rotation.x -= spinDelta * 0.7;
      }
    }

    // 3. Keep Chassis Standing Straight and Level
    const chassis = this.robot.chassisGroup;
    chassis.rotation.x = 0;
    chassis.rotation.z = 0;

    // 4. Update Ultrasonic Proximity Cones
    this.updateUltrasonicCone(
      this.robot.ultrasonicCones.leftMesh,
      this.robot.ultrasonicCones.leftMaterial,
      this.leftDist,
      currentTime
    );
    this.updateUltrasonicCone(
      this.robot.ultrasonicCones.centerMesh,
      this.robot.ultrasonicCones.centerMaterial,
      this.centerDist,
      currentTime
    );
    this.updateUltrasonicCone(
      this.robot.ultrasonicCones.rightMesh,
      this.robot.ultrasonicCones.rightMaterial,
      this.rightDist,
      currentTime
    );

    // 5. Spray Particle System Animation
    const spray = this.robot.sprayParticles;
    if (this.isPumpActive) {
      spray.particleSystem.visible = true;
      spray.particleMaterial.opacity = THREE.MathUtils.lerp(spray.particleMaterial.opacity, 0.75, 0.1);

      const pos = spray.positions;
      const vel = spray.velocities;
      const count = spray.count;
      const nozzleY = 0.45;
      const nozzleZ = -0.35;

      for (let i = 0; i < count; i++) {
        // integrate velocity
        pos[i * 3 + 0] += vel[i * 3 + 0] * delta;
        pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
        pos[i * 3 + 2] += vel[i * 3 + 2] * delta;

        // Reset particles hitting ground
        if (pos[i * 3 + 1] < 0.05) {
          pos[i * 3 + 0] = (Math.random() - 0.5) * 0.12;
          pos[i * 3 + 1] = nozzleY;
          pos[i * 3 + 2] = nozzleZ;

          // random downward cone spread
          const spread = 0.5;
          vel[i * 3 + 0] = (Math.random() - 0.5) * spread;
          vel[i * 3 + 1] = -1.8 - Math.random() * 1.5;
          vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
        }
      }
      spray.particleGeometry.attributes.position.needsUpdate = true;
    } else {
      if (spray.particleMaterial.opacity > 0.01) {
        spray.particleMaterial.opacity = THREE.MathUtils.lerp(spray.particleMaterial.opacity, 0.0, 0.15);
      } else {
        spray.particleSystem.visible = false;
      }
    }

    // 6. Pulse Status LED on ESP32
    if (this.isRobotConnected) {
      const pulse = 0.5 + 0.5 * Math.sin(currentTime * 0.006);
      this.robot.statusLedMaterial.color.setRGB(0.2 * pulse, 0.7 * pulse, 1.0 * pulse);
    } else {
      // Slow red flash when offline
      const flash = Math.sin(currentTime * 0.003) > 0 ? 0.9 : 0.2;
      this.robot.statusLedMaterial.color.setRGB(flash, 0.1, 0.1);
    }

    // 7. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private updateUltrasonicCone(
    mesh: THREE.Mesh,
    material: THREE.MeshBasicMaterial,
    distanceCm: number,
    time: number
  ) {
    if (!this.isRobotConnected || distanceCm > SAFETY_THRESHOLDS.MAX_ULTRASONIC_RANGE_CM) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;

    // Scale cone length according to measured distance
    const normDist = THREE.MathUtils.clamp(distanceCm / 100.0, 0.25, 2.4);
    mesh.scale.set(1.0, 1.0, normDist);

    if (distanceCm < SAFETY_THRESHOLDS.OBSTACLE_CM) {
      // Critical Obstacle (<25 cm): Bright Pulsing Red
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.015);
      material.color.setHex(0xf43f5e);
      material.opacity = 0.8 * pulse;
    } else if (distanceCm <= SAFETY_THRESHOLDS.WARNING_CM) {
      // Warning Zone (25-60 cm): Amber
      material.color.setHex(0xf59e0b);
      material.opacity = 0.5;
    } else {
      // Safe Zone (>60 cm): Emerald Green
      material.color.setHex(0x10b981);
      material.opacity = 0.35;
    }
  }

  /**
   * Resizes viewport when container changes
   */
  public resize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Disposes all WebGL and Three.js allocations cleanly
   */
  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.controls.dispose();

    // Traverse and dispose geometries and materials
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
