/**
 * XRVisualization.ts
 * 
 * Extended Reality (XR) visualization for structural models:
 * 1. WebXR-based VR mode
 * 2. AR model overlay
 * 3. Immersive structural inspection
 * 4. Collaborative XR sessions
 * 5. Hand tracking for model manipulation
 * 6. Spatial annotations
 */

import * as THREE from 'three';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface XRSessionConfig {
  mode: 'immersive-vr' | 'immersive-ar' | 'inline';
  referenceSpaceType: 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';
  features?: string[];
  optionalFeatures?: string[];
}

export interface XRControllerState {
  connected: boolean;
  handedness: 'left' | 'right' | 'none';
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  buttons: {
    trigger: boolean;
    grip: boolean;
    thumbstick: { x: number; y: number };
    a: boolean;
    b: boolean;
  };
  hand?: XRHand;
}

export interface SpatialAnnotation {
  id: string;
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  content: string;
  type: 'note' | 'measurement' | 'warning' | 'photo';
  author?: string;
  timestamp: number;
  attachedTo?: string; // Element ID
}

export interface MeasurementResult {
  type: 'distance' | 'angle' | 'area' | 'volume';
  value: number;
  unit: string;
  points: THREE.Vector3[];
  displayString: string;
}

// ============================================
// XR SESSION MANAGER
// ============================================

