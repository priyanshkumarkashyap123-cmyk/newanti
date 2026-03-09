/**
 * Cloud Rendering Infrastructure
 * 
 * Server-side rendering for complex 3D models:
 * - Progressive mesh streaming
 * - WebRTC-based frame streaming
 * - Server-side ray tracing
 * - LOD management
 * - Render farm integration
 * - CDN-backed asset delivery
 * 
 * Industry Parity: Autodesk Cloud Rendering, V-Ray Cloud, Chaos Cloud
 */

import { create } from 'zustand';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface RenderQuality {
  resolution: { width: number; height: number };
  antialiasing: 'none' | 'fxaa' | 'msaa_2x' | 'msaa_4x' | 'msaa_8x';
  shadows: 'none' | 'basic' | 'soft' | 'raytraced';
  reflections: 'none' | 'ssr' | 'raytraced';
  ambientOcclusion: 'none' | 'ssao' | 'hbao' | 'rtao';
  globalIllumination: 'none' | 'baked' | 'realtime' | 'pathtraced';
  maxFPS: number;
}

export interface RenderSession {
  id: string;
  projectId: string;
  userId: string;
  quality: RenderQuality;
  status: 'initializing' | 'connecting' | 'streaming' | 'paused' | 'error';
  serverRegion: string;
  latency: number;
  bandwidth: number;
  frameTime: number;
  startTime: number;
}

export interface RenderFrame {
  frameId: number;
  timestamp: number;
  data: ArrayBuffer;
  width: number;
  height: number;
  format: 'jpeg' | 'webp' | 'h264' | 'h265' | 'av1';
  quality: number;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export interface InputEvent {
  type: 'mouse' | 'keyboard' | 'touch' | 'gesture';
  action: string;
  data: unknown;
  timestamp: number;
}

export interface RenderStats {
  framesRendered: number;
  framesDropped: number;
  avgFrameTime: number;
  avgLatency: number;
  avgBandwidth: number;
  peakMemory: number;
  gpuUtilization: number;
}

// ============================================================================
// QUALITY PRESETS
// ============================================================================

export const QUALITY_PRESETS: Record<string, RenderQuality> = {
  performance: {
    resolution: { width: 1280, height: 720 },
    antialiasing: 'fxaa',
    shadows: 'basic',
    reflections: 'none',
    ambientOcclusion: 'ssao',
    globalIllumination: 'none',
    maxFPS: 60,
  },
  balanced: {
    resolution: { width: 1920, height: 1080 },
    antialiasing: 'msaa_2x',
    shadows: 'soft',
    reflections: 'ssr',
    ambientOcclusion: 'hbao',
    globalIllumination: 'baked',
    maxFPS: 60,
  },
  quality: {
    resolution: { width: 2560, height: 1440 },
    antialiasing: 'msaa_4x',
    shadows: 'raytraced',
    reflections: 'raytraced',
    ambientOcclusion: 'rtao',
    globalIllumination: 'realtime',
    maxFPS: 60,
  },
  cinematic: {
    resolution: { width: 3840, height: 2160 },
    antialiasing: 'msaa_8x',
    shadows: 'raytraced',
    reflections: 'raytraced',
    ambientOcclusion: 'rtao',
    globalIllumination: 'pathtraced',
    maxFPS: 30,
  },
};

// ============================================================================
// WEBRTC STREAMING CLIENT
// ============================================================================

export interface StreamingConfig {
  serverUrl: string;
  stunServers: string[];
  turnServers: Array<{
    urls: string;
    username: string;
    credential: string;
  }>;
  preferredCodec: 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1';
  maxBitrate: number;
  adaptiveBitrate: boolean;
}

export class CloudRenderingClient {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private config: StreamingConfig;
  private session: RenderSession | null = null;
  private inputQueue: InputEvent[] = [];
  private statsHistory: RenderStats[] = [];
  private onFrameCallback: ((frame: RenderFrame) => void) | null = null;
  private onStatsCallback: ((stats: RenderStats) => void) | null = null;

  constructor(config: StreamingConfig) {
    this.config = config;
  }

  /**
   * Initialize WebRTC connection to render server
   */
  async connect(
    projectId: string,
    quality: RenderQuality,
    token: string
  ): Promise<RenderSession> {
    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [
        ...this.config.stunServers.map(url => ({ urls: url })),
        ...this.config.turnServers,
      ],
    });

