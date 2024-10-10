// src/utils/compression/compression.ts

import { Buffer } from 'node:buffer';
import { CompressionStrategyMap } from './compressionStrategies.ts';
import { SupportedCompressionStrategies } from '../../@types/index.ts';

/**
 * Compresses the given buffer using the specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be compressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The strategy to use for compression.
 * @returns {Buffer} - The compressed buffer, or the original buffer if no valid strategy is provided.
 */
export function compressBuffer(input: Uint8Array, compressionStrategy: SupportedCompressionStrategies): Buffer {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.compress(input) as Buffer;
}

/**
 * Decompresses a given buffer using the specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be decompressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The compression strategy to use for decompression (e.g., Brotli or GZip).
 * @returns {Buffer} The decompressed buffer.
 */
export function decompressBuffer(input: Uint8Array, compressionStrategy: SupportedCompressionStrategies): Buffer {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.decompress(input) as Buffer;
}
