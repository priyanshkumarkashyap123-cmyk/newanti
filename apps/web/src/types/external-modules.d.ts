/**
 * Type declarations for development/testing dependencies
 * These modules are used in test/accessibility checking utilities
 */

// Playwright test types (only used in test environment)
declare module '@playwright/test' {
  export interface Page {
    goto(url: string): Promise<void>;
    locator(selector: string): Locator;
    evaluate<R>(fn: (...args: unknown[]) => R, ...args: unknown[]): Promise<R>;
    waitForSelector(selector: string): Promise<void>;
    waitForFunction(fn: string | (() => boolean), options?: { timeout?: number }): Promise<void>;
    $eval<R>(selector: string, fn: (el: Element) => R): Promise<R>;
    $$eval<R>(selector: string, fn: (els: Element[]) => R): Promise<R>;
    addScriptTag(options: { url?: string; content?: string; type?: string }): Promise<void>;
    url(): string;
    title(): Promise<string>;
    content(): Promise<string>;
    screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
  }

  export interface Locator {
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    getAttribute(name: string): Promise<string | null>;
    isVisible(): Promise<boolean>;
    textContent(): Promise<string | null>;
  }

  export function test(name: string, fn: (args: { page: Page }) => Promise<void>): void;
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toContain(expected: unknown): void;
  };
}

// Axe-core accessibility testing types
declare module 'axe-core' {
  export type ImpactValue = 'minor' | 'moderate' | 'serious' | 'critical';

  export interface AxeResults {
    violations: Violation[];
    passes: Result[];
    incomplete: Result[];
    inapplicable: Result[];
    timestamp: string;
    url: string;
  }

  export interface Violation {
    id: string;
    impact: ImpactValue;
    description: string;
    help: string;
    helpUrl: string;
    nodes: NodeResult[];
    tags: string[];
  }

  export interface Result {
    id: string;
    impact?: ImpactValue;
    description: string;
    help: string;
    helpUrl: string;
    nodes: NodeResult[];
    tags: string[];
  }

  export interface NodeResult {
    html: string;
    target: string[];
    failureSummary?: string;
    impact?: string;
  }

  export interface RunOptions {
    runOnly?: {
      type: 'tag' | 'rule';
      values: string[];
    };
    rules?: Record<string, { enabled: boolean }>;
    reporter?: 'v1' | 'v2' | 'raw';
    resultTypes?: ('violations' | 'passes' | 'incomplete' | 'inapplicable')[];
    selectors?: boolean;
    ancestry?: boolean;
    xpath?: boolean;
    absolutePaths?: boolean;
  }

  export interface Spec {
    branding?: {
      brand?: string;
      application?: string;
    };
    reporter?: 'v1' | 'v2' | 'raw';
    checks?: Check[];
    rules?: Rule[];
  }

  export interface Check {
    id: string;
    evaluate?: string | Function;
    after?: string | Function;
    options?: unknown;
    matches?: string;
    enabled?: boolean;
  }

  export interface Rule {
    id: string;
    selector?: string;
    matches?: string;
    excludeHidden?: boolean;
    enabled?: boolean;
    pageLevel?: boolean;
    any?: string[];
    all?: string[];
    none?: string[];
    tags?: string[];
    impact?: 'minor' | 'moderate' | 'serious' | 'critical';
  }

  export function run(
    context?: Element | Document | string,
    options?: RunOptions
  ): Promise<AxeResults>;

  export function configure(spec: Spec): void;
  export function reset(): void;
  export function getRules(tags?: string[]): Rule[];

  const axe: {
    run: typeof run;
    configure: typeof configure;
    reset: typeof reset;
    getRules: typeof getRules;
  };

  export default axe;
}

// IndexedDB wrapper (idb)
declare module 'idb' {
  export interface DBSchema {
    [key: string]: {
      key: IDBValidKey;
      value: unknown;
      indexes?: Record<string, IDBValidKey>;
    };
  }

  export interface IDBPDatabase<T extends DBSchema = DBSchema> {
    name: string;
    version: number;
    objectStoreNames: DOMStringList;
    close(): void;
    transaction<K extends keyof T>(
      storeNames: K | K[],
      mode?: IDBTransactionMode
    ): IDBPTransaction<T, K[]>;
    get<K extends keyof T>(storeName: K, key: T[K]['key']): Promise<T[K]['value'] | undefined>;
    getAll<K extends keyof T>(storeName: K): Promise<T[K]['value'][]>;
    getAllKeys<K extends keyof T>(storeName: K): Promise<T[K]['key'][]>;
    count<K extends keyof T>(storeName: K): Promise<number>;
    put<K extends keyof T>(storeName: K, value: T[K]['value'], key?: T[K]['key']): Promise<T[K]['key']>;
    add<K extends keyof T>(storeName: K, value: T[K]['value'], key?: T[K]['key']): Promise<T[K]['key']>;
    delete<K extends keyof T>(storeName: K, key: T[K]['key']): Promise<void>;
    clear<K extends keyof T>(storeName: K): Promise<void>;
  }

  export interface IDBPTransaction<
    T extends DBSchema = DBSchema,
    TStoreNames extends (keyof T)[] = (keyof T)[]
  > {
    store: IDBPObjectStore<T, TStoreNames, TStoreNames[0]>;
    objectStore<K extends TStoreNames[number]>(name: K): IDBPObjectStore<T, TStoreNames, K>;
    done: Promise<void>;
  }