export class XRSessionManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private xrSession: XRSession | null = null;
  private xrReferenceSpace: XRReferenceSpace | null = null;
  private controllers: Map<number, XRControllerState> = new Map();
  private controllerModels: Map<number, THREE.Object3D> = new Map();
  private annotations: Map<string, SpatialAnnotation> = new Map();
  private isPresenting = false;
  
  // Event callbacks
  public onSessionStart?: () => void;
  public onSessionEnd?: () => void;
  public onControllerUpdate?: (controllers: XRControllerState[]) => void;
  public onSelect?: (controller: XRControllerState, intersection?: THREE.Intersection) => void;
  public onSqueeze?: (controller: XRControllerState) => void;
  
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }
  
  /**
   * Check if WebXR is supported
   */
  async isXRSupported(mode: 'immersive-vr' | 'immersive-ar'): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.xr) return false;
    return navigator.xr.isSessionSupported(mode);
  }
  
  /**
   * Start an XR session
   */
  async startSession(config: XRSessionConfig): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.xr) {
      console.error('WebXR not supported');
      return false;
    }
    
    try {
      const sessionInit: XRSessionInit = {
        requiredFeatures: config.features ?? [],
        optionalFeatures: config.optionalFeatures ?? ['local-floor', 'hand-tracking'],
      };
      
      this.xrSession = await navigator.xr.requestSession(config.mode, sessionInit);
      
      // Set up session
      this.xrSession.addEventListener('end', this.onXRSessionEnd.bind(this));
      this.xrSession.addEventListener('select', this.onXRSelect.bind(this));
      this.xrSession.addEventListener('selectstart', this.onXRSelectStart.bind(this));
      this.xrSession.addEventListener('selectend', this.onXRSelectEnd.bind(this));
      this.xrSession.addEventListener('squeeze', this.onXRSqueeze.bind(this));
      this.xrSession.addEventListener('inputsourceschange', this.onInputSourcesChange.bind(this));
      
      // Set up reference space
      this.xrReferenceSpace = await this.xrSession.requestReferenceSpace(config.referenceSpaceType);
      
      // Configure renderer for XR
      await this.renderer.xr.setSession(this.xrSession);
      this.renderer.xr.enabled = true;
      
      this.isPresenting = true;
      this.setupControllers();
      
      this.onSessionStart?.();
      
      return true;
    } catch (error) {
      console.error('Failed to start XR session:', error);
      return false;
    }
  }
  
  /**
   * End the current XR session
   */
  async endSession(): Promise<void> {
    if (this.xrSession) {
      await this.xrSession.end();
    }
  }
  
  private onXRSessionEnd(): void {
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.isPresenting = false;
    this.renderer.xr.enabled = false;
    
    // Clean up controller models
    this.controllerModels.forEach(model => {
      this.scene.remove(model);
    });
    this.controllerModels.clear();
    this.controllers.clear();
    
    this.onSessionEnd?.();
  }
  
  private setupControllers(): void {
    // Set up controller models
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      
      // Create controller model
      const geometry = new THREE.CylinderGeometry(0.01, 0.02, 0.1, 8);
      const material = new THREE.MeshStandardMaterial({
        color: i === 0 ? 0x0066ff : 0xff6600,
        metalness: 0.5,
        roughness: 0.5,
      });
      const model = new THREE.Mesh(geometry, material);
      model.rotation.x = Math.PI / 2;
      
      grip.add(model);
      this.scene.add(grip);
      this.scene.add(controller);
      
      this.controllerModels.set(i, grip);
      
      // Create ray line for pointing
      const rayGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5),
      ]);
      const rayMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.5,
        transparent: true,
      });
      const ray = new THREE.Line(rayGeometry, rayMaterial);
      controller.add(ray);
    }
  }
  
  private onInputSourcesChange(event: XRInputSourcesChangeEvent): void {
    for (const source of event.added) {
      const index = source.handedness === 'left' ? 0 : 1;
      this.controllers.set(index, {
        connected: true,
        handedness: source.handedness,
        position: new THREE.Vector3(),
        rotation: new THREE.Quaternion(),
        buttons: {
          trigger: false,
          grip: false,
          thumbstick: { x: 0, y: 0 },
          a: false,
          b: false,
        },
        hand: source.hand,
      });
    }
    
    for (const source of event.removed) {
      const index = source.handedness === 'left' ? 0 : 1;
      this.controllers.delete(index);
    }
  }
  
  private onXRSelect(event: XRInputSourceEvent): void {
    const controllerIndex = event.inputSource.handedness === 'left' ? 0 : 1;
    const state = this.controllers.get(controllerIndex);
    
    if (state) {
      // Perform raycast
      const controller = this.renderer.xr.getController(controllerIndex);
      const intersection = this.raycast(controller);
      this.onSelect?.(state, intersection);
    }
  }
  
  private onXRSelectStart(event: XRInputSourceEvent): void {
    const index = event.inputSource.handedness === 'left' ? 0 : 1;
    const state = this.controllers.get(index);
    if (state) {
      state.buttons.trigger = true;
    }
  }
  
  private onXRSelectEnd(event: XRInputSourceEvent): void {
    const index = event.inputSource.handedness === 'left' ? 0 : 1;
    const state = this.controllers.get(index);
    if (state) {
      state.buttons.trigger = false;
    }
  }
  
  private onXRSqueeze(event: XRInputSourceEvent): void {
    const index = event.inputSource.handedness === 'left' ? 0 : 1;
    const state = this.controllers.get(index);
    if (state) {
      this.onSqueeze?.(state);
    }
  }
  
  /**
   * Update controller states
   */
  updateControllers(frame: XRFrame): void {
    if (!this.xrReferenceSpace) return;
    
    for (const [index, state] of this.controllers) {
      const controller = this.renderer.xr.getController(index);
      
      state.position.copy(controller.position);
      state.rotation.copy(controller.quaternion);
    }
    
    this.onControllerUpdate?.(Array.from(this.controllers.values()));
  }
  
  /**
   * Raycast from controller
   */
  private raycast(controller: THREE.Group): THREE.Intersection | undefined {
    const raycaster = new THREE.Raycaster();
    
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyMatrix4(tempMatrix);
    
    raycaster.set(controller.position, direction);
    
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    return intersects.length > 0 ? intersects[0] : undefined;
  }
  
  /**
   * Add a spatial annotation
   */
  addAnnotation(annotation: Omit<SpatialAnnotation, 'id' | 'timestamp'>): SpatialAnnotation {
    const fullAnnotation: SpatialAnnotation = {
      ...annotation,
      id: `annotation-${Date.now()}`,
      timestamp: Date.now(),
    };
    
    this.annotations.set(fullAnnotation.id, fullAnnotation);
    this.renderAnnotation(fullAnnotation);
    
    return fullAnnotation;
  }
  
  private renderAnnotation(annotation: SpatialAnnotation): void {
    // Create annotation visual
    const group = new THREE.Group();
    group.name = `annotation-${annotation.id}`;
    
    // Marker sphere
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: annotation.type === 'warning' ? 0xff0000 : 0x00ff00,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    group.add(marker);
    
    // Label sprite (would need canvas texture in real implementation)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText(annotation.content.substring(0, 20), 10, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.y = 0.15;
    sprite.scale.set(0.5, 0.125, 1);
    group.add(sprite);
    
    group.position.copy(annotation.position);
    this.scene.add(group);
  }
  
  /**
   * Get all annotations
   */
  getAnnotations(): SpatialAnnotation[] {
    return Array.from(this.annotations.values());
  }
  
  /**
   * Remove an annotation and dispose its GPU resources
   */
  removeAnnotation(id: string): void {
    this.annotations.delete(id);
    
    const object = this.scene.getObjectByName(`annotation-${id}`);
    if (object) {
      this.scene.remove(object);
      object.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          child.geometry?.dispose();
          if (child.material) {
            const mat = child.material as THREE.Material;
            if ('map' in mat && (mat as any).map) (mat as any).map.dispose();
            mat.dispose();
          }
        }
      });
    }
  }
  
  /**
   * Check if currently in XR session
   */
  get isInXR(): boolean {
    return this.isPresenting;
  }
}