    // Create data channel for input events
    this.dataChannel = this.pc.createDataChannel('input', {
      ordered: true,
      maxRetransmits: 3,
    });

    this.dataChannel.onopen = () => {
      this.flushInputQueue();
    };

    this.dataChannel.onmessage = (event) => {
      this.handleServerMessage(event.data);
    };

    // Handle incoming video track
    this.pc.ontrack = (event) => {
      if (event.track.kind === 'video') {
        this.handleVideoTrack(event.streams[0]);
      }
    };

    // Create offer
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false,
    });
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await this.waitForIceGathering();

    // Send offer to signaling server
    const response = await fetch(`${this.config.serverUrl}/api/render/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        quality,
        offer: this.pc.localDescription,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to connect: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Set remote description
    await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));

    // Store session
    this.session = {
      id: data.sessionId,
      projectId,
      userId: data.userId,
      quality,
      status: 'connecting',
      serverRegion: data.region,
      latency: 0,
      bandwidth: 0,
      frameTime: 0,
      startTime: Date.now(),
    };

    // Start stats collection
    this.startStatsCollection();

    return this.session;
  }

  private async waitForIceGathering(): Promise<void> {
    if (!this.pc) return;

    return new Promise((resolve) => {
      if (this.pc!.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          this.pc!.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      this.pc!.addEventListener('icegatheringstatechange', checkState);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        this.pc!.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 5000);
    });
  }

  private handleVideoTrack(stream: MediaStream): void {
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
    }

    this.videoElement.srcObject = stream;
    
    if (this.session) {
      this.session.status = 'streaming';
    }
  }

  private handleServerMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'stats':
          if (this.onStatsCallback) {
            this.onStatsCallback(message.stats);
          }
          break;
        case 'frame_info':
          // Frame metadata from server
          break;
        case 'error':
          console.error('Server error:', message.error);
          break;
      }
    } catch {
      // Binary frame data
    }
  }

  private flushInputQueue(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    while (this.inputQueue.length > 0) {
      const event = this.inputQueue.shift();
      if (event) {
        this.dataChannel.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Send input event to render server
   */
  sendInput(event: InputEvent): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      // Queue for later
      this.inputQueue.push(event);
      if (this.inputQueue.length > 100) {
        this.inputQueue.shift(); // Drop old events
      }
    }
  }

  /**
   * Update camera state
   */
  updateCamera(camera: CameraState): void {
    this.sendInput({
      type: 'mouse',
      action: 'camera_update',
      data: camera,
      timestamp: Date.now(),
    });
  }

  /**
   * Update quality settings
   */
  async updateQuality(quality: RenderQuality): Promise<void> {
    if (!this.session) return;

    await fetch(`${this.config.serverUrl}/api/render/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.session.id,
        quality,
      }),
    });

    this.session.quality = quality;
  }

  /**
   * Get video element for display
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Set frame callback
   */
  onFrame(callback: (frame: RenderFrame) => void): void {
    this.onFrameCallback = callback;
  }

  /**
   * Set stats callback
   */
  onStats(callback: (stats: RenderStats) => void): void {
    this.onStatsCallback = callback;
  }

  private startStatsCollection(): void {
    setInterval(async () => {
      if (!this.pc || !this.session) return;

      const stats = await this.pc.getStats();
      const inboundRtp: RTCStatsReport | null = null;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const framesDecoded = (report as unknown as { framesDecoded: number }).framesDecoded || 0;
          const framesDropped = (report as unknown as { framesDropped: number }).framesDropped || 0;
          const bytesReceived = (report as unknown as { bytesReceived: number }).bytesReceived || 0;
          const timestamp = report.timestamp || 0;

          // Calculate metrics
          const lastStats = this.statsHistory[this.statsHistory.length - 1];
          if (lastStats) {
            const timeDelta = (timestamp - (lastStats as unknown as { timestamp: number }).timestamp) / 1000;
            if (timeDelta > 0) {
              this.session!.frameTime = timeDelta / (framesDecoded - lastStats.framesRendered);
              this.session!.bandwidth = (bytesReceived - (lastStats as unknown as { bytesReceived: number }).bytesReceived) / timeDelta;
            }
          }

          const renderStats: RenderStats = {
            framesRendered: framesDecoded,
            framesDropped: framesDropped,
            avgFrameTime: this.session!.frameTime,
            avgLatency: this.session!.latency,
            avgBandwidth: this.session!.bandwidth,
            peakMemory: 0,
            gpuUtilization: 0,
          };

          this.statsHistory.push(renderStats);
          if (this.statsHistory.length > 60) {
            this.statsHistory.shift();
          }

          if (this.onStatsCallback) {
            this.onStatsCallback(renderStats);
          }
        }
      });
    }, 1000);
  }

  /**
   * Request high-quality frame capture
   */
  async captureFrame(quality: 'preview' | 'print' | 'max'): Promise<Blob> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.config.serverUrl}/api/render/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.session.id,
        quality,
      }),
    });

    if (!response.ok) {
      throw new Error('Capture failed');
    }

    return await response.blob();
  }

  /**
   * Disconnect from render server
   */
  disconnect(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.session = null;
  }

  /**
   * Get current session
   */
  getSession(): RenderSession | null {
    return this.session;
  }
}

