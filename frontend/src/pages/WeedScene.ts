import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAgriGuardRobot, RobotModelRefs } from '../digitalTwin/RobotGeometry';

export class WeedScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  private weeds: THREE.Mesh[] = [];
  private laserBeam: THREE.Mesh | null = null;
  private laserTargetIndicator: THREE.Mesh | null = null;
  
  private robotRefs: RobotModelRefs | null = null;
  private robotGroup: THREE.Group | null = null;
  private robotNozzle: THREE.Mesh | null = null;

  private particles: THREE.InstancedMesh | null = null;
  private particleCount = 60;
  
  private targetWeedIndex: number = -1;
  public onWeedsCountChange?: (count: number) => void;

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080d14');
    this.scene.fog = new THREE.FogExp2('#080d14', 0.02);

    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 5, 8); // Zoomed in much closer
    this.camera.lookAt(0, -1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = ''; // Clear any zombie canvases
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    this.setupEnvironment();
    this.spawnCrop();
    this.spawnWeeds(5);
    this.setupPhysicalRobot();
    this.setupParticles();

    window.addEventListener('resize', this.onWindowResize);
    this.animate = this.animate.bind(this);
    this.animate();
  }

  private setupEnvironment() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#2d1e16', roughness: 1.0, metalness: 0.0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    const grid = new THREE.GridHelper(80, 80, 0x10b981, 0x10b981);
    grid.position.y = 0.02;
    (grid.material as THREE.Material).opacity = 0.15;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    this.laserTargetIndicator = new THREE.Mesh(ringGeo, ringMat);
    this.laserTargetIndicator.rotation.x = -Math.PI / 2;
    this.laserTargetIndicator.position.y = 0.05;
    this.scene.add(this.laserTargetIndicator);

    const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 16);
    laserGeo.translate(0, -0.5, 0); 
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    this.laserBeam = new THREE.Mesh(laserGeo, laserMat);
    this.scene.add(this.laserBeam);
  }

  private setupPhysicalRobot() {
    this.robotRefs = createAgriGuardRobot();
    this.robotGroup = this.robotRefs.rootGroup;
    
    // Make Robot Huge (It straddles the crops)
    this.robotGroup.scale.set(1.8, 1.8, 1.8); 
    // Start robot much closer to the center crop
    this.robotGroup.position.set(-3, 0, -3);
    this.robotGroup.rotation.y = Math.PI / 4; 

    // Laser Nozzle mounted on the LOWER part (underbelly) of the robot
    // Positioned deep underneath the chassis, just above the plants
    const nozzleGeo = new THREE.CylinderGeometry(0.15, 0.05, 0.5, 16);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.9, roughness: 0.1 });
    this.robotNozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    
    // Position very low underneath the center
    this.robotNozzle.position.set(0, 1.5, 0);
    this.robotNozzle.castShadow = true;
    
    // Glowing lens at tip
    const lensGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffaaaa });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.y = -0.25;
    this.robotNozzle.add(lens);

    // Attach to robot so it moves with it
    this.robotGroup.add(this.robotNozzle);
    this.scene.add(this.robotGroup);

    // Hide the green ultrasonic radar cones from the physical model to avoid confusion
    if (this.robotRefs.ultrasonicCones) {
      this.robotRefs.ultrasonicCones.leftMesh.visible = false;
      this.robotRefs.ultrasonicCones.centerMesh.visible = false;
      this.robotRefs.ultrasonicCones.rightMesh.visible = false;
    }
  }

  private setupParticles() {
    const pGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    this.particles = new THREE.InstancedMesh(pGeo, pMat, this.particleCount);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particles);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.particleCount; i++) {
      dummy.position.set(0, -100, 0);
      dummy.updateMatrix();
      this.particles.setMatrixAt(i, dummy.matrix);
    }
    this.particles.instanceMatrix.needsUpdate = true;
  }

  private spawnCrop() {
    // Crop should be very tiny so robot effortlessly straddles it
    const cropGroup = new THREE.Group();
    
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 1, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.5;
    stem.castShadow = true;
    cropGroup.add(stem);

    const leafGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.6 });
    
    const createLeaf = (x: number, y: number, z: number, sX: number, sY: number, sZ: number) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(x, y, z);
      leaf.scale.set(sX, sY, sZ);
      leaf.castShadow = true;
      cropGroup.add(leaf);
    };

    createLeaf(0, 1.0, 0, 1, 0.4, 1);
    createLeaf(-0.4, 0.6, 0, 1.2, 0.2, 0.6);
    createLeaf(0.4, 0.6, 0, 1.2, 0.2, 0.6);
    createLeaf(0, 0.4, 0.4, 0.6, 0.2, 1.2);

    this.scene.add(cropGroup);
  }

  private spawnWeeds(count: number) {
    // Weeds should be incredibly tiny
    const weedGeo = new THREE.ConeGeometry(0.1, 0.3, 8);
    const weedMat = new THREE.MeshStandardMaterial({ color: '#84cc16', roughness: 0.7 });

    for (let i = 0; i < count; i++) {
      const weed = new THREE.Mesh(weedGeo, weedMat.clone());
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.5 + Math.random() * 0.8; 
      
      weed.position.set(Math.cos(angle) * distance, 0.15, Math.sin(angle) * distance);
      weed.rotation.x = (Math.random() - 0.5) * 0.3;
      weed.rotation.z = (Math.random() - 0.5) * 0.3;
      weed.castShadow = true;
      
      this.weeds.push(weed);
      this.scene.add(weed);
    }

    
    if (this.onWeedsCountChange) this.onWeedsCountChange(this.weeds.length);
  }

  public respawnWeeds() {
    this.spawnWeeds(5);
  }

  public getWeedCount() {
    return this.weeds.length;
  }

  public async executeEradicationSequence(): Promise<void> {
    if (this.weeds.length === 0 || this.isDestroyed || !this.robotGroup || !this.laserBeam || !this.laserTargetIndicator || !this.robotRefs) return;

    this.targetWeedIndex = this.weeds.length - 1;
    const targetWeed = this.weeds[this.targetWeedIndex];
    const targetPos = targetWeed.position.clone();

    // 1. Robot drives to straddle the weed!
    // Since the nozzle is perfectly centered under the robot, the robot just needs to drive its center directly over the weed.
    const robotStart = this.robotGroup.position.clone();
    const robotEnd = targetPos.clone();
    // Keep robot Y at 0
    robotEnd.y = 0;
    
    // Face the direction of travel
    const approachDir = robotEnd.clone().sub(robotStart).normalize();
    const targetAngle = Math.atan2(approachDir.x, approachDir.z);
    this.robotGroup.rotation.y = targetAngle;

    const driveSteps = 90;
    for (let i = 1; i <= driveSteps; i++) {
      if (this.isDestroyed) return;
      this.robotGroup.position.lerpVectors(robotStart, robotEnd, i / driveSteps);
      
      const spinDelta = 0.2;
      const w = this.robotRefs.wheels;
      w.frontLeft.rotation.x += spinDelta;
      w.frontRight.rotation.x += spinDelta;
      w.rearLeft.rotation.x += spinDelta;
      w.rearRight.rotation.x += spinDelta;
      
      await new Promise(r => setTimeout(r, 20));
    }

    // 2. Lock On (Yellow ring on weed)
    this.laserTargetIndicator.position.set(targetPos.x, 0.05, targetPos.z);
    (this.laserTargetIndicator.material as THREE.Material).opacity = 1;
    await new Promise(r => setTimeout(r, 400));
    
    // 3. Fire Laser
    const nozzleWorldPos = new THREE.Vector3();
    if(this.robotNozzle) {
        this.robotNozzle.getWorldPosition(nozzleWorldPos);
    }
    nozzleWorldPos.y -= 0.1; // Shoot from the tip of the nozzle

    this.laserBeam.position.copy(nozzleWorldPos);
    
    // Shoot straight down
    const distToWeed = nozzleWorldPos.y - targetPos.y;
    this.laserBeam.scale.set(1, distToWeed, 1);
    
    // Point laser straight down
    this.laserBeam.rotation.set(0,0,0);
    
    (this.laserBeam.material as THREE.Material).opacity = 0.9;
    
    const burnDuration = 1000;
    const startTime = performance.now();
    const dummy = new THREE.Object3D();
    
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < this.particleCount; i++) {
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.2 + 0.05, (Math.random() - 0.5) * 0.2));
      dummy.position.copy(targetPos);
      dummy.position.y += Math.random() * 0.3;
      dummy.updateMatrix();
      if(this.particles) this.particles.setMatrixAt(i, dummy.matrix);
    }
    if (this.particles) {
      (this.particles.material as THREE.Material).opacity = 1;
      this.particles.instanceMatrix.needsUpdate = true;
    }

    const burnInterval = setInterval(() => {
      if (this.isDestroyed) { clearInterval(burnInterval); return; }
      
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / burnDuration, 1);
      
      const r = Math.floor(132 * (1 - progress));
      const g = Math.floor(204 * (1 - progress));
      const b = Math.floor(22 * (1 - progress));
      (targetWeed.material as THREE.MeshStandardMaterial).color.setRGB(r/255, g/255, b/255);
      
      targetWeed.scale.setScalar(1 - (progress * 0.9)); 
      targetWeed.position.y = (1 - (progress * 0.9)) * 0.3; 
      
      if (this.particles) {
        for (let i = 0; i < this.particleCount; i++) {
          this.particles.getMatrixAt(i, dummy.matrix);
          dummy.position.setFromMatrixPosition(dummy.matrix);
          dummy.position.add(velocities[i]);
          dummy.scale.setScalar(1 - progress); 
          dummy.updateMatrix();
          this.particles.setMatrixAt(i, dummy.matrix);
        }
        this.particles.instanceMatrix.needsUpdate = true;
      }
      
      (this.laserBeam!.material as THREE.Material).opacity = 0.5 + Math.random() * 0.5;

      if (progress === 1) {
        clearInterval(burnInterval);
        
        this.scene.remove(targetWeed);
        this.weeds.pop();
        
        if (this.laserTargetIndicator) (this.laserTargetIndicator.material as THREE.Material).opacity = 0;
        if (this.laserBeam) (this.laserBeam.material as THREE.Material).opacity = 0;
        if (this.particles) (this.particles.material as THREE.Material).opacity = 0;
        
        if (this.onWeedsCountChange) this.onWeedsCountChange(this.weeds.length);
      }
    }, 30);
  }

  private onWindowResize = () => {
    if (!this.renderer || !this.camera) return;
    const parent = this.renderer.domElement.parentElement;
    if (parent) {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  };

  private animate() {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    
    if (this.laserTargetIndicator && (this.laserTargetIndicator.material as THREE.Material).opacity > 0) {
      this.laserTargetIndicator.rotation.z += 0.08;
    }

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize);
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    if (this.renderer && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