// ============================================
// MEASUREMENT TOOL
// ============================================

export class XRMeasurementTool {
  private points: THREE.Vector3[] = [];
  private lines: THREE.Line[] = [];
  private labels: THREE.Sprite[] = [];
  private scene: THREE.Scene;
  private measurementMode: 'distance' | 'angle' | 'area' = 'distance';
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  /**
   * Set measurement mode
   */
  setMode(mode: 'distance' | 'angle' | 'area'): void {
    this.measurementMode = mode;
    this.clearMeasurement();
  }
  
  /**
   * Add a measurement point
   */
  addPoint(point: THREE.Vector3): MeasurementResult | null {
    this.points.push(point.clone());
    this.renderPoint(point);
    
    switch (this.measurementMode) {
      case 'distance':
        if (this.points.length >= 2) {
          return this.measureDistance();
        }
        break;
      case 'angle':
        if (this.points.length >= 3) {
          return this.measureAngle();
        }
        break;
      case 'area':
        if (this.points.length >= 3) {
          return this.measureArea();
        }
        break;
    }
    
    return null;
  }
  
  private renderPoint(point: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.02, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point);
    this.scene.add(sphere);
    
    // Draw line to previous point
    if (this.points.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        this.points[this.points.length - 2],
        this.points[this.points.length - 1],
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.lines.push(line);
      this.scene.add(line);
    }
  }
  
  private measureDistance(): MeasurementResult {
    const p1 = this.points[this.points.length - 2];
    const p2 = this.points[this.points.length - 1];
    const distance = p1.distanceTo(p2);
    
    // Create label
    this.createLabel(`${distance.toFixed(3)} m`, p1.clone().lerp(p2, 0.5));
    
    return {
      type: 'distance',
      value: distance,
      unit: 'm',
      points: [p1.clone(), p2.clone()],
      displayString: `${distance.toFixed(3)} m`,
    };
  }
  
  private measureAngle(): MeasurementResult {
    const p1 = this.points[this.points.length - 3];
    const p2 = this.points[this.points.length - 2];
    const p3 = this.points[this.points.length - 1];
    
    const v1 = p1.clone().sub(p2).normalize();
    const v2 = p3.clone().sub(p2).normalize();
    
    const angle = Math.acos(v1.dot(v2)) * (180 / Math.PI);
    
    this.createLabel(`${angle.toFixed(1)}°`, p2);
    
    return {
      type: 'angle',
      value: angle,
      unit: '°',
      points: [p1.clone(), p2.clone(), p3.clone()],
      displayString: `${angle.toFixed(1)}°`,
    };
  }
  
  private measureArea(): MeasurementResult {
    // Calculate area using shoelace formula for polygon
    let area = 0;
    const n = this.points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += this.points[i].x * this.points[j].y;
      area -= this.points[j].x * this.points[i].y;
    }
    
    area = Math.abs(area) / 2;
    
    // Find centroid for label
    const centroid = new THREE.Vector3();
    this.points.forEach(p => centroid.add(p));
    centroid.divideScalar(n);
    
    this.createLabel(`${area.toFixed(2)} m²`, centroid);
    
    return {
      type: 'area',
      value: area,
      unit: 'm²',
      points: this.points.map(p => p.clone()),
      displayString: `${area.toFixed(2)} m²`,
    };
  }
  
  private createLabel(text: string, position: THREE.Vector3): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.position.y += 0.1;
    sprite.scale.set(0.4, 0.1, 1);
    
    this.labels.push(sprite);
    this.scene.add(sprite);
  }
  
  /**
   * Clear current measurement and dispose GPU resources
   */
  clearMeasurement(): void {
    this.points = [];
    
    this.lines.forEach(line => {
      this.scene.remove(line);
      line.geometry?.dispose();
      if (line.material) {
        if (Array.isArray(line.material)) {
          line.material.forEach(m => m.dispose());
        } else {
          (line.material as THREE.Material).dispose();
        }
      }
    });
    this.lines = [];
    
    this.labels.forEach(label => {
      this.scene.remove(label);
      if (label instanceof THREE.Sprite) {
        if (label.material.map) label.material.map.dispose();
        label.material.dispose();
      }
    });
    this.labels = [];
  }
}

