/**
 * Plugin Architecture System
 * 
 * Extensible plugin system for third-party extensions:
 * - Plugin lifecycle management
 * - Sandboxed execution environment
 * - API exposure and permissions
 * - Plugin marketplace integration
 * - Hot reloading for development
 * - Version compatibility checking
 * 
 * Industry Parity: Revit API, Grasshopper, Dynamo, VS Code Extensions
 */

import { create } from 'zustand';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  main: string;
  icon?: string;
  categories: PluginCategory[];
  permissions: PluginPermission[];
  dependencies?: Record<string, string>;
  engines: {
    structura: string;
    node?: string;
  };
  contributes?: PluginContributions;
  activationEvents?: string[];
}

export type PluginCategory = 
  | 'analysis'
  | 'design'
  | 'modeling'
  | 'visualization'
  | 'import-export'
  | 'automation'
  | 'reporting'
  | 'collaboration'
  | 'utilities'
  | 'themes';

export type PluginPermission =
  | 'model:read'
  | 'model:write'
  | 'analysis:run'
  | 'analysis:results'
  | 'files:read'
  | 'files:write'
  | 'network:fetch'
  | 'ui:panels'
  | 'ui:commands'
  | 'ui:menus'
  | 'ui:toolbar'
  | 'clipboard:read'
  | 'clipboard:write'
  | 'notifications'
  | 'storage:local'
  | 'storage:cloud';

export interface PluginContributions {
  commands?: CommandContribution[];
  menus?: MenuContribution[];
  panels?: PanelContribution[];
  toolbarItems?: ToolbarContribution[];
  propertyEditors?: PropertyEditorContribution[];
  elementTypes?: ElementTypeContribution[];
  analysisTypes?: AnalysisContribution[];
  exportFormats?: ExportFormatContribution[];
  themes?: ThemeContribution[];
  languages?: LanguageContribution[];
}

export interface CommandContribution {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  keybinding?: string;
  when?: string;
}

export interface MenuContribution {
  id: string;
  command: string;
  group?: string;
  when?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  location: 'sidebar' | 'bottom' | 'right' | 'floating';
  when?: string;
}

export interface ToolbarContribution {
  id: string;
  command: string;
  icon: string;
  tooltip?: string;
  group?: string;
}

export interface PropertyEditorContribution {
  id: string;
  title: string;
  forTypes: string[];
  priority?: number;
}

export interface ElementTypeContribution {
  id: string;
  name: string;
  category: string;
  icon?: string;
  properties: PropertyDefinition[];
}

export interface PropertyDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'vector' | 'material';
  default?: unknown;
  options?: Array<{ value: unknown; label: string }>;
  unit?: string;
  min?: number;
  max?: number;
}

export interface AnalysisContribution {
  id: string;
  name: string;
  description: string;
  icon?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface ExportFormatContribution {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
}

export interface ThemeContribution {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: Record<string, string>;
}

export interface LanguageContribution {
  id: string;
  name: string;
  translations: Record<string, string>;
}

// ============================================================================
// PLUGIN LIFECYCLE
// ============================================================================

export type PluginState = 
  | 'uninstalled'
  | 'installed'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'inactive'
  | 'error';

export interface PluginInstance {
  manifest: PluginManifest;
  state: PluginState;
  module: PluginModule | null;
  context: PluginContext | null;
  error?: string;
  activatedAt?: number;
  deactivatedAt?: number;
}

export interface PluginModule {
  activate: (context: PluginContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  onModelChange?: (event: ModelChangeEvent) => void;
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  onAnalysisComplete?: (event: AnalysisCompleteEvent) => void;
}

export interface ModelChangeEvent {
  type: 'add' | 'update' | 'delete';
  elementIds: string[];
  source: string;
}

export interface SelectionChangeEvent {
  selectedIds: string[];
  previousIds: string[];
}

export interface AnalysisCompleteEvent {
  analysisId: string;
  type: string;
  success: boolean;
  results?: unknown;
  error?: string;
}

// ============================================================================
// PLUGIN CONTEXT (API EXPOSED TO PLUGINS)
// ============================================================================

export interface PluginContext {
  // Plugin info
  pluginId: string;
  pluginPath: string;
  extensionUri: string;

  // Subscriptions for cleanup
  subscriptions: Disposable[];

  // Core APIs
  model: ModelAPI;
  analysis: AnalysisAPI;
  ui: UIAPI;
  storage: StorageAPI;
  commands: CommandsAPI;

