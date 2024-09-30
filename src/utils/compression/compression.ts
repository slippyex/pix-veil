// src/utils/compression/compression.ts

import { Buffer } from 'node:buffer';
import { BrotliCompressor } from './strategies/BrotliCompressor.ts';

/**
 * Compresses the given buffer using Brotli compression algorithm.
 *
 * @param {Buffer} input - The buffer that needs to be compressed.
 * @returns {Buffer} - The compressed buffer.
 */
export function compressBuffer(input: Buffer): Buffer {
    const compressor = new BrotliCompressor();
    return compressor.compress(input);
}

/**
 * Decompresses a given buffer using the Brotli algorithm.
 *
 * @param {Buffer} input - The compressed buffer that needs to be decompressed.
 * @returns {Buffer} The decompressed buffer.
 */
export function decompressBuffer(input: Buffer): Buffer {
    const compressor = new BrotliCompressor();
    return compressor.decompress(input);
}