// ============================================================================
// PROGRESSIVE MESH STREAMING
// ============================================================================

export interface MeshChunk {
  id: string;
  lod: number;
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  priority: number;
}

export interface StreamingMesh {
  id: string;
  totalVertices: number;
  loadedVertices: number;
  chunks: Map<string, MeshChunk>;
  currentLOD: number;
  targetLOD: number;
  loading: boolean;
}

export class ProgressiveMeshStreamer {
  private meshes: Map<string, StreamingMesh> = new Map();
  private loadQueue: Array<{ meshId: string; chunkId: string; priority: number }> = [];
  private loading = false;
  private baseUrl: string;
  private maxConcurrent = 4;
  private currentLoading = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Register a mesh for streaming
   */
  registerMesh(id: string, totalVertices: number): void {
    this.meshes.set(id, {
      id,
      totalVertices,
      loadedVertices: 0,
      chunks: new Map(),
      currentLOD: 0,
      targetLOD: 0,
      loading: false,
    });
  }

  /**
   * Set target LOD based on camera distance
   */
  setTargetLOD(meshId: string, distance: number, screenSize: number): void {
    const mesh = this.meshes.get(meshId);
    if (!mesh) return;

    // Calculate desired LOD based on distance and screen coverage
    const lodFactor = Math.log2(distance / screenSize + 1);
    const targetLOD = Math.floor(lodFactor).clamp(0, 5);

    if (targetLOD !== mesh.targetLOD) {
      mesh.targetLOD = targetLOD;
      this.queueLODUpdate(meshId, targetLOD);
    }
  }

  private queueLODUpdate(meshId: string, targetLOD: number): void {
    // Add chunks for target LOD to load queue
    const chunkId = `${meshId}_lod${targetLOD}`;
    const existing = this.loadQueue.find(
      q => q.meshId === meshId && q.chunkId === chunkId
    );

    if (!existing) {
      this.loadQueue.push({
        meshId,
        chunkId,
        priority: 5 - targetLOD, // Higher LOD = higher priority
      });

      // Sort by priority
      this.loadQueue.sort((a, b) => b.priority - a.priority);
    }

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.loading || this.loadQueue.length === 0) return;
    if (this.currentLoading >= this.maxConcurrent) return;

    this.loading = true;

    while (this.loadQueue.length > 0 && this.currentLoading < this.maxConcurrent) {
      const item = this.loadQueue.shift();
      if (!item) break;

      this.currentLoading++;
      this.loadChunk(item.meshId, item.chunkId).finally(() => {
        this.currentLoading--;
        this.processQueue();
      });
    }