  export interface IDBPObjectStore<
    T extends DBSchema = DBSchema,
    TStoreNames extends (keyof T)[] = (keyof T)[],
    TStoreName extends TStoreNames[number] = TStoreNames[number]
  > {
    name: TStoreName;
    keyPath: string | string[] | null;
    indexNames: DOMStringList;
    autoIncrement: boolean;
    get(key: T[TStoreName]['key']): Promise<T[TStoreName]['value'] | undefined>;
    getAll(): Promise<T[TStoreName]['value'][]>;
    getAllKeys(): Promise<T[TStoreName]['key'][]>;
    count(): Promise<number>;
    put(value: T[TStoreName]['value'], key?: T[TStoreName]['key']): Promise<T[TStoreName]['key']>;
    add(value: T[TStoreName]['value'], key?: T[TStoreName]['key']): Promise<T[TStoreName]['key']>;
    delete(key: T[TStoreName]['key']): Promise<void>;
    clear(): Promise<void>;
    index<K extends keyof T[TStoreName]['indexes']>(
      name: K
    ): IDBPIndex<T, TStoreNames, TStoreName, K>;
  }

  export interface IDBPIndex<
    T extends DBSchema = DBSchema,
    TStoreNames extends (keyof T)[] = (keyof T)[],
    TStoreName extends TStoreNames[number] = TStoreNames[number],
    TIndexName extends keyof T[TStoreName]['indexes'] = keyof T[TStoreName]['indexes']
  > {
    name: TIndexName;
    keyPath: string | string[];
    multiEntry: boolean;
    unique: boolean;
    get(key: T[TStoreName]['indexes'][TIndexName]): Promise<T[TStoreName]['value'] | undefined>;
    getAll(key?: T[TStoreName]['indexes'][TIndexName]): Promise<T[TStoreName]['value'][]>;
    getAllKeys(key?: T[TStoreName]['indexes'][TIndexName]): Promise<T[TStoreName]['key'][]>;
    count(key?: T[TStoreName]['indexes'][TIndexName]): Promise<number>;
  }

  export interface OpenDBCallbacks<T extends DBSchema> {
    upgrade?(
      database: IDBPDatabase<T>,
      oldVersion: number,
      newVersion: number | null,
      transaction: IDBPTransaction<T, (keyof T)[]>
    ): void;
    blocked?(): void;
    blocking?(): void;
    terminated?(): void;
  }

  export function openDB<T extends DBSchema = DBSchema>(
    name: string,
    version?: number,
    callbacks?: OpenDBCallbacks<T>
  ): Promise<IDBPDatabase<T>>;

  export function deleteDB(name: string): Promise<void>;

  export function wrap(value: IDBDatabase): IDBPDatabase;
  export function wrap(value: IDBTransaction): IDBPTransaction;
  export function wrap(value: IDBObjectStore): IDBPObjectStore;
  export function wrap(value: IDBIndex): IDBPIndex;

  export function unwrap(value: IDBPDatabase): IDBDatabase;
  export function unwrap(value: IDBPTransaction): IDBTransaction;
  export function unwrap(value: IDBPObjectStore): IDBObjectStore;
  export function unwrap(value: IDBPIndex): IDBIndex;
}

// MSW (Mock Service Worker)
declare module 'msw' {
  export interface RestHandler {
    test(request: Request): boolean;
  }

  export interface GraphQLHandler {
    test(request: Request): boolean;
  }

  export const rest: {
    get(path: string, resolver: ResponseResolver): RestHandler;
    post(path: string, resolver: ResponseResolver): RestHandler;
    put(path: string, resolver: ResponseResolver): RestHandler;
    patch(path: string, resolver: ResponseResolver): RestHandler;
    delete(path: string, resolver: ResponseResolver): RestHandler;
    options(path: string, resolver: ResponseResolver): RestHandler;
    head(path: string, resolver: ResponseResolver): RestHandler;
  };

  export const graphql: {
    query(operationName: string, resolver: ResponseResolver): GraphQLHandler;
    mutation(operationName: string, resolver: ResponseResolver): GraphQLHandler;
  };

  export type ResponseResolver = (
    req: Request,
    res: ResponseComposition,
    ctx: RestContext
  ) => Promise<MockedResponse> | MockedResponse;

  export interface ResponseComposition {
    (transformer: ResponseTransformer): MockedResponse;
  }

  export interface ResponseTransformer {
    (response: MockedResponse): MockedResponse;
  }

  export interface MockedResponse {
    status: number;
    headers: Headers;
    body: unknown;
    delay: number;
  }

  export interface RestContext {
    status(code: number): ResponseTransformer;
    json(body: unknown): ResponseTransformer;
    text(body: string): ResponseTransformer;
    delay(ms: number): ResponseTransformer;
    set(headers: Record<string, string>): ResponseTransformer;
  }
}

declare module 'msw/node' {
  import type { RestHandler, GraphQLHandler } from 'msw';

  export interface SetupServerApi {
    listen(options?: { onUnhandledRequest?: 'bypass' | 'warn' | 'error' }): void;
    close(): void;
    resetHandlers(...handlers: (RestHandler | GraphQLHandler)[]): void;
    use(...handlers: (RestHandler | GraphQLHandler)[]): void;
    restoreHandlers(): void;
  }

  export function setupServer(...handlers: (RestHandler | GraphQLHandler)[]): SetupServerApi;
}
