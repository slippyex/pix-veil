// src/utils/misc/compressUtils.ts

import zlib from 'zlib';

/**
 * Compresses the input buffer using Brotli compression algorithm.
 *
 * @param input - The buffer to be compressed.
 * @return The compressed buffer.
 */
export function compressBuffer(input: Buffer): Buffer {
    return zlib.brotliCompressSync(input);
}

/**
 * Decompresses a given buffer using Brotli decompression.
 *
 * @param input - The buffer containing compressed data.
 * @return The decompressed buffer.
 */
export function decompressBuffer(input: Buffer): Buffer {
    return zlib.brotliDecompressSync(input);
}