    this.loading = false;
  }

  private async loadChunk(meshId: string, chunkId: string): Promise<void> {
    const mesh = this.meshes.get(meshId);
    if (!mesh || mesh.chunks.has(chunkId)) return;

    try {
      const response = await fetch(`${this.baseUrl}/meshes/${chunkId}.bin`);
      if (!response.ok) throw new Error(`Failed to load chunk ${chunkId}`);

      const buffer = await response.arrayBuffer();
      const chunk = this.parseChunk(chunkId, buffer);

      mesh.chunks.set(chunkId, chunk);
      mesh.loadedVertices += chunk.vertices.length / 3;
      mesh.currentLOD = Math.max(mesh.currentLOD, chunk.lod);
    } catch (error) {
      console.error(`Failed to load mesh chunk ${chunkId}:`, error);
    }
  }

  private parseChunk(id: string, buffer: ArrayBuffer): MeshChunk {
    const view = new DataView(buffer);
    let offset = 0;

    // Read header
    const lod = view.getUint8(offset); offset += 1;
    const vertexCount = view.getUint32(offset, true); offset += 4;
    const indexCount = view.getUint32(offset, true); offset += 4;
    const hasNormals = view.getUint8(offset) === 1; offset += 1;
    const hasUVs = view.getUint8(offset) === 1; offset += 1;

    // Read bounding box
    const minX = view.getFloat32(offset, true); offset += 4;
    const minY = view.getFloat32(offset, true); offset += 4;
    const minZ = view.getFloat32(offset, true); offset += 4;
    const maxX = view.getFloat32(offset, true); offset += 4;
    const maxY = view.getFloat32(offset, true); offset += 4;
    const maxZ = view.getFloat32(offset, true); offset += 4;

    // Read vertices
    const vertices = new Float32Array(buffer, offset, vertexCount * 3);
    offset += vertexCount * 3 * 4;

    // Read indices
    const indices = new Uint32Array(buffer, offset, indexCount);
    offset += indexCount * 4;

    // Read normals if present
    let normals: Float32Array | undefined;
    if (hasNormals) {
      normals = new Float32Array(buffer, offset, vertexCount * 3);
      offset += vertexCount * 3 * 4;
    }

    // Read UVs if present
    let uvs: Float32Array | undefined;
    if (hasUVs) {
      uvs = new Float32Array(buffer, offset, vertexCount * 2);
    }

    return {
      id,
      lod,
      vertices,
      indices,
      normals,
      uvs,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      priority: 5 - lod,
    };
  }

  /**
   * Get current mesh data for rendering
   */
  getMeshData(meshId: string): MeshChunk | null {
    const mesh = this.meshes.get(meshId);
    if (!mesh) return null;

    // Return highest loaded LOD chunk
    for (let lod = 5; lod >= 0; lod--) {
      const chunk = mesh.chunks.get(`${meshId}_lod${lod}`);
      if (chunk) return chunk;
    }

    return null;
  }

  /**
   * Get loading progress
   */
  getProgress(meshId: string): number {
    const mesh = this.meshes.get(meshId);
    if (!mesh || mesh.totalVertices === 0) return 0;
    return mesh.loadedVertices / mesh.totalVertices;
  }

  /**
   * Clear all cached meshes
   */
  clearCache(): void {
    this.meshes.clear();
    this.loadQueue.length = 0;
  }
}

// ============================================================================
// RENDER FARM CLIENT
// ============================================================================

export interface RenderJob {
  id: string;
  projectId: string;
  type: 'still' | 'animation' | 'turntable' | 'walkthrough';
  quality: RenderQuality;
  frames?: { start: number; end: number; step: number };
  camera?: CameraState;
  outputFormat: 'png' | 'exr' | 'mp4' | 'webm';
  status: 'queued' | 'assigned' | 'rendering' | 'completed' | 'failed';
  progress: number;
  node?: string;
  estimatedTime?: number;
  startTime?: number;
  endTime?: number;
  resultUrl?: string;
}

export class RenderFarmClient {
  private apiUrl: string;
  private token: string;
  private jobs: Map<string, RenderJob> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(apiUrl: string, token: string) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  /**
   * Submit a render job
   */
  async submitJob(job: Omit<RenderJob, 'id' | 'status' | 'progress'>): Promise<RenderJob> {
    const response = await fetch(`${this.apiUrl}/api/farm/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(job),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit job: ${response.statusText}`);
    }

    const data = await response.json();
    const renderJob: RenderJob = {
      ...job,
      id: data.jobId,
      status: 'queued',
      progress: 0,
    };

    this.jobs.set(renderJob.id, renderJob);
    this.startPolling();

