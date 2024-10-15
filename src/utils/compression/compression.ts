// src/utils/compression/compression.ts

import { Buffer } from 'node:buffer';
import { CompressionStrategyMap, SupportedCompressionStrategies } from './compressionStrategies.ts';

/**
 * Compresses the given buffer using the specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be compressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The strategy to use for compression.
 * @returns {Buffer} - The compressed buffer, or the original buffer if no valid strategy is provided.
 */
export function compressBuffer(input: Buffer, compressionStrategy: SupportedCompressionStrategies): Buffer {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.compress(input);
}

/**
 * Decompresses a given buffer using the specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be decompressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The compression strategy to use for decompression (e.g., Brotli or GZip).
 * @returns {Buffer} The decompressed buffer.
 */
export function decompressBuffer(input: Buffer, compressionStrategy: SupportedCompressionStrategies): Buffer {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.decompress(input);
}