// ============================================
// MODEL MANIPULATOR
// ============================================

export class XRModelManipulator {
  private scene: THREE.Scene;
  private selectedObject: THREE.Object3D | null = null;
  private manipulationMode: 'translate' | 'rotate' | 'scale' = 'translate';
  private initialControllerPosition: THREE.Vector3 | null = null;
  private initialObjectPosition: THREE.Vector3 | null = null;
  private initialObjectRotation: THREE.Quaternion | null = null;
  private initialObjectScale: THREE.Vector3 | null = null;
  
  // Two-handed manipulation
  private leftControllerPosition: THREE.Vector3 | null = null;
  private rightControllerPosition: THREE.Vector3 | null = null;
  private initialControllerDistance: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  /**
   * Select an object for manipulation
   */
  select(object: THREE.Object3D | null): void {
    // Deselect previous
    if (this.selectedObject) {
      this.setHighlight(this.selectedObject, false);
    }
    
    this.selectedObject = object;
    
    if (object) {
      this.setHighlight(object, true);
    }
  }
  
  private setHighlight(object: THREE.Object3D, highlight: boolean): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (highlight) {
          material.emissive.setHex(0x333333);
        } else {
          material.emissive.setHex(0x000000);
        }
      }
    });
  }
  
  /**
   * Set manipulation mode
   */
  setMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.manipulationMode = mode;
  }
  
  /**
   * Start manipulation
   */
  startManipulation(controllerPosition: THREE.Vector3, handedness: 'left' | 'right'): void {
    if (!this.selectedObject) return;
    
    if (handedness === 'left') {
      this.leftControllerPosition = controllerPosition.clone();
    } else {
      this.rightControllerPosition = controllerPosition.clone();
    }
    
    // Single-handed manipulation
    if (!this.initialControllerPosition) {
      this.initialControllerPosition = controllerPosition.clone();
      this.initialObjectPosition = this.selectedObject.position.clone();
      this.initialObjectRotation = this.selectedObject.quaternion.clone();
      this.initialObjectScale = this.selectedObject.scale.clone();
    }
    
    // Two-handed scaling
    if (this.leftControllerPosition && this.rightControllerPosition) {
      this.initialControllerDistance = this.leftControllerPosition.distanceTo(this.rightControllerPosition);
    }
  }
  
  /**
   * Update manipulation
   */
  updateManipulation(controllerPosition: THREE.Vector3, controllerRotation: THREE.Quaternion): void {
    if (!this.selectedObject || !this.initialControllerPosition) return;
    
    switch (this.manipulationMode) {
      case 'translate':
        this.updateTranslation(controllerPosition);
        break;
      case 'rotate':
        this.updateRotation(controllerRotation);
        break;
      case 'scale':
        this.updateScale(controllerPosition);
        break;
    }
  }
  
  private updateTranslation(controllerPosition: THREE.Vector3): void {
    if (!this.selectedObject || !this.initialControllerPosition || !this.initialObjectPosition) return;
    
    const delta = controllerPosition.clone().sub(this.initialControllerPosition);
    this.selectedObject.position.copy(this.initialObjectPosition.clone().add(delta));
  }
  
  private updateRotation(controllerRotation: THREE.Quaternion): void {
    if (!this.selectedObject || !this.initialObjectRotation) return;
    
    this.selectedObject.quaternion.copy(controllerRotation);
  }
  
  private updateScale(controllerPosition: THREE.Vector3): void {
    if (!this.selectedObject || !this.initialObjectScale || this.initialControllerDistance === 0) return;
    
    // Two-handed scaling
    if (this.leftControllerPosition && this.rightControllerPosition) {
      const currentDistance = this.leftControllerPosition.distanceTo(this.rightControllerPosition);
      const scaleFactor = currentDistance / this.initialControllerDistance;
      
      this.selectedObject.scale.copy(this.initialObjectScale.clone().multiplyScalar(scaleFactor));
    }
  }
  
  /**
   * End manipulation
   */
  endManipulation(): void {
    this.initialControllerPosition = null;
    this.initialObjectPosition = null;
    this.initialObjectRotation = null;
    this.initialObjectScale = null;
    this.leftControllerPosition = null;
    this.rightControllerPosition = null;
    this.initialControllerDistance = 0;
  }
  
  /**
   * Get current selection
   */
  getSelection(): THREE.Object3D | null {
    return this.selectedObject;
  }
}