    return renderJob;
  }

  /**
   * Cancel a render job
   */
  async cancelJob(jobId: string): Promise<void> {
    await fetch(`${this.apiUrl}/api/farm/cancel/${jobId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    this.jobs.delete(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<RenderJob | null> {
    const response = await fetch(`${this.apiUrl}/api/farm/status/${jobId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, data);
    }
    return job || null;
  }

  /**
   * List all jobs
   */
  async listJobs(): Promise<RenderJob[]> {
    const response = await fetch(`${this.apiUrl}/api/farm/jobs`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.jobs;
  }

  /**
   * Get farm statistics
   */
  async getFarmStats(): Promise<{
    totalNodes: number;
    activeNodes: number;
    queuedJobs: number;
    renderingJobs: number;
    avgWaitTime: number;
    avgRenderTime: number;
  }> {
    const response = await fetch(`${this.apiUrl}/api/farm/stats`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get farm stats');
    }

    return await response.json();
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      for (const [jobId, job] of this.jobs) {
        if (job.status === 'queued' || job.status === 'rendering' || job.status === 'assigned') {
          await this.getJobStatus(jobId);
        }
      }

      // Stop polling if no active jobs
      const activeJobs = Array.from(this.jobs.values()).filter(
        j => j.status === 'queued' || j.status === 'rendering' || j.status === 'assigned'
      );
      if (activeJobs.length === 0 && this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    }, 5000);
  }

  /**
   * Download render result
   */
  async downloadResult(jobId: string): Promise<Blob> {
    const job = this.jobs.get(jobId);
    if (!job || !job.resultUrl) {
      throw new Error('Result not available');
    }

    const response = await fetch(job.resultUrl);
    if (!response.ok) {
      throw new Error('Failed to download result');
    }

    return await response.blob();
  }
}

// ============================================================================
// CLOUD RENDERING STORE
// ============================================================================

interface CloudRenderingState {
  // Clients
  streamingClient: CloudRenderingClient | null;
  meshStreamer: ProgressiveMeshStreamer | null;
  farmClient: RenderFarmClient | null;

  // Session
  activeSession: RenderSession | null;
  quality: RenderQuality;

  // Stats
  stats: RenderStats | null;
  latencyHistory: number[];
  bandwidthHistory: number[];

  // Jobs
  renderJobs: RenderJob[];

  // Actions
  initStreaming: (config: StreamingConfig) => void;
  connect: (projectId: string, quality: RenderQuality, token: string) => Promise<void>;
  disconnect: () => void;
  updateQuality: (quality: RenderQuality) => void;
  submitRenderJob: (job: Omit<RenderJob, 'id' | 'status' | 'progress'>) => Promise<RenderJob>;
  cancelRenderJob: (jobId: string) => Promise<void>;
}

export const useCloudRenderingStore = create<CloudRenderingState>((set, get) => ({
  streamingClient: null,
  meshStreamer: null,
  farmClient: null,
  activeSession: null,
  quality: QUALITY_PRESETS.balanced,
  stats: null,
  latencyHistory: [],
  bandwidthHistory: [],
  renderJobs: [],

  initStreaming: (config) => {
    const client = new CloudRenderingClient(config);
    
    client.onStats((stats) => {
      set((state) => ({
        stats,
        latencyHistory: [...state.latencyHistory.slice(-59), stats.avgLatency],
        bandwidthHistory: [...state.bandwidthHistory.slice(-59), stats.avgBandwidth],
      }));
    });

    set({ streamingClient: client });
  },

  connect: async (projectId, quality, token) => {
    const { streamingClient } = get();
    if (!streamingClient) {
      throw new Error('Streaming client not initialized');
    }

    const session = await streamingClient.connect(projectId, quality, token);
    set({ activeSession: session, quality });
  },

  disconnect: () => {
    const { streamingClient } = get();
    streamingClient?.disconnect();
    set({ activeSession: null, stats: null });
  },

  updateQuality: async (quality) => {
    const { streamingClient } = get();
    await streamingClient?.updateQuality(quality);
    set({ quality });
  },

  submitRenderJob: async (job) => {
    const { farmClient } = get();
    if (!farmClient) {
      throw new Error('Farm client not initialized');
    }

    const renderJob = await farmClient.submitJob(job);
    set((state) => ({
      renderJobs: [...state.renderJobs, renderJob],
    }));
    return renderJob;
  },

  cancelRenderJob: async (jobId) => {
    const { farmClient } = get();
    if (!farmClient) return;

    await farmClient.cancelJob(jobId);
    set((state) => ({
      renderJobs: state.renderJobs.filter(j => j.id !== jobId),
    }));
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

// Extend Number prototype for clamp
declare global {
  interface Number {
    clamp(min: number, max: number): number;
  }
}

Number.prototype.clamp = function(min: number, max: number): number {
  return Math.min(Math.max(this as number, min), max);
};