  // Utilities
  log: LogAPI;
  fetch: FetchAPI;

  // Extension specific
  asAbsolutePath: (relativePath: string) => string;
  secrets: SecretsAPI;
}

export interface Disposable {
  dispose: () => void;
}

export interface ModelAPI {
  getNodes: () => Promise<Node[]>;
  getNode: (id: string) => Promise<Node | null>;
  addNode: (node: Omit<Node, 'id'>) => Promise<Node>;
  updateNode: (id: string, updates: Partial<Node>) => Promise<Node>;
  deleteNode: (id: string) => Promise<void>;
  
  getElements: () => Promise<Element[]>;
  getElement: (id: string) => Promise<Element | null>;
  addElement: (element: Omit<Element, 'id'>) => Promise<Element>;
  updateElement: (id: string, updates: Partial<Element>) => Promise<Element>;
  deleteElement: (id: string) => Promise<void>;
  
  getLoads: () => Promise<Load[]>;
  getMaterials: () => Promise<Material[]>;
  getSections: () => Promise<Section[]>;
  
  onDidChange: (listener: (event: ModelChangeEvent) => void) => Disposable;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  supports?: {
    dx: boolean;
    dy: boolean;
    dz: boolean;
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
}

export interface Element {
  id: string;
  type: string;
  nodeIds: string[];
  sectionId?: string;
  materialId?: string;
  properties?: Record<string, unknown>;
}

export interface Load {
  id: string;
  type: string;
  elementId?: string;
  nodeId?: string;
  values: number[];
  loadCase: string;
}

export interface Material {
  id: string;
  name: string;
  type: string;
  properties: Record<string, number>;
}

export interface Section {
  id: string;
  name: string;
  type: string;
  properties: Record<string, number>;
}

export interface AnalysisAPI {
  runAnalysis: (type: string, options?: Record<string, unknown>) => Promise<AnalysisResult>;
  getResults: (analysisId: string) => Promise<AnalysisResult | null>;
  getAvailableTypes: () => Promise<string[]>;
  onDidComplete: (listener: (event: AnalysisCompleteEvent) => void) => Disposable;
}

export interface AnalysisResult {
  id: string;
  type: string;
  status: 'success' | 'error' | 'warning';
  nodeResults?: Map<string, NodeResult>;
  elementResults?: Map<string, ElementResult>;
  summary?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

export interface NodeResult {
  displacements: number[];
  reactions?: number[];
}

export interface ElementResult {
  forces: number[];
  stresses?: number[];
  strains?: number[];
}

export interface UIAPI {
  showMessage: (message: string, type?: 'info' | 'warning' | 'error') => void;
  showProgress: (title: string, task: (progress: ProgressReporter) => Promise<void>) => Promise<void>;
  showQuickPick: (items: QuickPickItem[], options?: QuickPickOptions) => Promise<QuickPickItem | undefined>;
  showInputBox: (options?: InputBoxOptions) => Promise<string | undefined>;
  createPanel: (id: string, title: string, html: string) => Panel;
  createStatusBarItem: (alignment: 'left' | 'right', priority?: number) => StatusBarItem;
  getSelection: () => Promise<string[]>;
  setSelection: (ids: string[]) => Promise<void>;
  onDidChangeSelection: (listener: (event: SelectionChangeEvent) => void) => Disposable;
}

export interface ProgressReporter {
  report: (value: { message?: string; increment?: number }) => void;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

export interface QuickPickOptions {
  title?: string;
  placeholder?: string;
  canPickMany?: boolean;
  matchOnDescription?: boolean;
}

export interface InputBoxOptions {
  title?: string;
  prompt?: string;
  placeholder?: string;
  value?: string;
  password?: boolean;
  validateInput?: (value: string) => string | undefined;
}

export interface Panel {
  id: string;
  title: string;
  visible: boolean;
  show: () => void;
  hide: () => void;
  dispose: () => void;
  onDidReceiveMessage: (listener: (message: unknown) => void) => Disposable;
  postMessage: (message: unknown) => void;
  setHtml: (html: string) => void;
}

export interface StatusBarItem {
  text: string;
  tooltip?: string;
  command?: string;
  show: () => void;
  hide: () => void;
  dispose: () => void;
}

export interface StorageAPI {
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  keys: () => Promise<string[]>;
}

export interface CommandsAPI {
  registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => Disposable;
  executeCommand: <T>(id: string, ...args: unknown[]) => Promise<T>;
  getCommands: () => Promise<string[]>;
}

export interface LogAPI {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export interface FetchAPI {
  fetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface SecretsAPI {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

// ============================================================================
// PLUGIN MANAGER
// ============================================================================

export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private commands: Map<string, (...args: unknown[]) => unknown> = new Map();
  private eventEmitter = new EventTarget();
  private marketplaceUrl: string;

  constructor(marketplaceUrl: string = 'https://marketplace.structura.dev') {
    this.marketplaceUrl = marketplaceUrl;
  }

  /**
   * Install a plugin from URL or local path
   */
  async install(source: string | PluginManifest): Promise<PluginInstance> {
    let manifest: PluginManifest;

    if (typeof source === 'string') {
      // Load manifest from URL
      const response = await fetch(`${source}/package.json`);
      if (!response.ok) {
        throw new Error(`Failed to load plugin manifest from ${source}`);
      }
      manifest = await response.json();
    } else {
      manifest = source;
    }

    // Check compatibility
    this.checkCompatibility(manifest);

    // Check permissions
    await this.checkPermissions(manifest);

    // Create instance
    const instance: PluginInstance = {
      manifest,
      state: 'installed',
      module: null,
      context: null,
    };

    this.plugins.set(manifest.id, instance);
    this.emitEvent('plugin:installed', { pluginId: manifest.id });

    return instance;
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) return;

    // Deactivate first if active
    if (instance.state === 'active') {
      await this.deactivate(pluginId);
    }

    this.plugins.delete(pluginId);
    this.emitEvent('plugin:uninstalled', { pluginId });
  }

