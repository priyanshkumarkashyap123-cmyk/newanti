/**
 * CanvasManager.ts — Core scene management and spatial grid for structural modeling
 * 
 * Responsibilities:
 * - Three.js scene initialization and lifecycle
 * - Spatial grid for snap-to-grid positioning
 * - Raycasting with high precision for line/point selection
 * - InstancedMesh management for efficient rendering
 * - JSON topology export
 */

import * as THREE from 'three';
import type { Node, Member } from '../store/modelTypes';

interface GridConfig {
  size: number; // Grid cell size (m)
  divisions: number; // Number of divisions in visible grid
  snapEnabled: boolean;
}

interface SpatialGrid {
  [key: string]: Set<string>; // gridKey -> Set<nodeIds>
}

export interface StructuralTopology {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
  }>;
  elements: Array<{
    id: string;
    startNodeId: string;
    endNodeId: string;
    type?: 'beam' | 'column' | 'brace';
  }>;
}

export class CanvasManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster: THREE.Raycaster;
  private gridConfig: GridConfig;
  private spatialGrid: SpatialGrid = {};
  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private nodeGeometries: Map<string, THREE.BufferGeometry> = new Map();
  private memberGeometries: Map<string, THREE.BufferGeometry> = new Map();
  private gridHelper: THREE.GridHelper | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 500, 1000);

    // Camera: Isometric-like perspective
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    this.camera.position.set(30, 25, 30);
    this.camera.lookAt(0, 0, 0);

    // Renderer with high precision (Float64 for structural calcs)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      precision: 'highp', // Use highp for Float64-equivalent precision
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Lighting
    this.setupLighting();

    // Raycaster with optimized precision for structural elements
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.15; // Line selection precision (m)
    this.raycaster.params.Points.threshold = 0.2; // Point selection precision (m)

    // Grid configuration
    this.gridConfig = {
      size: 1.0, // 1m cells
      divisions: 50,
      snapEnabled: true,
    };

    this.initializeGrid();
  }

  /**
   * Setup lighting for professional visualization
   */
  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Secondary light for fill
    const fillLight = new THREE.PointLight(0xccccff, 0.3);
    fillLight.position.set(-50, 30, -50);
    this.scene.add(fillLight);
  }

  /**
   * Initialize grid helper and spatial indexing
   */
  private initializeGrid(): void {
    this.gridHelper = new THREE.GridHelper(
      this.gridConfig.size * this.gridConfig.divisions,
      this.gridConfig.divisions,
      0x444444,
      0x222222
    );
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);
  }

  /**
   * Compute grid cell key for spatial indexing
   * Enables fast lookup of nearby nodes for snapping and clustering
   */
  private getGridKey(x: number, y: number, z: number): string {
    const size = this.gridConfig.size;
    const xi = Math.round(x / size);
    const yi = Math.round(y / size);
    const zi = Math.round(z / size);
    return `${xi},${yi},${zi}`;
  }

  /**
   * Register node in spatial grid for fast lookup
   */
  addNodeToGrid(node: Node): void {
    const key = this.getGridKey(node.x, node.y, node.z);
    if (!this.spatialGrid[key]) {
      this.spatialGrid[key] = new Set();
    }
    this.spatialGrid[key].add(node.id);
  }

  /**
   * Remove node from spatial grid
   */
  removeNodeFromGrid(node: Node): void {
    const key = this.getGridKey(node.x, node.y, node.z);
    this.spatialGrid[key]?.delete(node.id);
    if (this.spatialGrid[key]?.size === 0) {
      delete this.spatialGrid[key];
    }
  }

  /**
   * Find nodes near a position for snapping (within grid cell + adjacent cells)
   */
  findNearbyNodes(x: number, y: number, z: number, radius: number = 0.5): string[] {
    const nearbyNodes = new Set<string>();
    const size = this.gridConfig.size;

    // Check current cell and 26 adjacent cells (3x3x3 cube)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const xi = Math.round(x / size) + dx;
          const yi = Math.round(y / size) + dy;
          const zi = Math.round(z / size) + dz;
          const key = `${xi},${yi},${zi}`;
          const nodes = this.spatialGrid[key];
          if (nodes) {
            nodes.forEach(nodeId => nearbyNodes.add(nodeId));
          }
        }
      }
    }

    return Array.from(nearbyNodes);
  }

  /**
   * Snap coordinates to grid if enabled
   */
  snapToGrid(x: number, y: number, z: number): [number, number, number] {
    if (!this.gridConfig.snapEnabled) {
      return [x, y, z];
    }
    const size = this.gridConfig.size;
    return [
      Math.round(x / size) * size,
      Math.round(y / size) * size,
      Math.round(z / size) * size,
    ];
  }

  /**
   * Raycast to find intersected objects at given screen coordinates
   * Optimized for structural elements (beams, columns, nodes)
   */
  rayCastAt(
    x: number,
    y: number,
    nodesMesh: THREE.Points,
    membersMesh: THREE.LineSegments
  ): {
    nodes: Array<{ object: THREE.Object3D; distance: number }>;
    members: Array<{ object: THREE.Object3D; distance: number }>;
  } {
    // Normalize screen coordinates (-1 to 1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const normalizedX = ((x - rect.left) / rect.width) * 2 - 1;
    const normalizedY = -((y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(
      new THREE.Vector2(normalizedX, normalizedY),
      this.camera
    );

    const nodeIntersects = this.raycaster.intersectObject(nodesMesh, false);
    const memberIntersects = this.raycaster.intersectObject(membersMesh, false);

    return {
      nodes: nodeIntersects.map(ixn => ({
        object: ixn.object,
        distance: ixn.distance,
      })),
      members: memberIntersects.map(ixn => ({
        object: ixn.object,
        distance: ixn.distance,
      })),
    };
  }

  /**
   * Create InstancedMesh for rendering multiple identical structural members
   * Allows rendering 100s of columns/beams at 60 FPS
   */
  createInstancedMemberMesh(
    memberType: 'column' | 'beam' | 'brace',
    count: number
  ): THREE.InstancedMesh {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    // Standard structural section geometries
    switch (memberType) {
      case 'column':
        // 300x300mm square column
        geometry = new THREE.BoxGeometry(0.3, 4.0, 0.3);
        material = new THREE.MeshStandardMaterial({
          color: 0x4488ff,
          metalness: 0.6,
          roughness: 0.4,
        });
        break;
      case 'beam':
        // 300x500mm beam
        geometry = new THREE.BoxGeometry(0.3, 0.5, 10.0);
        material = new THREE.MeshStandardMaterial({
          color: 0xff8844,
          metalness: 0.6,
          roughness: 0.4,
        });
        break;
      case 'brace':
        // Diagonal brace
        geometry = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8);
        material = new THREE.MeshStandardMaterial({
          color: 0x44ff44,
          metalness: 0.5,
          roughness: 0.5,
        });
        break;
    }

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    this.instancedMeshes.set(memberType, instancedMesh);
    this.scene.add(instancedMesh);

    return instancedMesh;
  }

  /**
   * Update instance matrix for InstancedMesh
   * Call after updating member positions
   */
  updateInstanceMatrix(
    memberType: 'column' | 'beam' | 'brace',
    instanceIndex: number,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3
  ): void {
    const mesh = this.instancedMeshes.get(memberType);
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(instanceIndex, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Export structural topology as strict JSON
   */
  exportTopology(nodes: Map<string, Node>, members: Map<string, Member>): StructuralTopology {
    const topology: StructuralTopology = {
      nodes: Array.from(nodes.values()).map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z,
      })),
      elements: Array.from(members.values()).map(member => ({
        id: member.id,
        startNodeId: member.startNodeId,
        endNodeId: member.endNodeId,
      })),
    };
    return topology;
  }

  /**
   * Export topology as JSON string (for transmission to backend)
   */
  exportTopologyJSON(nodes: Map<string, Node>, members: Map<string, Member>): string {
    const topology = this.exportTopology(nodes, members);
    return JSON.stringify(topology, null, 2);
  }

  /**
   * Render scene
   */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  onWindowResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Update grid visibility
   */
  setGridVisible(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  /**
   * Change grid cell size
   */
  setGridSize(size: number): void {
    this.gridConfig.size = size;
  }

  /**
   * Get scene reference (for adding/removing objects)
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get camera reference
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get renderer reference
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.renderer.dispose();
    this.gridHelper = null;
    this.instancedMeshes.clear();
  }
}
