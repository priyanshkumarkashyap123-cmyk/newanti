let wasm;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(takeObject(mem.getUint32(i, true)));
    }
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const AIArchitectFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_aiarchitect_free(ptr >>> 0, 1));

const MacnealHarderWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_macnealharderwasm_free(ptr >>> 0, 1));

const RendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_renderer_free(ptr >>> 0, 1));

const WasmHHTIntegratorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmhhtintegrator_free(ptr >>> 0, 1));

const WasmSparseMatrixFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsparsematrix_free(ptr >>> 0, 1));

export class AIArchitect {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AIArchitect.prototype);
        obj.__wbg_ptr = ptr;
        AIArchitectFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AIArchitectFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_aiarchitect_free(ptr, 0);
    }
    /**
     * @param {number} span
     * @param {number} load
     * @returns {string}
     */
    static suggest_beam_size(span, load) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.aiarchitect_suggest_beam_size(retptr, span, load);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {AIArchitect}
     */
    static new() {
        const ret = wasm.aiarchitect_new();
        return AIArchitect.__wrap(ret);
    }
}
if (Symbol.dispose) AIArchitect.prototype[Symbol.dispose] = AIArchitect.prototype.free;

export class MacnealHarderWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MacnealHarderWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_macnealharderwasm_free(ptr, 0);
    }
    /**
     * @returns {any}
     */
    static get_quad4_patch() {
        const ret = wasm.macnealharderwasm_get_quad4_patch();
        return takeObject(ret);
    }
    /**
     * @param {number} n_elem
     * @returns {any}
     */
    static generate_twisted_beam(n_elem) {
        const ret = wasm.macnealharderwasm_generate_twisted_beam(n_elem);
        return takeObject(ret);
    }
}
if (Symbol.dispose) MacnealHarderWasm.prototype[Symbol.dispose] = MacnealHarderWasm.prototype.free;

/**
 * Stub renderer for WASM builds
 * The actual 3D rendering is performed by Three.js in the frontend
 */