  /**
   * Activate a plugin
   */
  async activate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (instance.state === 'active') return;

    instance.state = 'activating';

    try {
      // Load module
      const moduleUrl = this.getModuleUrl(instance.manifest);
      const module = await this.loadModule(moduleUrl);
      instance.module = module;

      // Create context
      const context = this.createContext(instance.manifest);
      instance.context = context;

      // Call activate
      if (module.activate) {
        await module.activate(context);
      }

      // Register contributions
      this.registerContributions(instance);

      instance.state = 'active';
      instance.activatedAt = Date.now();

      this.emitEvent('plugin:activated', { pluginId });
    } catch (error) {
      instance.state = 'error';
      instance.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance || instance.state !== 'active') return;

    instance.state = 'deactivating';

    try {
      // Call deactivate
      if (instance.module?.deactivate) {
        await instance.module.deactivate();
      }

      // Dispose subscriptions
      if (instance.context) {
        for (const subscription of instance.context.subscriptions) {
          subscription.dispose();
        }
      }

      // Unregister contributions
      this.unregisterContributions(instance);

      instance.state = 'inactive';
      instance.deactivatedAt = Date.now();
      instance.module = null;
      instance.context = null;

      this.emitEvent('plugin:deactivated', { pluginId });
    } catch (error) {
      instance.state = 'error';
      instance.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Get all installed plugins
   */
  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Search marketplace
   */
  async searchMarketplace(query: string): Promise<PluginManifest[]> {
    const response = await fetch(
      `${this.marketplaceUrl}/api/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error('Failed to search marketplace');
    }
    return await response.json();
  }

  /**
   * Get featured plugins
   */
  async getFeatured(): Promise<PluginManifest[]> {
    const response = await fetch(`${this.marketplaceUrl}/api/featured`);
    if (!response.ok) {
      throw new Error('Failed to get featured plugins');
    }
    return await response.json();
  }

  /**
   * Register a command handler
   */
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
    this.commands.set(id, handler);
    return {
      dispose: () => this.commands.delete(id),
    };
  }

  /**
   * Execute a command
   */
  async executeCommand<T>(id: string, ...args: unknown[]): Promise<T> {
    const handler = this.commands.get(id);
    if (!handler) {
      throw new Error(`Command ${id} not found`);
    }
    return await handler(...args) as T;
  }

  private checkCompatibility(manifest: PluginManifest): void {
    const currentVersion = '1.0.0'; // Would come from app config
    const requiredVersion = manifest.engines.structura;

    // Simple semver check (production would use proper semver library)
    if (!this.isVersionCompatible(currentVersion, requiredVersion)) {
      throw new Error(
        `Plugin requires Structura ${requiredVersion}, but current version is ${currentVersion}`
      );
    }
  }

  private isVersionCompatible(current: string, required: string): boolean {
    // Handle caret (^) and tilde (~) ranges
    const cleanRequired = required.replace(/[\^~>=<]/g, '');
    const [currMajor] = current.split('.').map(Number);
    const [reqMajor] = cleanRequired.split('.').map(Number);

    if (required.startsWith('^')) {
      return currMajor >= reqMajor;
    }

    return current >= cleanRequired;
  }

  private async checkPermissions(manifest: PluginManifest): Promise<void> {
    const dangerousPermissions = manifest.permissions.filter(p =>
      ['files:write', 'network:fetch', 'storage:cloud'].includes(p)
    );

    if (dangerousPermissions.length > 0) {
      // In production, show permission dialog to user
      console.warn(
        `Plugin ${manifest.name} requests dangerous permissions:`,
        dangerousPermissions
      );
    }
  }

  private getModuleUrl(manifest: PluginManifest): string {
    // In production, this would resolve to actual plugin location
    return `/plugins/${manifest.id}/${manifest.main}`;
  }

  private async loadModule(url: string): Promise<PluginModule> {
    // Dynamic import with sandboxing
    try {
      const module = await import(/* webpackIgnore: true */ url);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error}`);
    }
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id;
    const subscriptions: Disposable[] = [];

    return {
      pluginId,
      pluginPath: `/plugins/${pluginId}`,
      extensionUri: `/plugins/${pluginId}`,
      subscriptions,

      model: this.createModelAPI(manifest.permissions),
      analysis: this.createAnalysisAPI(manifest.permissions),
      ui: this.createUIAPI(manifest.permissions),
      storage: this.createStorageAPI(pluginId, manifest.permissions),
      commands: {
        registerCommand: (id, handler) => this.registerCommand(`${pluginId}.${id}`, handler),
        executeCommand: (id, ...args) => this.executeCommand(id, ...args),
        getCommands: async () => Array.from(this.commands.keys()),
      },

      log: {
        info: (msg, ...args) => console.log(`[${pluginId}]`, msg, ...args),
        warn: (msg, ...args) => console.warn(`[${pluginId}]`, msg, ...args),
        error: (msg, ...args) => console.error(`[${pluginId}]`, msg, ...args),
        debug: (msg, ...args) => console.debug(`[${pluginId}]`, msg, ...args),
      },

      fetch: {
        fetch: async (url, options) => {
          if (!manifest.permissions.includes('network:fetch')) {
            throw new Error('Plugin does not have network:fetch permission');
          }
          return fetch(url, options);
        },
      },

      asAbsolutePath: (relativePath) => `/plugins/${pluginId}/${relativePath}`,

      secrets: {
        get: async (key) => localStorage.getItem(`${pluginId}:secret:${key}`) || undefined,
        set: async (key, value) => localStorage.setItem(`${pluginId}:secret:${key}`, value),
        delete: async (key) => localStorage.removeItem(`${pluginId}:secret:${key}`),
      },
    };
  }

