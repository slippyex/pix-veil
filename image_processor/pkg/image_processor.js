

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * Loads image data from PNG bytes, processes it, and returns assembled image data.
 * @param {Uint8Array} png_data
 * @returns {AssembledImageData}
 */
export function load_image_assembled(png_data) {
    const ptr0 = passArray8ToWasm0(png_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.load_image_assembled(ptr0, len0);
    return AssembledImageData.__wrap(ret);
}

/**
 * Writes image data to PNG bytes with specified configurations.
 * @param {Uint8Array} raw_data
 * @param {number} width
 * @param {number} height
 * @param {number} compression_level
 * @returns {Uint8Array}
 */
export function write_image_data(raw_data, width, height, compression_level) {
    const ptr0 = passArray8ToWasm0(raw_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.write_image_data(ptr0, len0, width, height, compression_level);
    return ret;
}

const AssembledImageDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_assembledimagedata_free(ptr >>> 0, 1));
/**
 * Assembled image data including raw pixels and metadata.
 */
export class AssembledImageData {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AssembledImageData.prototype);
        obj.__wbg_ptr = ptr;
        AssembledImageDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AssembledImageDataFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_assembledimagedata_free(ptr, 0);
    }
    /**
     * Retrieves the raw image data as a Uint8Array.
     * @returns {Uint8Array}
     */
    get data() {
        const ret = wasm.assembledimagedata_data(this.__wbg_ptr);
        return ret;
    }
    /**
     * Retrieves the image metadata.
     * @returns {Metadata}
     */
    get metadata() {
        const ret = wasm.assembledimagedata_metadata(this.__wbg_ptr);
        return Metadata.__wrap(ret);
    }
}

const MetadataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_metadata_free(ptr >>> 0, 1));
/**
 * Metadata about the image.
 */
export class Metadata {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Metadata.prototype);
        obj.__wbg_ptr = ptr;
        MetadataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MetadataFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_metadata_free(ptr, 0);
    }
    /**
     * Gets the width of the image.
     * @returns {number}
     */
    get width() {
        const ret = wasm.metadata_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Gets the height of the image.
     * @returns {number}
     */
    get height() {
        const ret = wasm.metadata_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Gets the number of channels in the image.
     * @returns {number}
     */
    get channels() {
        const ret = wasm.metadata_channels(this.__wbg_ptr);
        return ret;
    }
}

const imports = {
    __wbindgen_placeholder__: {
        __wbg_buffer_ccaed51a635d8a2d: function(arg0) {
            const ret = arg0.buffer;
            return ret;
        },
        __wbg_newwithbyteoffsetandlength_7e3eb787208af730: function(arg0, arg1, arg2) {
            const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_new_fec2611eb9180f95: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbindgen_throw: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_memory: function() {
            const ret = wasm.memory;
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_export_0;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
            ;
        },
    },

};

const wasm_url = new URL('image_processor_bg.wasm', import.meta.url);
let wasmCode = '';
switch (wasm_url.protocol) {
    case 'file:':
    wasmCode = await Deno.readFile(wasm_url);
    break
    case 'https:':
    case 'http:':
    wasmCode = await (await fetch(wasm_url)).arrayBuffer();
    break
    default:
    throw new Error(`Unsupported protocol: ${wasm_url.protocol}`);
}

const wasmInstance = (await WebAssembly.instantiate(wasmCode, imports)).instance;
const wasm = wasmInstance.exports;
export const __wasm = wasm;

wasm.__wbindgen_start();

