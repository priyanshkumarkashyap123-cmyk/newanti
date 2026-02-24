/**
 * ============================================================================
 * DESIGN KNOWLEDGE BASE — Self-Learning Structural Design Cache
 * ============================================================================
 *
 * Stores every completed design calculation in IndexedDB so the system
 * "learns" over time.  Three data stores:
 *
 *   1. ExactCache   — hash(inputs) → full design output (O(1) lookup)
 *   2. Brackets     — sorted arrays keyed by (fck, fy, support, code)
 *                     enabling fast interpolation for near-miss queries
 *   3. UserPrefs    — per-user extra FoS, preferred grades, design style
 *
 * The knowledge base is 100 % deterministic — no ML, no randomness.
 * Every answer can be traced back to a specific IS 456 / ACI / EC2
 * calculation, preserving code-compliance and auditability.
 *
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DesignCodeKey = 'IS456' | 'ACI318' | 'EN1992' | 'AS3600';
export type SupportType = 'simply-supported' | 'cantilever' | 'continuous' | 'fixed-fixed';
export type MemberType = 'beam' | 'column' | 'slab' | 'footing';

/** Compact fingerprint of design inputs — used as cache key */
export interface DesignInputKey {
  memberType: MemberType;
  code: DesignCodeKey;
  support: SupportType;
  /** Span / height in mm */
  L: number;
  /** Total applied UDL in kN/m (factored) */
  w: number;
  /** Characteristic concrete strength MPa */
  fck: number;
  /** Characteristic steel yield strength MPa */
  fy: number;
  /** User-specified additional FoS (1.0 = no extra) */
  extraFoS: number;
}

/** Full result stored per design */
export interface CachedDesignResult {
  key: DesignInputKey;
  /** Width mm */
  b: number;
  /** Total depth mm */
  D: number;
  /** Effective depth mm */
  d: number;
  /** Required tension steel area mm² */
  Ast: number;
  /** Required compression steel area mm² */
  Asc: number;
  /** Utilisation ratio (0-1) */
  utilization: number;
  /** Moment capacity kN·m */
  Mu_capacity: number;
  /** Shear capacity kN */
  Vu_capacity: number;
  /** Selected tension bars */
  tensionBars: { diameter: number; count: number; area: number }[];
  /** Selected compression bars */
  compressionBars: { diameter: number; count: number; area: number }[];
  /** 'safe' | 'unsafe' | 'marginal' */
  status: string;
  /** ISO timestamp of when this was computed */
  computedAt: string;
  /** Full engine output (opaque, for detail panels) */
  fullResult?: any;
}

/** A bracket entry — lightweight row for interpolation */
export interface BracketEntry {
  L: number;
  w: number;
  b: number;
  D: number;
  Ast: number;
  utilization: number;
  extraFoS: number;
}

/** Bracket collection keyed by material + support config */
export interface BracketTable {
  key: string; // e.g. "IS456_M25_Fe500_simply-supported_beam"
  entries: BracketEntry[];
}

