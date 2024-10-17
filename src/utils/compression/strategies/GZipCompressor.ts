// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { gunzip, gzip } from 'https://deno.land/x/compress@v0.4.5/mod.ts';
import type { Buffer } from 'node:buffer';
import { bufferToUint8Array, uint8ArrayToBuffer } from '../../storage/storageUtils.ts';

/**
 * The GZipCompressor class implements the CompressionStrategy interface,
 * providing methods for compressing and decompressing data using the GZip algorithm.
 */
export class GZipCompressor implements CompressionStrategy {
    /**
     * Compresses the given data using gzip compression.
     *
     * @param {Buffer} data - The input data to be compressed.
     * @returns {Buffer} The compressed data.
     */
    public compress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(gzip(bufferToUint8Array(data)));
    }

    /**
     * Decompresses the given buffer using gzip compression.
     *
     * @param {Buffer} data - The buffer containing compressed data.
     * @returns {Buffer} - The decompressed data as a buffer.
     */
    public decompress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(gunzip(bufferToUint8Array(data)));
    }
}
