/**
 * Prisma Type Stubs
 * 
 * Stub: Provides type compatibility until Prisma schema migration is completed.
 * These mirror what @prisma/client would provide once schema is generated.
 * 
 * To migrate to Prisma:
 *   pnpm add @prisma/client prisma
 *   npx prisma generate
 */

import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================
// ENUMS
// ============================================

export enum AuditType {
  // Matches schema.prisma canonical values
  MODEL_CREATION = 'MODEL_CREATION',
  ANALYSIS = 'ANALYSIS',
  DESIGN_CHECK = 'DESIGN_CHECK',
  OPTIMIZATION = 'OPTIMIZATION',
  AI_RECOMMENDATION = 'AI_RECOMMENDATION',
  USER_OVERRIDE = 'USER_OVERRIDE',
  EXPORT = 'EXPORT',
  VALIDATION = 'VALIDATION',
  CONNECTION_DESIGN = 'CONNECTION_DESIGN',
  // Extended types (app-level, not in schema.prisma)
  DESIGN_DECISION = 'DESIGN_DECISION',
  ANALYSIS_RUN = 'ANALYSIS_RUN',
  MATERIAL_SELECTION = 'MATERIAL_SELECTION',
  CODE_CHECK = 'CODE_CHECK',
  IMPORT = 'IMPORT',
  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  ERROR = 'ERROR',
}

export enum FeedbackType {
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  IMPROVEMENT = 'IMPROVEMENT',
  GENERAL = 'GENERAL',
  CORRECTION = 'CORRECTION',
  RATING = 'RATING',
  SUGGESTION = 'SUGGESTION',
  ERROR_REPORT = 'ERROR_REPORT',
}

export enum FeedbackStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  WONT_FIX = 'WONT_FIX',
}

// ============================================
// MODELS
// ============================================

export interface AuditEntry {
  id: string;
  projectId: string;
  sessionId: string;
  type: AuditType;
  action: string;
  details: string;
  aiGenerated: boolean;
  confidence: number | null;
  modelUsed: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
  
  // PE Signature fields
  signedBy?: string;
  signedAt?: Date;
  signatureHash?: string;
  licenseNo?: string;
}

export interface FeedbackEntry {
  id: string;
  projectId?: string | null;
  userId?: string | null;
  sessionId: string;
  type: FeedbackType;
  feature: string | null;
  message: string;
  email: string | null;
  status: FeedbackStatus;
  rating: number | null;
  originalInput: string;
  originalOutput?: unknown;
  correctedOutput?: unknown;
  comment?: string | null;
  processed: boolean;
  usedForTraining?: boolean;
  exportedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PRISMA CLIENT STUB
// ============================================

interface CountOptions {
  where?: Record<string, unknown>;
}

interface FindManyOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
}

interface CreateOptions<T> {
  data: Partial<T>;
}

interface UpdateOptions<T> {
  where: { id: string };
  data: Partial<T>;
}

interface GroupByOptions {
  by: string[];
  where?: Record<string, unknown>;
  _count?: boolean;
}

