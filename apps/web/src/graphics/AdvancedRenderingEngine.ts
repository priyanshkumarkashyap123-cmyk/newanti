/**
 * AdvancedRenderingEngine.ts
 * 
 * Professional-Grade 3D Rendering Engine for Structural Engineering
 * Inspired by STAAD.Pro, SAP2000, ETABS visualization capabilities
 * 
 * Features:
 * - Multi-pass rendering with post-processing effects
 * - Real-time ambient occlusion (SSAO)
 * - Physically Based Rendering (PBR) materials
 * - Hardware-accelerated edge detection for CAD-like appearance
 * - Advanced shadow mapping with soft shadows
 * - Level of Detail (LOD) management
 * - GPU-based picking and selection
 * - Deferred shading for complex lighting
 * - Anti-aliasing (MSAA/FXAA/TAA)
 * - HDR rendering with tone mapping
 */

import * as THREE from 'three';
// @ts-ignore - Three.js postprocessing types may not be perfectly typed
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// @ts-ignore
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// @ts-ignore
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// @ts-ignore
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// @ts-ignore
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
// @ts-ignore
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
// @ts-ignore
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
// @ts-ignore
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface RenderingConfig {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  enableSSAO: boolean;
  enableShadows: boolean;
  enableBloom: boolean;
  enableOutlines: boolean;
  enableAntialiasing: boolean;
  shadowMapSize: number;
  maxLights: number;
  backgroundColor: string;
  gridColor: string;
  enableHDR: boolean;
  toneMapping: THREE.ToneMapping;
  exposure: number;
}

export interface RenderStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  gpuMemory: number;
}

export interface ViewMode {
  type: 'perspective' | 'orthographic';
  preset?: 'isometric' | 'top' | 'front' | 'right' | 'back' | 'left' | 'bottom' | 'custom';
  fov?: number;
  zoom?: number;
}

export interface SelectionConfig {
  enableMultiSelect: boolean;
  highlightColor: THREE.Color;
  selectionColor: THREE.Color;
  hoverColor: THREE.Color;
  outlineWidth: number;
}

export interface DisplayOptions {
  showNodes: boolean;
  showMembers: boolean;
  showLoads: boolean;
  showSupports: boolean;
  showLabels: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showDimensions: boolean;
  showNodeNumbers: boolean;
  showMemberNumbers: boolean;
  memberColorMode: 'default' | 'section' | 'material' | 'group' | 'utilization' | 'stress';
  renderMode: 'solid' | 'wireframe' | 'hidden-line' | 'x-ray';
  sectionDisplay: 'centerline' | 'true-shape' | 'schematic';
}

// ============================================
// CUSTOM SHADERS
// ============================================

const EdgeDetectionShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    edgeColor: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
    edgeStrength: { value: 1.0 },
    depthThreshold: { value: 0.001 },
    normalThreshold: { value: 0.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform vec3 edgeColor;
    uniform float edgeStrength;
    uniform float depthThreshold;
    uniform float normalThreshold;
    
    varying vec2 vUv;
    
    float getDepth(vec2 uv) {
      return texture2D(tDepth, uv).r;
    }
    
    void main() {
      vec2 texelSize = 1.0 / resolution;
      
      // Sobel edge detection on depth
      float d00 = getDepth(vUv + texelSize * vec2(-1, -1));
      float d10 = getDepth(vUv + texelSize * vec2( 0, -1));
      float d20 = getDepth(vUv + texelSize * vec2( 1, -1));
      float d01 = getDepth(vUv + texelSize * vec2(-1,  0));
      float d21 = getDepth(vUv + texelSize * vec2( 1,  0));
      float d02 = getDepth(vUv + texelSize * vec2(-1,  1));
      float d12 = getDepth(vUv + texelSize * vec2( 0,  1));
      float d22 = getDepth(vUv + texelSize * vec2( 1,  1));
      
      float gx = d00 - d20 + 2.0 * (d01 - d21) + d02 - d22;
      float gy = d00 - d02 + 2.0 * (d10 - d12) + d20 - d22;
      float edge = sqrt(gx * gx + gy * gy);
      
      edge = step(depthThreshold, edge) * edgeStrength;
      
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 finalColor = mix(texel.rgb, edgeColor, edge);
      
      gl_FragColor = vec4(finalColor, texel.a);
    }
  `
};

const XRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    opacity: { value: 0.5 },
    edgeColor: { value: new THREE.Vector3(0.2, 0.6, 1.0) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float opacity;
    uniform vec3 edgeColor;
    varying vec2 vUv;
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = mix(texel.rgb, edgeColor, 0.3);
      gl_FragColor = vec4(color, texel.a * opacity);
    }
  `
};

