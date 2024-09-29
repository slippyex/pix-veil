// src/utils/compression/compression.ts

import { Buffer } from 'node:buffer';
import { BrotliCompressor } from './strategies/BrotliCompressor.ts';

/**
 * Compresses the input buffer using Brotli compression algorithm.
 *
 * @param input - The buffer to be compressed.
 * @return The compressed buffer.
 */
export function compressBuffer(input: Buffer): Buffer {
    const compressor = new BrotliCompressor();
    return compressor.compress(input);
}

/**
 * Decompresses a given buffer using Brotli decompression.
 *
 * @param input - The buffer containing compressed data.
 * @return The decompressed buffer.
 */
export function decompressBuffer(input: Buffer): Buffer {
    const compressor = new BrotliCompressor();
    return compressor.decompress(input);
}