interface ModelDelegate<T> {
  findMany(options?: FindManyOptions & { select?: Record<string, boolean> }): Promise<T[]>;
  findUnique(options: { where: { id: string } }): Promise<T | null>;
  create(options: CreateOptions<T>): Promise<T>;
  update(options: UpdateOptions<T>): Promise<T>;
  updateMany(options: { where: Record<string, unknown>; data: Partial<T> }): Promise<{ count: number }>;
  delete(options: { where: { id: string } }): Promise<T>;
  count(options?: CountOptions): Promise<number>;
  groupBy(options: GroupByOptions): Promise<Array<{ type?: string; feature?: string; _count: number }>>;
  aggregate(options: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * File-backed PrismaClient stub — persists audit & feedback data to JSON
 * Replace with real PrismaClient once database is configured
 */
export class PrismaClient {
  auditEntry: ModelDelegate<AuditEntry>;
  feedbackEntry: ModelDelegate<FeedbackEntry>;
  feedback: ModelDelegate<FeedbackEntry>;  // Alias for feedbackEntry

  private auditStore: AuditEntry[] = [];
  private feedbackStore: FeedbackEntry[] = [];
  private dataDir: string;

  constructor() {
    // Resolve data directory relative to project root
    const currentDir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    this.dataDir = join(currentDir, '..', '..', 'data');

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // Load persisted data
    this.auditStore = this.loadStore<AuditEntry>('audit.json');
    this.feedbackStore = this.loadStore<FeedbackEntry>('feedback.json');

    this.auditEntry = this.createDelegate(this.auditStore, 'audit.json');
    this.feedbackEntry = this.createDelegate(this.feedbackStore, 'feedback.json');
    this.feedback = this.feedbackEntry;  // Alias
  }

  private loadStore<T>(filename: string): T[] {
    const filepath = join(this.dataDir, filename);
    try {
      if (existsSync(filepath)) {
        const raw = readFileSync(filepath, 'utf-8');
        return JSON.parse(raw) as T[];
      }
    } catch (err) {
      logger.warn(`[PrismaStub] Failed to load ${filename}, starting fresh: ${err}`);
    }
    return [];
  }

  private persistStore<T>(store: T[], filename: string): void {
    const filepath = join(this.dataDir, filename);
    try {
      writeFileSync(filepath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`[PrismaStub] Failed to persist ${filename}: ${err}`);
    }
  }

  private createDelegate<T extends { id: string }>(store: T[], filename: string): ModelDelegate<T> {
    return {
      findMany: async (options?: FindManyOptions): Promise<T[]> => {
        let results = [...store];
        
        if (options?.where) {
          results = results.filter(item => {
            return Object.entries(options.where!).every(([key, value]) => {
              if (value === undefined) return true;
              return (item as Record<string, unknown>)[key] === value;
            });
          });
        }
        
        if (options?.orderBy) {
          const [field, order] = Object.entries(options.orderBy)[0];
          results.sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[field];
            const bVal = (b as Record<string, unknown>)[field];
            if (aVal === bVal) return 0;
            const comparison = aVal! < bVal! ? -1 : 1;
            return order === 'desc' ? -comparison : comparison;
          });
        }
        
        if (options?.skip) results = results.slice(options.skip);
        if (options?.take) results = results.slice(0, options.take);
        
        return results;
      },
      
      findUnique: async (options: { where: { id: string } }): Promise<T | null> => {
        return store.find(item => item.id === options.where.id) || null;
      },
      
      create: async (options: CreateOptions<T>): Promise<T> => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const entry = { ...options.data, id } as T;
        store.push(entry);
        this.persistStore(store, filename);
        return entry;
      },
      
      update: async (options: UpdateOptions<T>): Promise<T> => {
        const index = store.findIndex(item => item.id === options.where.id);
        if (index === -1) throw new Error('Record not found');
        store[index] = { ...store[index], ...options.data };
        this.persistStore(store, filename);
        return store[index];
      },
      
      delete: async (options: { where: { id: string } }): Promise<T> => {
        const index = store.findIndex(item => item.id === options.where.id);
        if (index === -1) throw new Error('Record not found');
        const [deleted] = store.splice(index, 1);
        this.persistStore(store, filename);
        return deleted;
      },
      
      updateMany: async (options: { where: Record<string, unknown>; data: Partial<T> }): Promise<{ count: number }> => {
        let count = 0;
        store.forEach((item, index) => {
          const matches = Object.entries(options.where).every(([key, value]) => {
            if (value === undefined) return true;
            // Handle 'in' operator
            if (typeof value === 'object' && value !== null && 'in' in value) {
              return (value as { in: unknown[] }).in.includes((item as Record<string, unknown>)[key]);
            }
            return (item as Record<string, unknown>)[key] === value;
          });
          if (matches) {
            store[index] = { ...store[index], ...options.data };
            count++;
          }
        });
        this.persistStore(store, filename);
        return { count };
      },
      
      count: async (options?: CountOptions): Promise<number> => {
        if (!options?.where) return store.length;
        return store.filter(item => {
          return Object.entries(options.where!).every(([key, value]) => {
            if (value === undefined) return true;
            return (item as Record<string, unknown>)[key] === value;
          });
        }).length;
      },
      
      groupBy: async (options: GroupByOptions): Promise<Array<{ type?: string; feature?: string; _count: number }>> => {
        const groups = new Map<string, number>();
        const field = options.by[0];
        
        store.forEach(item => {
          const key = String((item as Record<string, unknown>)[field]);
          groups.set(key, (groups.get(key) || 0) + 1);
        });
        
        return Array.from(groups.entries()).map(([key, count]) => ({
          [field]: key,
          _count: count,
        })) as Array<{ type?: string; feature?: string; _count: number }>;
      },
      
      aggregate: async (): Promise<Record<string, unknown>> => {
        return { _avg: { rating: 0 }, _count: store.length };
      },
    };
  }

  async $connect(): Promise<void> {
    logger.info(`[PrismaStub] Connected (file-backed mode, data dir: ${this.dataDir})`);
    logger.info(`[PrismaStub] Loaded ${this.auditStore.length} audit entries, ${this.feedbackStore.length} feedback entries`);
  }

  async $disconnect(): Promise<void> {
    logger.info('[PrismaStub] Disconnected');
  }
}

// Re-export for compatibility
export default PrismaClient;