export class Renderer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_renderer_free(ptr, 0);
    }
    /**
     * Create a new renderer stub
     * @param {HTMLCanvasElement} _canvas
     */
    constructor(_canvas) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.renderer_new(retptr, addHeapObject(_canvas));
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            RendererFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Clear canvas stub - no-op
     */
    clear() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.renderer_clear(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get canvas width
     * @returns {number}
     */
    width() {
        const ret = wasm.renderer_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get canvas height
     * @returns {number}
     */
    height() {
        const ret = wasm.renderer_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Render frame stub - no-op
     */
    render() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.renderer_clear(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Resize stub - no-op
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        wasm.renderer_resize(this.__wbg_ptr, width, height);
    }
}
if (Symbol.dispose) Renderer.prototype[Symbol.dispose] = Renderer.prototype.free;

export class WasmHHTIntegrator {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmHHTIntegratorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmhhtintegrator_free(ptr, 0);
    }
    /**
     * @param {Float64Array} u0
     * @param {Float64Array} v0
     */
    set_initial(u0, v0) {
        const ptr0 = passArrayF64ToWasm0(u0, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(v0, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmhhtintegrator_set_initial(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @returns {Float64Array}
     */
    get_velocity() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmhhtintegrator_get_velocity(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    get_acceleration() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmhhtintegrator_get_acceleration(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    get_displacement() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmhhtintegrator_get_displacement(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} alpha
     * @param {Float64Array} mass
     * @param {Float64Array} damping
     * @param {Float64Array} stiffness
     * @param {number} dt
     */
    constructor(alpha, mass, damping, stiffness, dt) {
        const ptr0 = passArrayF64ToWasm0(mass, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(damping, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(stiffness, wasm.__wbindgen_export);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmhhtintegrator_new(alpha, ptr0, len0, ptr1, len1, ptr2, len2, dt);
        this.__wbg_ptr = ret >>> 0;
        WasmHHTIntegratorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float64Array} force
     * @returns {any}
     */
    step(force) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(force, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmhhtintegrator_step(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get_time() {
        const ret = wasm.wasmhhtintegrator_get_time(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmHHTIntegrator.prototype[Symbol.dispose] = WasmHHTIntegrator.prototype.free;

export class WasmSparseMatrix {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSparseMatrixFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsparsematrix_free(ptr, 0);
    }
    /**
     * Get memory usage stats
     * @returns {number}
     */
    memory_usage() {
        const ret = wasm.wasmsparsematrix_memory_usage(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Create from triplets (row, col, value)
     * Expects triplets as a flat array [r0, c0, v0, r1, c1, v1, ...]
     * @param {number} nrows
     * @param {number} ncols
     * @param {Float64Array} triplets_flat
     */
    constructor(nrows, ncols, triplets_flat) {
        const ptr0 = passArrayF64ToWasm0(triplets_flat, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsparsematrix_new(nrows, ncols, ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        WasmSparseMatrixFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Sparse matrix-vector multiplication (y = A*x)
     * @param {Float64Array} x
     * @returns {Float64Array}
     */
    spmv(x) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(x, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmsparsematrix_spmv(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v2 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WasmSparseMatrix.prototype[Symbol.dispose] = WasmSparseMatrix.prototype.free;

/**
 * Linearized buckling analysis — eigenvalue problem [Ke]{φ} = λ[-Kg]{φ}
 * Returns critical load factors where P_cr = λ × P_applied
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} point_loads_val
 * @param {number} num_modes
 * @returns {any}
 */
export function analyze_buckling(nodes_val, elements_val, point_loads_val, num_modes) {
    const ret = wasm.analyze_buckling(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(point_loads_val), num_modes);
    return takeObject(ret);
}

/**
 * Benchmark the ultra-fast solver
 * Returns timing statistics for different problem sizes
 * @param {number} num_nodes
 * @param {number} num_elements
 * @param {number} iterations
 * @returns {any}
 */
export function benchmark_ultra_fast(num_nodes, num_elements, iterations) {
    const ret = wasm.benchmark_ultra_fast(num_nodes, num_elements, iterations);
    return takeObject(ret);
}

/**
 * @param {number} d
 * @param {number} bf
 * @param {number} tw
 * @param {number} tf
 * @param {number} rx
 * @param {number} ry
 * @param {number} zx
 * @param {number} zy
 * @param {number} sx
 * @param {number} sy
 * @param {number} j
 * @param {number} cw
 * @param {number} ag
 * @param {number} fy
 * @param {number} E
 * @param {number} lb
 * @param {number} lc_x
 * @param {number} lc_y
 * @param {number} cb
 * @returns {any}
 */
export function calculate_aisc_capacity(d, bf, tw, tf, rx, ry, zx, zy, sx, sy, j, cw, ag, fy, E, lb, lc_x, lc_y, cb) {
    const ret = wasm.calculate_aisc_capacity(d, bf, tw, tf, rx, ry, zx, zy, sx, sy, j, cw, ag, fy, E, lb, lc_x, lc_y, cb);
    return takeObject(ret);
}

/**
 * @param {number} b
 * @param {number} d
 * @param {number} fck
 * @param {number} fy
 * @param {number} ast
 * @returns {number}
 */
export function calculate_beam_capacity(b, d, fck, fy, ast) {
    const ret = wasm.calculate_beam_capacity(b, d, fck, fy, ast);
    return ret;
}

/**
 * @param {number} zone
 * @param {number} importance
 * @param {number} r_factor
 * @param {number} period
 * @param {number} soil
 * @param {number} weight
 * @returns {number}
 */
export function calculate_seismic_base_shear(zone, importance, r_factor, period, soil, weight) {
    const ret = wasm.calculate_seismic_base_shear(zone, importance, r_factor, period, soil, weight);
    return ret;
}

/**
 * Combine multiple load case results using factored superposition.
 * `cases_val`: JSON map { caseName: AnalysisResult3D }
 * `combinations_val`: JSON array of LoadCombination objects
 * Returns an EnvelopeResult with max/min across all combinations.
 * @param {any} cases_val
 * @param {any} combinations_val
 * @returns {any}
 */
export function combine_load_cases(cases_val, combinations_val) {
    const ret = wasm.combine_load_cases(addHeapObject(cases_val), addHeapObject(combinations_val));
    return takeObject(ret);
}

/**
 * @param {number} k0
 * @param {number} fy
 * @param {number} alpha
 * @returns {Float64Array}
 */
export function create_bilinear_hysteresis(k0, fy, alpha) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.create_bilinear_hysteresis(retptr, k0, fy, alpha);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export4(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} ndof
 * @param {number} block_size
 * @param {number} max_memory_mb
 * @returns {string}
 */
export function create_out_of_core_matrix(ndof, block_size, max_memory_mb) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.create_out_of_core_matrix(retptr, ndof, block_size, max_memory_mb);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} ndof
 * @param {number} avg_nnz_per_row
 * @returns {string}
 */
export function estimate_solve_requirements(ndof, avg_nnz_per_row) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.estimate_solve_requirements(retptr, ndof, avg_nnz_per_row);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @returns {string[]}
 */
export function get_available_hysteresis_models() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.get_available_hysteresis_models(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1).slice();
        wasm.__wbindgen_export4(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Get solver version and capabilities
 * @returns {string}
 */
export function get_solver_info() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.get_solver_info(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get standard AISC LRFD load combinations
 * @returns {any}
 */
export function get_standard_combinations_aisc_lrfd() {
    const ret = wasm.get_standard_combinations_aisc_lrfd();
    return takeObject(ret);
}

/**
 * Get standard Eurocode load combinations
 * @returns {any}
 */
export function get_standard_combinations_eurocode() {
    const ret = wasm.get_standard_combinations_eurocode();
    return takeObject(ret);
}

/**
 * Get standard IS 800 load combinations
 * @returns {any}
 */
export function get_standard_combinations_is800() {
    const ret = wasm.get_standard_combinations_is800();
    return takeObject(ret);
}

/**
 * Modal analysis for dynamic properties
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {number} num_modes
 * @returns {any}
 */
export function modal_analysis(nodes_val, elements_val, num_modes) {
    const ret = wasm.modal_analysis(addHeapObject(nodes_val), addHeapObject(elements_val), num_modes);
    return takeObject(ret);
}

export function set_panic_hook() {
    wasm.set_panic_hook();
}

/**
 * @param {string} model
 * @param {number} k0
 * @param {number} fy
 * @param {number} alpha
 * @param {Float64Array} strain_history
 * @returns {Float64Array}
 */
export function simulate_hysteresis_response(model, k0, fy, alpha, strain_history) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(model, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(strain_history, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.simulate_hysteresis_response(retptr, ptr0, len0, k0, fy, alpha, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export4(r0, r1 * 8, 8);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * 2D Frame analysis WITH nodal loads
 * This is the recommended function for 2D analysis with applied loads
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} loads_val
 * @returns {any}
 */
export function solve_2d_frame_with_loads(nodes_val, elements_val, loads_val) {
    const ret = wasm.solve_2d_frame_with_loads(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(loads_val));
    return takeObject(ret);
}

/**
 * 3D Frame analysis (new advanced solver)
 * Accepts nodes, elements, nodal loads, distributed loads, and optional extended parameters
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} nodal_loads_val
 * @param {any} distributed_loads_val
 * @returns {any}
 */
export function solve_3d_frame(nodes_val, elements_val, nodal_loads_val, distributed_loads_val) {
    const ret = wasm.solve_3d_frame(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(nodal_loads_val), addHeapObject(distributed_loads_val));
    return takeObject(ret);
}

/**
 * Extended 3D Frame analysis with temperature loads, point loads, and config
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} nodal_loads_val
 * @param {any} distributed_loads_val
 * @param {any} temperature_loads_val
 * @param {any} point_loads_val
 * @param {any} config_val
 * @returns {any}
 */
export function solve_3d_frame_extended(nodes_val, elements_val, nodal_loads_val, distributed_loads_val, temperature_loads_val, point_loads_val, config_val) {
    const ret = wasm.solve_3d_frame_extended(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(nodal_loads_val), addHeapObject(distributed_loads_val), addHeapObject(temperature_loads_val), addHeapObject(point_loads_val), addHeapObject(config_val));
    return takeObject(ret);
}

/**
 * P-Delta analysis - iterative geometric nonlinear analysis
 * Accounts for secondary moments from axial loads (P) acting on lateral displacements (Δ).
 * Backward-compatible wrapper — delegates to solve_p_delta_extended with empty optional loads.
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} point_loads_val
 * @param {any} member_loads_val
 * @param {number} max_iterations
 * @param {number} tolerance
 * @returns {any}
 */
export function solve_p_delta(nodes_val, elements_val, point_loads_val, member_loads_val, max_iterations, tolerance) {
    const ret = wasm.solve_p_delta(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(point_loads_val), addHeapObject(member_loads_val), max_iterations, tolerance);
    return takeObject(ret);
}

/**
 * Extended P-Delta analysis with temperature loads, point loads on members, and config.
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} point_loads_val
 * @param {any} member_loads_val
 * @param {any} temperature_loads_val
 * @param {any} point_loads_on_members_val
 * @param {any} config_val
 * @param {number} max_iterations
 * @param {number} tolerance
 * @returns {any}
 */
export function solve_p_delta_extended(nodes_val, elements_val, point_loads_val, member_loads_val, temperature_loads_val, point_loads_on_members_val, config_val, max_iterations, tolerance) {
    const ret = wasm.solve_p_delta_extended(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(point_loads_val), addHeapObject(member_loads_val), addHeapObject(temperature_loads_val), addHeapObject(point_loads_on_members_val), addHeapObject(config_val), max_iterations, tolerance);
    return takeObject(ret);
}

/**
 * Nonlinear static pushover analysis — capacity curve generation
 * Returns base shear vs. roof displacement with hinge states
 * @param {any} input_val
 * @returns {any}
 */
export function solve_pushover(input_val) {
    const ret = wasm.solve_pushover(addHeapObject(input_val));
    return takeObject(ret);
}

/**
 * Response Spectrum Analysis (Seismic)
 * @param {any} modal_result_val
 * @param {number} zone_factor
 * @param {number} importance_factor
 * @param {number} response_reduction
 * @param {number} soil_type
 * @returns {any}
 */
export function solve_response_spectrum(modal_result_val, zone_factor, importance_factor, response_reduction, soil_type) {
    const ret = wasm.solve_response_spectrum(addHeapObject(modal_result_val), zone_factor, importance_factor, response_reduction, soil_type);
    return takeObject(ret);
}

/**
 * Solve sparse system using Conjugate Gradient
 * This handles large structures (e.g. 10k+ nodes) without OOM.
 * @param {string} input_json
 * @returns {string}
 */
export function solve_sparse_system_json(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.solve_sparse_system_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred2_0, deferred2_1, 1);
    }
}

/**
 * 2D Frame analysis (backward compatible - no loads)
 * @param {any} nodes_val
 * @param {any} elements_val
 * @returns {any}
 */
export function solve_structure_wasm(nodes_val, elements_val) {
    const ret = wasm.solve_structure_wasm(addHeapObject(nodes_val), addHeapObject(elements_val));
    return takeObject(ret);
}

/**
 * Solve a linear system K * u = F using LU decomposition
 * Backported from legacy solver-wasm for compatibility with StructuralSolverWorker
 * @param {Float64Array} stiffness_array
 * @param {Float64Array} force_array
 * @param {number} dof
 * @returns {Float64Array}
 */
export function solve_system(stiffness_array, force_array, dof) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF64ToWasm0(stiffness_array, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(force_array, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.solve_system(retptr, ptr0, len0, ptr1, len1, dof);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeObject(r1);
        }
        return takeObject(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Ultra-fast 3D frame analysis with performance metrics
 * Returns microsecond-level analysis times for small-medium structures
 * @param {any} nodes_val
 * @param {any} elements_val
 * @param {any} loads_val
 * @returns {any}
 */
export function solve_ultra_fast(nodes_val, elements_val, loads_val) {
    const ret = wasm.solve_ultra_fast(addHeapObject(nodes_val), addHeapObject(elements_val), addHeapObject(loads_val));
    return takeObject(ret);
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_Error_52673b7de5a0ca89 = function(arg0, arg1) {
        const ret = Error(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_Number_2d1dcfcf4ec51736 = function(arg0) {
        const ret = Number(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(arg0, arg1) {
        const ret = String(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_bigint_get_as_i64_6e32f5e6aff02e1d = function(arg0, arg1) {
        const v = getObject(arg1);
        const ret = typeof(v) === 'bigint' ? v : undefined;
        getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg___wbindgen_boolean_get_dea25b33882b895b = function(arg0) {
        const v = getObject(arg0);
        const ret = typeof(v) === 'boolean' ? v : undefined;
        return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
    };
    imports.wbg.__wbg___wbindgen_debug_string_adfb662ae34724b6 = function(arg0, arg1) {
        const ret = debugString(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_in_0d3e1e8f0c669317 = function(arg0, arg1) {
        const ret = getObject(arg0) in getObject(arg1);
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_bigint_0e1a2e3f55cfae27 = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'bigint';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_function_8d400b8b1af978cd = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'function';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_object_ce774f3490692386 = function(arg0) {
        const val = getObject(arg0);
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_string_704ef9c8fc131030 = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'string';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_undefined_f6b95eab589e0269 = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_jsval_eq_b6101cc9cef1fe36 = function(arg0, arg1) {
        const ret = getObject(arg0) === getObject(arg1);
        return ret;
    };
    imports.wbg.__wbg___wbindgen_jsval_loose_eq_766057600fdd1b0d = function(arg0, arg1) {
        const ret = getObject(arg0) == getObject(arg1);
        return ret;
    };
    imports.wbg.__wbg___wbindgen_number_get_9619185a74197f95 = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg___wbindgen_string_get_a2a31e16edf96e42 = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_call_abb4ff46ce38be40 = function() { return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_done_62ea16af4ce34b24 = function(arg0) {
        const ret = getObject(arg0).done;
        return ret;
    };
    imports.wbg.__wbg_entries_83c79938054e065f = function(arg0) {
        const ret = Object.entries(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_export4(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_get_6b7bd52aca3f9671 = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_get_af9dab7e9603ea93 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(getObject(arg0), getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_get_with_ref_key_1dc361bd10053bfe = function(arg0, arg1) {
        const ret = getObject(arg0)[getObject(arg1)];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_f3320d2419cd0355 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Map_084be8da74364158 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Map;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_da54ccc9d3e09434 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_51fd9e6422c0a395 = function(arg0) {
        const ret = Array.isArray(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_isSafeInteger_ae7d3f054d55fa16 = function(arg0) {
        const ret = Number.isSafeInteger(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_iterator_27b7c8b35ab3e86b = function() {
        const ret = Symbol.iterator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_length_22ac23eaec9d8053 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_length_d45040a40c570362 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_new_1ba21ce319a06297 = function() {
        const ret = new Object();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_25f239778d6112b9 = function() {
        const ret = new Array();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_6421f6084cc5bc5a = function(arg0) {
        const ret = new Uint8Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_b546ae120718850e = function() {
        const ret = new Map();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_with_length_806b9e5b8290af7c = function(arg0) {
        const ret = new Float64Array(arg0 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_138a17bbf04e926c = function(arg0) {
        const ret = getObject(arg0).next;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_3cfe5c0fe2a4cc53 = function() { return handleError(function (arg0) {
        const ret = getObject(arg0).next();
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_now_69d776cd24f5215b = function() {
        const ret = Date.now();
        return ret;
    };
    imports.wbg.__wbg_prototypesetcall_dfe9b766cdc1f1fd = function(arg0, arg1, arg2) {
        Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
    };
    imports.wbg.__wbg_set_3f1d0b984ed272ed = function(arg0, arg1, arg2) {
        getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
    };
    imports.wbg.__wbg_set_7df433eea03a5c14 = function(arg0, arg1, arg2) {
        getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
    };
    imports.wbg.__wbg_set_efaaf145b9377369 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).set(getObject(arg1), getObject(arg2));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_index_021489b2916af13e = function(arg0, arg1, arg2) {
        getObject(arg0)[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = getObject(arg1).stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_value_57b7b035e117f7ee = function(arg0) {
        const ret = getObject(arg0).value;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_warn_6e567d0d926ff881 = function(arg0) {
        console.warn(getObject(arg0));
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_cast_4625c577ab2ec9ee = function(arg0) {
        // Cast intrinsic for `U64 -> Externref`.
        const ret = BigInt.asUintN(64, arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_cast_9ae0607507abb057 = function(arg0) {
        // Cast intrinsic for `I64 -> Externref`.
        const ret = arg0;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_cast_d6cd19b81560fd6e = function(arg0) {
        // Cast intrinsic for `F64 -> Externref`.
        const ret = arg0;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;



    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('backend_rust_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