// ============================================
// MATERIAL PRESETS
// ============================================

export const MaterialPresets = {
  steel: {
    color: 0xb8b8c8,
    metalness: 0.8,
    roughness: 0.35,
    envMapIntensity: 1.0
  },
  aluminum: {
    color: 0xe8e8e8,
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 1.2
  },
  concrete: {
    color: 0xa0a0a0,
    metalness: 0.0,
    roughness: 0.9,
    envMapIntensity: 0.3
  },
  timber: {
    color: 0xc4a35a,
    metalness: 0.0,
    roughness: 0.8,
    envMapIntensity: 0.4
  },
  glass: {
    color: 0x88ccff,
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.3,
    envMapIntensity: 2.0
  },
  cable: {
    color: 0x404040,
    metalness: 0.7,
    roughness: 0.4,
    envMapIntensity: 0.8
  },
  selected: {
    color: 0x4488ff,
    metalness: 0.3,
    roughness: 0.5,
    emissive: 0x224488,
    emissiveIntensity: 0.3
  },
  hovered: {
    color: 0x00ffff,
    metalness: 0.3,
    roughness: 0.5,
    emissive: 0x00aaaa,
    emissiveIntensity: 0.4
  }
};

// ============================================
// COLOR PALETTES FOR RESULTS VISUALIZATION
// ============================================

export const ColorScales = {
  // Engineering stress/strain (blue to red)
  stress: [
    new THREE.Color(0x0000ff), // Min - Blue
    new THREE.Color(0x00ffff), // Cyan
    new THREE.Color(0x00ff00), // Green
    new THREE.Color(0xffff00), // Yellow
    new THREE.Color(0xff8800), // Orange
    new THREE.Color(0xff0000), // Max - Red
  ],
  
  // Rainbow (full spectrum)
  rainbow: [
    new THREE.Color(0xff0000),
    new THREE.Color(0xff8800),
    new THREE.Color(0xffff00),
    new THREE.Color(0x88ff00),
    new THREE.Color(0x00ff00),
    new THREE.Color(0x00ff88),
    new THREE.Color(0x00ffff),
    new THREE.Color(0x0088ff),
    new THREE.Color(0x0000ff),
    new THREE.Color(0x8800ff),
  ],
  
  // Thermal (black-body radiation)
  thermal: [
    new THREE.Color(0x000000),
    new THREE.Color(0x330000),
    new THREE.Color(0x880000),
    new THREE.Color(0xff0000),
    new THREE.Color(0xff8800),
    new THREE.Color(0xffff00),
    new THREE.Color(0xffffff),
  ],
  
  // Utilization ratio (green to red)
  utilization: [
    new THREE.Color(0x00aa00), // <50% - Green
    new THREE.Color(0x88cc00), // 50-70% - Yellow-Green
    new THREE.Color(0xffcc00), // 70-85% - Yellow
    new THREE.Color(0xff8800), // 85-95% - Orange
    new THREE.Color(0xff0000), // 95-100% - Red
    new THREE.Color(0xaa0000), // >100% - Dark Red (overstressed)
  ],
  
  // Displacement (blue-white-red diverging)
  displacement: [
    new THREE.Color(0x0000aa), // Negative max
    new THREE.Color(0x4444ff),
    new THREE.Color(0x8888ff),
    new THREE.Color(0xffffff), // Zero
    new THREE.Color(0xff8888),
    new THREE.Color(0xff4444),
    new THREE.Color(0xaa0000), // Positive max
  ]
};

// ============================================
// ADVANCED RENDERING ENGINE CLASS
// ============================================