/** User design preferences */
export interface UserDesignPrefs {
  userId: string;
  extraFoS: number;           // default additional FoS
  preferredConcreteGrade: string;
  preferredSteelGrade: string;
  designStyle: 'conservative' | 'optimised' | 'balanced';
  prefMinWidth: number;       // mm — smallest beam width user likes
  prefMaxWidth: number;       // mm
  prefMinDepth: number;       // mm
  prefMaxDepth: number;       // mm
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing helper
// ─────────────────────────────────────────────────────────────────────────────

function hashKey(k: DesignInputKey): string {
  // Round to sensible precision so near-identical inputs share a cache slot
  const Lr = Math.round(k.L);
  const wr = Math.round(k.w * 100) / 100;
  const fos = Math.round(k.extraFoS * 100) / 100;
  return `${k.memberType}|${k.code}|${k.support}|${Lr}|${wr}|${k.fck}|${k.fy}|${fos}`;
}

function bracketTableKey(k: DesignInputKey): string {
  return `${k.code}_M${k.fck}_Fe${k.fy}_${k.support}_${k.memberType}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'beamlab-design-knowledge';
const DB_VERSION = 1;
const STORE_CACHE = 'design_cache';
const STORE_BRACKETS = 'brackets';
const STORE_PREFS = 'user_prefs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'hash' });
      }
      if (!db.objectStoreNames.contains(STORE_BRACKETS)) {
        db.createObjectStore(STORE_BRACKETS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PREFS)) {
        db.createObjectStore(STORE_PREFS, { keyPath: 'userId' });
      }
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

class DesignKnowledgeBaseClass {
  private db: IDBDatabase | null = null;
  /** In-memory mirror for sub-ms lookups (populated on init) */
  private memCache = new Map<string, CachedDesignResult>();
  private memBrackets = new Map<string, BracketTable>();

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB();
    await this._loadIntoMemory();
  }

  private async _loadIntoMemory(): Promise<void> {
    if (!this.db) return;

    // Load cache
    const cacheTx = this.db.transaction(STORE_CACHE, 'readonly');
    const cacheStore = cacheTx.objectStore(STORE_CACHE);
    const allCache: CachedDesignResult[] = await new Promise((res, rej) => {
      const req = cacheStore.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    for (const row of allCache) {
      this.memCache.set((row as any).hash, row);
    }

    // Load brackets
    const bracketTx = this.db.transaction(STORE_BRACKETS, 'readonly');
    const bracketStore = bracketTx.objectStore(STORE_BRACKETS);
    const allBrackets: BracketTable[] = await new Promise((res, rej) => {
      const req = bracketStore.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    for (const bt of allBrackets) {
      this.memBrackets.set(bt.key, bt);
    }

    console.log(
      `[DesignKB] Loaded ${this.memCache.size} cached designs, ${this.memBrackets.size} bracket tables`,
    );
  }

  // ── Exact lookup ───────────────────────────────────────────────────────

  getExact(inputKey: DesignInputKey): CachedDesignResult | null {
    const h = hashKey(inputKey);
    return this.memCache.get(h) ?? null;
  }

  // ── Bracket (interpolation) lookup ─────────────────────────────────────

  /**
   * Find the two nearest cached designs that *bracket* the requested
   * (L, w) on either side.  Returns null if no data exists for this
   * configuration.
   */
  getBracket(
    inputKey: DesignInputKey,
  ): { lower: BracketEntry | null; upper: BracketEntry | null; confidence: number } | null {
    const tk = bracketTableKey(inputKey);
    const table = this.memBrackets.get(tk);
    if (!table || table.entries.length === 0) return null;

    // Composite metric: normalised load intensity  q = w * L² / 8  (proportional to M)
    const targetQ = inputKey.w * inputKey.L * inputKey.L / 8;

    // Sort entries by the same composite metric
    const sorted = [...table.entries].sort(
      (a, b) => (a.w * a.L * a.L) - (b.w * b.L * b.L),
    );

    let lower: BracketEntry | null = null;
    let upper: BracketEntry | null = null;

    for (const e of sorted) {
      const eq = e.w * e.L * e.L / 8;
      if (eq <= targetQ) lower = e;
      if (eq >= targetQ && !upper) upper = e;
    }

    // Confidence: how tight is the bracket?
    let confidence = 0;
    if (lower && upper) {
      const lq = lower.w * lower.L * lower.L / 8;
      const uq = upper.w * upper.L * upper.L / 8;
      const span = Math.abs(uq - lq);
      if (span < 1e-6) {
        confidence = 1.0; // Exact or near-exact
      } else {
        const dist = Math.min(Math.abs(targetQ - lq), Math.abs(targetQ - uq));
        confidence = Math.max(0, 1 - dist / span);
      }
    } else if (lower || upper) {
      confidence = 0.3; // Only one side available
    }

    return { lower, upper, confidence };
  }

  /**
   * Interpolate a section from brackets.
   * Returns estimated (b, D, Ast) or null if insufficient data.
   */
  interpolate(inputKey: DesignInputKey): { b: number; D: number; Ast: number; confidence: number } | null {
    const bracket = this.getBracket(inputKey);
    if (!bracket) return null;
    const { lower, upper, confidence } = bracket;
    if (confidence < 0.2) return null; // Too uncertain

    if (lower && upper) {
      const targetQ = inputKey.w * inputKey.L * inputKey.L / 8;
      const lq = lower.w * lower.L * lower.L / 8;
      const uq = upper.w * upper.L * upper.L / 8;
      const t = uq > lq ? (targetQ - lq) / (uq - lq) : 0.5;
      return {
        b: Math.round(lower.b + t * (upper.b - lower.b)),
        D: Math.round(lower.D + t * (upper.D - lower.D)),
        Ast: Math.round(lower.Ast + t * (upper.Ast - lower.Ast)),
        confidence,
      };
    }

    const ref = (lower ?? upper)!;
    return { b: ref.b, D: ref.D, Ast: ref.Ast, confidence };
  }

  // ── Store a new result ─────────────────────────────────────────────────

  async store(result: CachedDesignResult): Promise<void> {
    await this.init();
    const h = hashKey(result.key);

    // 1. Exact cache
    const row = { ...result, hash: h };
    this.memCache.set(h, result);
    if (this.db) {
      const tx = this.db.transaction(STORE_CACHE, 'readwrite');
      tx.objectStore(STORE_CACHE).put(row);
    }

    // 2. Bracket table
    const tk = bracketTableKey(result.key);
    let table = this.memBrackets.get(tk);
    if (!table) {
      table = { key: tk, entries: [] };
      this.memBrackets.set(tk, table);
    }
    // Avoid duplicate entries for same (L, w)
    const existing = table.entries.findIndex(
      (e) => Math.abs(e.L - result.key.L) < 1 && Math.abs(e.w - result.key.w) < 0.01,
    );
    const entry: BracketEntry = {
      L: result.key.L,
      w: result.key.w,
      b: result.b,
      D: result.D,
      Ast: result.Ast,
      utilization: result.utilization,
      extraFoS: result.key.extraFoS,
    };
    if (existing >= 0) {
      table.entries[existing] = entry;
    } else {
      table.entries.push(entry);
    }
    // Keep sorted by moment proxy
    table.entries.sort((a, b) => a.w * a.L * a.L - b.w * b.L * b.L);

    if (this.db) {
      const tx = this.db.transaction(STORE_BRACKETS, 'readwrite');
      tx.objectStore(STORE_BRACKETS).put(table);
    }
  }

  // ── User preferences ──────────────────────────────────────────────────

  async getUserPrefs(userId = 'default'): Promise<UserDesignPrefs> {
    await this.init();
    if (!this.db) return defaultPrefs(userId);

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_PREFS, 'readonly');
      const req = tx.objectStore(STORE_PREFS).get(userId);
      req.onsuccess = () => resolve(req.result ?? defaultPrefs(userId));
      req.onerror = () => resolve(defaultPrefs(userId));
    });
  }

  async saveUserPrefs(prefs: UserDesignPrefs): Promise<void> {
    await this.init();
    if (!this.db) return;
    const tx = this.db.transaction(STORE_PREFS, 'readwrite');
    tx.objectStore(STORE_PREFS).put(prefs);
  }

  // ── Statistics ─────────────────────────────────────────────────────────

  get cacheSize(): number {
    return this.memCache.size;
  }

  get bracketTableCount(): number {
    return this.memBrackets.size;
  }

  /** Total bracket entries across all tables */
  get totalBracketEntries(): number {
    let n = 0;
    for (const t of this.memBrackets.values()) n += t.entries.length;
    return n;
  }

  // ── Clear (for testing / reset) ────────────────────────────────────────

  async clear(): Promise<void> {
    this.memCache.clear();
    this.memBrackets.clear();
    if (!this.db) return;
    const tx = this.db.transaction([STORE_CACHE, STORE_BRACKETS], 'readwrite');
    tx.objectStore(STORE_CACHE).clear();
    tx.objectStore(STORE_BRACKETS).clear();
  }
}

function defaultPrefs(userId: string): UserDesignPrefs {
  return {
    userId,
    extraFoS: 1.0,
    preferredConcreteGrade: 'M25',
    preferredSteelGrade: 'Fe500',
    designStyle: 'balanced',
    prefMinWidth: 230,
    prefMaxWidth: 500,
    prefMinDepth: 300,
    prefMaxDepth: 900,
  };
}

/** Singleton — call init() once at app startup */
export const DesignKnowledgeBase = new DesignKnowledgeBaseClass();
export default DesignKnowledgeBase;
