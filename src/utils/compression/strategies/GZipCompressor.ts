// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { gunzip, gzip } from 'https://deno.land/x/compress@v0.4.5/mod.ts';

/**
 * The GZipCompressor class implements the CompressionStrategy interface,
 * providing methods for compressing and decompressing data using the GZip algorithm.
 */
export class GZipCompressor implements CompressionStrategy {
    /**
     * Compresses the given data using gzip compression.
     *
     * @param {Uint8Array} data - The input data to be compressed.
     * @returns {Uint8Array} The compressed data.
     */
    public compress(data: Uint8Array): Uint8Array {
        return gzip(data);
    }

    /**
     * Decompresses the given buffer using gzip compression.
     *
     * @param {Uint8Array} data - The Uint8Array containing compressed data.
     * @returns {Uint8Array} - The decompressed data as an Uint8Array.
     */
    public decompress(data: Uint8Array): Uint8Array {
        return gunzip(data);
    }
}