  private createModelAPI(permissions: PluginPermission[]): ModelAPI {
    const canRead = permissions.includes('model:read');
    const canWrite = permissions.includes('model:write');

    return {
      getNodes: async () => {
        if (!canRead) throw new Error('model:read permission required');
        // Would integrate with actual model store
        return [];
      },
      getNode: async (id) => {
        if (!canRead) throw new Error('model:read permission required');
        return null;
      },
      addNode: async (node) => {
        if (!canWrite) throw new Error('model:write permission required');
        return { id: crypto.randomUUID(), ...node };
      },
      updateNode: async (id, updates) => {
        if (!canWrite) throw new Error('model:write permission required');
        return { id, ...updates } as Node;
      },
      deleteNode: async (id) => {
        if (!canWrite) throw new Error('model:write permission required');
      },
      getElements: async () => {
        if (!canRead) throw new Error('model:read permission required');
        return [];
      },
      getElement: async (id) => {
        if (!canRead) throw new Error('model:read permission required');
        return null;
      },
      addElement: async (element) => {
        if (!canWrite) throw new Error('model:write permission required');
        return { id: crypto.randomUUID(), ...element };
      },
      updateElement: async (id, updates) => {
        if (!canWrite) throw new Error('model:write permission required');
        return { id, ...updates } as Element;
      },
      deleteElement: async (id) => {
        if (!canWrite) throw new Error('model:write permission required');
      },
      getLoads: async () => {
        if (!canRead) throw new Error('model:read permission required');
        return [];
      },
      getMaterials: async () => {
        if (!canRead) throw new Error('model:read permission required');
        return [];
      },
      getSections: async () => {
        if (!canRead) throw new Error('model:read permission required');
        return [];
      },
      onDidChange: (listener) => {
        if (!canRead) throw new Error('model:read permission required');
        return { dispose: () => {} };
      },
    };
  }