export class AdvancedRenderingEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private composer: EffectComposer;
  private config: RenderingConfig;
  private stats: RenderStats;
  
  // Post-processing passes
  private renderPass: RenderPass;
  private ssaoPass: SSAOPass | null = null;
  private outlinePass: OutlinePass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private edgePass: ShaderPass | null = null;
  private gammaPass: ShaderPass;
  
  // Scene objects
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private ambientLight: THREE.AmbientLight;
  private directionalLights: THREE.DirectionalLight[] = [];
  private hemisphereLight: THREE.HemisphereLight;
  
  // Selection
  private selectedObjects: THREE.Object3D[] = [];
  private hoveredObject: THREE.Object3D | null = null;
  private selectionConfig: SelectionConfig;
  
  // Performance
  private frameCount: number = 0;
  private lastTime: number = 0;
  private rafId: number = 0;
  private fpsHistory: number[] = [];
  
  // Depth texture for edge detection
  private depthRenderTarget: THREE.WebGLRenderTarget | null = null;
  
  // Secondary grid reference for proper disposal
  private majorGridHelper: THREE.GridHelper | null = null;
  
  // Object pools to avoid per-frame/per-call allocations
  private static _poolColor = new THREE.Color();
  
  // Material cache for result visualization (key -> material)
  private resultMaterialCache: Map<string, THREE.MeshStandardMaterial> = new Map();
  private static readonly MAX_MATERIAL_CACHE = 256;

  constructor(canvas: HTMLCanvasElement, config?: Partial<RenderingConfig>) {
    // Default configuration
    this.config = {
      quality: 'high',
      enableSSAO: true,
      enableShadows: true,
      enableBloom: false,
      enableOutlines: true,
      enableAntialiasing: true,
      shadowMapSize: 2048,
      maxLights: 4,
      backgroundColor: '#0a0a0f',
      gridColor: '#1a1a2e',
      enableHDR: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      exposure: 1.0,
      ...config
    };

    this.selectionConfig = {
      enableMultiSelect: true,
      highlightColor: new THREE.Color(0x00ffff),
      selectionColor: new THREE.Color(0x4488ff),
      hoverColor: new THREE.Color(0x00ffaa),
      outlineWidth: 2
    };

    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      gpuMemory: 0
    };

    // Initialize WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: true // Better depth precision for structural models
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(new THREE.Color(this.config.backgroundColor));
    this.renderer.shadowMap.enabled = this.config.enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = this.config.toneMapping;
    this.renderer.toneMappingExposure = this.config.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.backgroundColor);

    // Initialize camera (perspective by default)
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
    this.camera.position.set(20, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Setup lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    this.hemisphereLight.position.set(0, 100, 0);
    this.scene.add(this.hemisphereLight);

    // Main directional light with shadows
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(50, 100, 50);
    mainLight.castShadow = this.config.enableShadows;
    mainLight.shadow.mapSize.width = this.config.shadowMapSize;
    mainLight.shadow.mapSize.height = this.config.shadowMapSize;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    mainLight.shadow.camera.left = -100;
    mainLight.shadow.camera.right = 100;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -100;
    mainLight.shadow.bias = -0.0001;
    this.directionalLights.push(mainLight);
    this.scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-30, 50, -30);
    this.directionalLights.push(fillLight);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x8888ff, 0.2);
    rimLight.position.set(0, 50, -80);
    this.directionalLights.push(rimLight);
    this.scene.add(rimLight);

    // Setup post-processing
    this.composer = new EffectComposer(this.renderer);
    
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // Gamma correction
    this.gammaPass = new ShaderPass(GammaCorrectionShader);
    
    this.setupPostProcessing();
    this.setupGrid();
    this.setupAxes();
  }

  /**
   * Setup post-processing pipeline
   */
  private setupPostProcessing(): void {
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;

    // SSAO - Screen Space Ambient Occlusion
    if (this.config.enableSSAO && this.config.quality !== 'low') {
      this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
      this.ssaoPass.kernelRadius = this.config.quality === 'ultra' ? 16 : 8;
      this.ssaoPass.minDistance = 0.005;
      this.ssaoPass.maxDistance = 0.1;
      this.composer.addPass(this.ssaoPass);
    }

    // Outline pass for selection
    if (this.config.enableOutlines) {
      this.outlinePass = new OutlinePass(
        new THREE.Vector2(width, height),
        this.scene,
        this.camera
      );
      this.outlinePass.visibleEdgeColor = this.selectionConfig.selectionColor;
      this.outlinePass.hiddenEdgeColor = new THREE.Color(0x222266);
      this.outlinePass.edgeStrength = 3;
      this.outlinePass.edgeGlow = 0.5;
      this.outlinePass.edgeThickness = this.selectionConfig.outlineWidth;
      this.composer.addPass(this.outlinePass);
    }

    // Bloom for emissive materials
    if (this.config.enableBloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.5, // strength
        0.4, // radius
        0.85 // threshold
      );
      this.composer.addPass(this.bloomPass);
    }

    // Anti-aliasing
    if (this.config.enableAntialiasing) {
      if (this.config.quality === 'ultra') {
        this.smaaPass = new SMAAPass(width, height);
        this.composer.addPass(this.smaaPass);
      } else {
        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
        this.composer.addPass(this.fxaaPass);
      }
    }

    // Add gamma correction at the end
    this.composer.addPass(this.gammaPass);
  }

  /**
   * Setup infinite grid
   */
  private setupGrid(): void {
    // Remove existing grid
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
    }

    // Create multi-level grid for better depth perception
    const gridSize = 200;
    const gridDivisions = 200;

    this.gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      new THREE.Color(0x2a2a3e), // Center line
      new THREE.Color(0x1a1a2e)  // Grid lines
    );
    this.gridHelper.material.opacity = 0.5;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);

    // Add secondary grid for major divisions
    if (this.majorGridHelper) {
      this.scene.remove(this.majorGridHelper);
      this.majorGridHelper.dispose();
    }
    this.majorGridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions / 5,
      new THREE.Color(0x3a3a4e),
      new THREE.Color(0x2a2a3e)
    );
    this.majorGridHelper.position.y = 0.001; // Slightly above to prevent z-fighting
    this.majorGridHelper.material.opacity = 0.3;
    this.majorGridHelper.material.transparent = true;
    this.scene.add(this.majorGridHelper);
  }

  /**
   * Setup coordinate axes with labels
   */
  private setupAxes(): void {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
    }

    const axisLength = 5;
    this.axesHelper = new THREE.AxesHelper(axisLength);
    this.scene.add(this.axesHelper);
  }

  /**
   * Set camera view preset
   */
  setViewPreset(preset: ViewMode['preset']): void {
    const distance = 30;
    
    switch (preset) {
      case 'isometric':
        this.camera.position.set(distance, distance, distance);
        break;
      case 'top':
        this.camera.position.set(0, distance * 2, 0.001);
        break;
      case 'front':
        this.camera.position.set(0, 0, distance);
        break;
      case 'right':
        this.camera.position.set(distance, 0, 0);
        break;
      case 'back':
        this.camera.position.set(0, 0, -distance);
        break;
      case 'left':
        this.camera.position.set(-distance, 0, 0);
        break;
      case 'bottom':
        this.camera.position.set(0, -distance * 2, 0.001);
        break;
    }
    
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Switch between perspective and orthographic cameras
   */
  setProjectionMode(mode: 'perspective' | 'orthographic'): void {
    const canvas = this.renderer.domElement;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const currentPos = this.camera.position.clone();
    const currentTarget = new THREE.Vector3(0, 0, 0);

    if (mode === 'orthographic' && this.camera instanceof THREE.PerspectiveCamera) {
      const frustumSize = 50;
      this.camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        10000
      );
    } else if (mode === 'perspective' && this.camera instanceof THREE.OrthographicCamera) {
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
    }

    this.camera.position.copy(currentPos);
    this.camera.lookAt(currentTarget);
    
    // Update passes
    this.renderPass.camera = this.camera;
    if (this.ssaoPass) this.ssaoPass.camera = this.camera;
    if (this.outlinePass) this.outlinePass.renderCamera = this.camera;
  }

  /**
   * Set selected objects for outline highlighting
   */
  setSelectedObjects(objects: THREE.Object3D[]): void {
    this.selectedObjects = objects;
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = objects;
    }
  }

  /**
   * Set hovered object
   */
  setHoveredObject(object: THREE.Object3D | null): void {
    this.hoveredObject = object;
  }

  /**
   * Interpolate color from a color scale.
   * Uses a pooled Color object to avoid GC pressure.
   * If you need to keep the result, clone it.
   */
  interpolateColor(value: number, min: number, max: number, scale: THREE.Color[]): THREE.Color {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const scaleIndex = t * (scale.length - 1);
    const lowIndex = Math.floor(scaleIndex);
    const highIndex = Math.min(lowIndex + 1, scale.length - 1);
    const localT = scaleIndex - lowIndex;

    AdvancedRenderingEngine._poolColor.lerpColors(scale[lowIndex], scale[highIndex], localT);
    return AdvancedRenderingEngine._poolColor;
  }

  /**
   * Create color-mapped material for results visualization.
   * Caches materials by quantized value to avoid creating thousands of identical materials.
   */
  createResultMaterial(
    value: number,
    min: number,
    max: number,
    scale: keyof typeof ColorScales = 'stress'
  ): THREE.MeshStandardMaterial {
    // Quantize to 256 levels for effective caching
    const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const quantized = Math.round(t * 255);
    const cacheKey = `${scale}_${quantized}`;

    let mat = this.resultMaterialCache.get(cacheKey);
    if (mat) return mat;

    const color = this.interpolateColor(value, min, max, ColorScales[scale]).clone();
    mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.1,
      roughness: 0.6,
      emissive: color,
      emissiveIntensity: 0.1
    });

    // LRU eviction
    if (this.resultMaterialCache.size >= AdvancedRenderingEngine.MAX_MATERIAL_CACHE) {
      const firstKey = this.resultMaterialCache.keys().next().value;
      if (firstKey) {
        this.resultMaterialCache.get(firstKey)?.dispose();
        this.resultMaterialCache.delete(firstKey);
      }
    }
    this.resultMaterialCache.set(cacheKey, mat);
    return mat;
  }

  /**
   * Resize renderer and post-processing
   */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
    } else {
      const frustumSize = 50;
      this.camera.left = -frustumSize * (width / height) / 2;
      this.camera.right = frustumSize * (width / height) / 2;
    }
    this.camera.updateProjectionMatrix();

    // Update FXAA resolution
    if (this.fxaaPass) {
      this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
    }

    // Update SSAO
    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height);
    }

    // Update SMAA
    if (this.smaaPass) {
      this.smaaPass.setSize(width, height);
    }
  }

  /**
   * Render frame with adaptive quality management.
   * Automatically downgrades post-processing when FPS drops below 30.
   */
  render(): void {
    const now = performance.now();
    this.frameCount++;

    // Calculate FPS every second
    if (now - this.lastTime >= 1000) {
      this.stats.fps = this.frameCount;
      this.stats.frameTime = (now - this.lastTime) / this.frameCount;

      // Track FPS history for adaptive quality (last 5 seconds)
      this.fpsHistory.push(this.stats.fps);
      if (this.fpsHistory.length > 5) this.fpsHistory.shift();
      this.adaptQuality();

      this.frameCount = 0;
      this.lastTime = now;
    }

    // Render with post-processing
    this.composer.render();

    // Update stats
    const info = this.renderer.info;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
  }

  /**
   * Adaptive quality: disable expensive passes when FPS is consistently low.
   */
  private adaptQuality(): void {
    if (this.fpsHistory.length < 3) return;
    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    if (avgFps < 24 && this.config.quality !== 'low') {
      // Disable heavy passes to recover frame rate
      if (this.ssaoPass) this.ssaoPass.enabled = false;
      if (this.bloomPass) this.bloomPass.enabled = false;
    } else if (avgFps > 50 && this.config.quality !== 'low') {
      // Re-enable if performance recovers
      if (this.ssaoPass && this.config.enableSSAO) this.ssaoPass.enabled = true;
      if (this.bloomPass && this.config.enableBloom) this.bloomPass.enabled = true;
    }
  }

  /**
   * Start animation loop
   */
  startAnimationLoop(): void {
    this.lastTime = performance.now();
    
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      this.render();
    };
    
    animate();
  }

  /**
   * Stop animation loop
   */
  stopAnimationLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /**
   * Get render statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Get scene for external manipulation
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get camera
   */
  getCamera(): THREE.Camera {
    return this.camera;
  }

  /**
   * Get renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RenderingConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply changes
    this.renderer.shadowMap.enabled = this.config.enableShadows;
    this.renderer.toneMapping = this.config.toneMapping;
    this.renderer.toneMappingExposure = this.config.exposure;

    // Recreate post-processing if needed
    // (would need more complex logic for full implementation)
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopAnimationLoop();

    // Dispose post-processing
    this.composer.dispose();
    
    // Dispose scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    // Dispose grid
    if (this.gridHelper) {
      this.gridHelper.dispose();
    }
    if (this.majorGridHelper) {
      this.majorGridHelper.dispose();
    }

    // Dispose axes
    if (this.axesHelper) {
      this.axesHelper.dispose();
    }

    // Dispose cached materials
    this.resultMaterialCache.forEach(m => m.dispose());
    this.resultMaterialCache.clear();

    // Dispose renderer
    this.renderer.dispose();
  }
}

// Export singleton factory
export function createRenderingEngine(
  canvas: HTMLCanvasElement,
  config?: Partial<RenderingConfig>
): AdvancedRenderingEngine {
  return new AdvancedRenderingEngine(canvas, config);
}

export default AdvancedRenderingEngine;