// ============================================
// AR PLANE DETECTION
// ============================================

export class ARPlaneManager {
  private scene: THREE.Scene;
  private planes: Map<number, THREE.Mesh> = new Map();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  /**
   * Update planes from XR frame
   */
  updatePlanes(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    // This would use the WebXR planes feature when available
    // For now, this is a placeholder for the API structure
    
    // Example of how it would work with WebXR Planes:
    // const detectedPlanes = frame.detectedPlanes;
    // for (const plane of detectedPlanes) {
    //   const pose = frame.getPose(plane.planeSpace, referenceSpace);
    //   if (pose) {
    //     this.updateOrCreatePlane(plane, pose);
    //   }
    // }
  }
  
  private updateOrCreatePlane(planeId: number, vertices: Float32Array, pose: XRPose): void {
    let mesh = this.planes.get(planeId);
    
    if (!mesh) {
      // Create new plane mesh
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      mesh = new THREE.Mesh(geometry, material);
      this.planes.set(planeId, mesh);
      this.scene.add(mesh);
    }
    
    // Update geometry
    const positions = new Float32Array(vertices.length);
    positions.set(vertices);
    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Update transform
    mesh.position.set(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z
    );
    mesh.quaternion.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w
    );
  }
  
  /**
   * Remove a plane
   */
  removePlane(planeId: number): void {
    const mesh = this.planes.get(planeId);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.planes.delete(planeId);
    }
  }
  
  /**
   * Clear all planes
   */
  clearPlanes(): void {
    this.planes.forEach((mesh, id) => this.removePlane(id));
  }
  
  /**
   * Get all detected planes
   */
  getPlanes(): THREE.Mesh[] {
    return Array.from(this.planes.values());
  }
}

// ============================================
// XR STRUCTURAL VIEWER
// ============================================