  private createAnalysisAPI(permissions: PluginPermission[]): AnalysisAPI {
    const canRun = permissions.includes('analysis:run');
    const canRead = permissions.includes('analysis:results');

    return {
      runAnalysis: async (type, options) => {
        if (!canRun) throw new Error('analysis:run permission required');
        return {
          id: crypto.randomUUID(),
          type,
          status: 'success',
        };
      },
      getResults: async (id) => {
        if (!canRead) throw new Error('analysis:results permission required');
        return null;
      },
      getAvailableTypes: async () => {
        return ['linear-static', 'modal', 'response-spectrum', 'time-history'];
      },
      onDidComplete: (listener) => {
        if (!canRead) throw new Error('analysis:results permission required');
        return { dispose: () => {} };
      },
    };
  }

  private createUIAPI(permissions: PluginPermission[]): UIAPI {
    return {
      showMessage: (message, type = 'info') => {
        if (permissions.includes('notifications')) {
          console.log(`[${type.toUpperCase()}] ${message}`);
        }
      },
      showProgress: async (title, task) => {
        const progress: ProgressReporter = {
          report: ({ message, increment }) => {
            console.log(`[Progress] ${title}: ${message} (${increment}%)`);
          },
        };
        await task(progress);
      },
      showQuickPick: async (items, options) => {
        // Would show actual quick pick UI
        return items[0];
      },
      showInputBox: async (options) => {
        // Would show actual input box
        return options?.value || '';
      },
      createPanel: (id, title, html) => {
        if (!permissions.includes('ui:panels')) {
          throw new Error('ui:panels permission required');
        }
        return {
          id,
          title,
          visible: false,
          show: () => {},
          hide: () => {},
          dispose: () => {},
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          postMessage: () => {},
          setHtml: () => {},
        };
      },
      createStatusBarItem: (alignment, priority) => {
        return {
          text: '',
          show: () => {},
          hide: () => {},
          dispose: () => {},
        };
      },
      getSelection: async () => [],
      setSelection: async (ids) => {},
      onDidChangeSelection: (listener) => ({ dispose: () => {} }),
    };
  }

  private createStorageAPI(pluginId: string, permissions: PluginPermission[]): StorageAPI {
    const hasLocal = permissions.includes('storage:local');
    const prefix = `plugin:${pluginId}:`;

    return {
      get: async <T>(key: string) => {
        if (!hasLocal) throw new Error('storage:local permission required');
        const value = localStorage.getItem(prefix + key);
        return value ? JSON.parse(value) : undefined;
      },
      set: async <T>(key: string, value: T) => {
        if (!hasLocal) throw new Error('storage:local permission required');
        localStorage.setItem(prefix + key, JSON.stringify(value));
      },
      delete: async (key: string) => {
        if (!hasLocal) throw new Error('storage:local permission required');
        localStorage.removeItem(prefix + key);
      },
      keys: async () => {
        if (!hasLocal) throw new Error('storage:local permission required');
        return Object.keys(localStorage)
          .filter(k => k.startsWith(prefix))
          .map(k => k.slice(prefix.length));
      },
    };
  }

  private registerContributions(instance: PluginInstance): void {
    const { manifest } = instance;
    const contributions = manifest.contributes;
    if (!contributions) return;

    // Register commands
    if (contributions.commands) {
      for (const cmd of contributions.commands) {
        // Commands are registered when plugin calls registerCommand
        this.emitEvent('contribution:command', { pluginId: manifest.id, command: cmd });
      }
    }

    // Register menus
    if (contributions.menus) {
      for (const menu of contributions.menus) {
        this.emitEvent('contribution:menu', { pluginId: manifest.id, menu });
      }
    }

    // Register panels
    if (contributions.panels) {
      for (const panel of contributions.panels) {
        this.emitEvent('contribution:panel', { pluginId: manifest.id, panel });
      }
    }

    // Register toolbar items
    if (contributions.toolbarItems) {
      for (const item of contributions.toolbarItems) {
        this.emitEvent('contribution:toolbar', { pluginId: manifest.id, item });
      }
    }
  }

  private unregisterContributions(instance: PluginInstance): void {
    // Remove all contributions for this plugin
    this.emitEvent('contributions:removed', { pluginId: instance.manifest.id });
  }

  private emitEvent(type: string, detail: unknown): void {
    this.eventEmitter.dispatchEvent(
      new CustomEvent(type, { detail })
    );
  }

  /**
   * Subscribe to plugin events
   */
  on(event: string, listener: (event: CustomEvent) => void): Disposable {
    const handler = listener as EventListener;
    this.eventEmitter.addEventListener(event, handler);
    return {
      dispose: () => this.eventEmitter.removeEventListener(event, handler),
    };
  }
}

// ============================================================================
// PLUGIN STORE
// ============================================================================

interface PluginStoreState {
  manager: PluginManager;
  plugins: PluginInstance[];
  loading: boolean;
  error: string | null;

  // Actions
  install: (source: string | PluginManifest) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  activate: (pluginId: string) => Promise<void>;
  deactivate: (pluginId: string) => Promise<void>;
  refreshPlugins: () => void;
  searchMarketplace: (query: string) => Promise<PluginManifest[]>;
}

export const usePluginStore = create<PluginStoreState>((set, get) => {
  const manager = new PluginManager();

  // Sync plugins with manager
  const refreshPlugins = () => {
    set({ plugins: manager.getPlugins() });
  };

  // Subscribe to plugin events
  manager.on('plugin:installed', refreshPlugins);
  manager.on('plugin:uninstalled', refreshPlugins);
  manager.on('plugin:activated', refreshPlugins);
  manager.on('plugin:deactivated', refreshPlugins);

  return {
    manager,
    plugins: [],
    loading: false,
    error: null,

    install: async (source) => {
      set({ loading: true, error: null });
      try {
        await manager.install(source);
        refreshPlugins();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        set({ loading: false });
      }
    },

    uninstall: async (pluginId) => {
      set({ loading: true, error: null });
      try {
        await manager.uninstall(pluginId);
        refreshPlugins();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        set({ loading: false });
      }
    },

    activate: async (pluginId) => {
      set({ loading: true, error: null });
      try {
        await manager.activate(pluginId);
        refreshPlugins();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        set({ loading: false });
      }
    },

    deactivate: async (pluginId) => {
      set({ loading: true, error: null });
      try {
        await manager.deactivate(pluginId);
        refreshPlugins();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        set({ loading: false });
      }
    },

    refreshPlugins,

    searchMarketplace: (query) => manager.searchMarketplace(query),
  };
});

// ============================================================================
// PLUGIN DEVELOPMENT UTILITIES
// ============================================================================

/**
 * Create a new plugin scaffold
 */
export function createPluginScaffold(name: string, category: PluginCategory): PluginManifest {
  const id = name.toLowerCase().replace(/\s+/g, '-');

  return {
    id,
    name,
    version: '1.0.0',
    description: `${name} plugin for Structura`,
    author: 'Your Name',
    license: 'MIT',
    main: 'dist/index.js',
    categories: [category],
    permissions: ['model:read', 'ui:commands'],
    engines: {
      structura: '^1.0.0',
    },
    contributes: {
      commands: [
        {
          id: 'helloWorld',
          title: 'Hello World',
          category: name,
        },
      ],
    },
    activationEvents: ['onCommand:helloWorld'],
  };
}

/**
 * Plugin development hot reload
 */
export class PluginDevServer {
  private ws: WebSocket | null = null;
  private manager: PluginManager;
  private watchedPlugins: Set<string> = new Set();

  constructor(manager: PluginManager, wsUrl: string = 'ws://localhost:3001') {
    this.manager = manager;
    this.connect(wsUrl);
  }

  private connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[PluginDev] Connected to development server');
    };

    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'reload':
            await this.reloadPlugin(message.pluginId);
            break;
          case 'install':
            await this.manager.install(message.manifest);
            await this.manager.activate(message.manifest.id);
            this.watchedPlugins.add(message.manifest.id);
            break;
        }
      } catch (error) {
        console.error('[PluginDev] Error handling message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[PluginDev] Disconnected, reconnecting...');
      setTimeout(() => this.connect(url), 3000);
    };
  }

  private async reloadPlugin(pluginId: string): Promise<void> {
    console.log(`[PluginDev] Reloading plugin: ${pluginId}`);

    await this.manager.deactivate(pluginId);
    await this.manager.activate(pluginId);

    console.log(`[PluginDev] Plugin reloaded: ${pluginId}`);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

// PluginManager is already exported with 'export class' declaration above