export class XRStructuralViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sessionManager: XRSessionManager;
  private measurementTool: XRMeasurementTool;
  private manipulator: XRModelManipulator;
  private arPlanes: ARPlaneManager;
  
  private structureGroup: THREE.Group;
  private currentMode: 'view' | 'measure' | 'annotate' | 'manipulate' = 'view';
  
  constructor(container: HTMLElement) {
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 3);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);
    
    // Initialize XR components
    this.sessionManager = new XRSessionManager(this.renderer, this.scene, this.camera);
    this.measurementTool = new XRMeasurementTool(this.scene);
    this.manipulator = new XRModelManipulator(this.scene);
    this.arPlanes = new ARPlaneManager(this.scene);
    
    // Structure group
    this.structureGroup = new THREE.Group();
    this.structureGroup.name = 'structure';
    this.scene.add(this.structureGroup);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Start render loop
    this.renderer.setAnimationLoop(this.render.bind(this));
  }
  
  private setupEventHandlers(): void {
    this.sessionManager.onSelect = (controller, intersection) => {
      switch (this.currentMode) {
        case 'measure':
          if (intersection) {
            const result = this.measurementTool.addPoint(intersection.point);
            if (result) {
              // Measurement result available via result.displayString
            }
          }
          break;
        case 'annotate':
          if (intersection) {
            this.sessionManager.addAnnotation({
              position: intersection.point,
              content: 'New annotation',
              type: 'note',
            });
          }
          break;
        case 'manipulate':
          if (intersection) {
            this.manipulator.select(intersection.object);
          }
          break;
      }
    };
    
    this.sessionManager.onSqueeze = (controller) => {
      if (this.currentMode === 'manipulate' && controller.handedness !== 'none') {
        this.manipulator.startManipulation(controller.position, controller.handedness);
      }
    };
    
    this.sessionManager.onControllerUpdate = (controllers) => {
      if (this.currentMode === 'manipulate') {
        const active = controllers.find(c => c.buttons.grip);
        if (active) {
          this.manipulator.updateManipulation(active.position, active.rotation);
        }
      }
    };
  }
  
  /**
   * Load a structural model
   */
  loadModel(model: {
    nodes: Array<{ x: number; y: number; z: number }>;
    members: Array<{ start: number; end: number; section?: string }>;
  }): void {
    // Clear existing
    this.structureGroup.clear();
    
    // Create node spheres
    const nodeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    
    const nodePositions: THREE.Vector3[] = [];
    
    for (const node of model.nodes) {
      const sphere = new THREE.Mesh(nodeGeometry, nodeMaterial);
      sphere.position.set(node.x, node.z, node.y); // Convert Y-up to Z-up
      this.structureGroup.add(sphere);
      nodePositions.push(sphere.position.clone());
    }
    
    // Create member cylinders
    for (const member of model.members) {
      const start = nodePositions[member.start];
      const end = nodePositions[member.end];
      
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      
      const memberGeometry = new THREE.CylinderGeometry(0.02, 0.02, length, 8);
      const memberMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
      const cylinder = new THREE.Mesh(memberGeometry, memberMaterial);
      
      // Position at midpoint
      cylinder.position.copy(start).lerp(end, 0.5);
      
      // Orient along member direction
      const axis = new THREE.Vector3(0, 1, 0);
      cylinder.quaternion.setFromUnitVectors(axis, direction.normalize());
      
      this.structureGroup.add(cylinder);
    }
    
    // Center and scale model
    const box = new THREE.Box3().setFromObject(this.structureGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim; // Fit to 2m
    
    this.structureGroup.scale.setScalar(scale);
    this.structureGroup.position.sub(center.multiplyScalar(scale));
    this.structureGroup.position.y = 1.0; // Raise to eye level
  }
  
  /**
   * Set interaction mode
   */
  setMode(mode: 'view' | 'measure' | 'annotate' | 'manipulate'): void {
    this.currentMode = mode;
    
    if (mode === 'measure') {
      this.measurementTool.clearMeasurement();
    }
    if (mode !== 'manipulate') {
      this.manipulator.select(null);
    }
  }
  
  /**
   * Enter VR mode
   */
  async enterVR(): Promise<boolean> {
    const supported = await this.sessionManager.isXRSupported('immersive-vr');
    if (!supported) return false;
    
    return this.sessionManager.startSession({
      mode: 'immersive-vr',
      referenceSpaceType: 'local-floor',
      optionalFeatures: ['hand-tracking'],
    });
  }
  
  /**
   * Enter AR mode
   */
  async enterAR(): Promise<boolean> {
    const supported = await this.sessionManager.isXRSupported('immersive-ar');
    if (!supported) return false;
    
    // Make background transparent for AR
    this.scene.background = null;
    
    return this.sessionManager.startSession({
      mode: 'immersive-ar',
      referenceSpaceType: 'local-floor',
      features: ['hit-test', 'plane-detection'],
    });
  }
  
  /**
   * Exit XR mode
   */
  async exitXR(): Promise<void> {
    await this.sessionManager.endSession();
    this.scene.background = new THREE.Color(0x1a1a1a);
  }
  
  private render(time: number, frame?: XRFrame): void {
    if (frame && this.sessionManager.isInXR) {
      this.sessionManager.updateControllers(frame);
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Dispose all resources properly
   */
  dispose(): void {
    this.renderer.setAnimationLoop(null);
    
    // Dispose all scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Line) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else if (object.material) {
          (object.material as THREE.Material).dispose();
        }
      } else if (object instanceof THREE.Sprite) {
        if (object.material.map) object.material.map.dispose();
        object.material.dispose();
      }
    });
    
    this.renderer.dispose();
  }
}

// Export
export default {
  XRSessionManager,
  XRMeasurementTool,
  XRModelManipulator,
  ARPlaneManager,
  XRStructuralViewer,
};
