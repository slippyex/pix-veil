// src/utils/compression/compression.ts

import { CompressionStrategyMap, SupportedCompressionStrategies } from './compressionStrategies.ts';

/**
 * Compresses the given buffer using the specified compression strategy.
 *
 * @param {Uint8Array} input - The buffer to be compressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The strategy to use for compression.
 * @returns {Uint8Array} - The compressed buffer, or the original buffer if no valid strategy is provided.
 */
export function compressBuffer(input: Uint8Array, compressionStrategy: SupportedCompressionStrategies): Uint8Array {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.compress(input);
}

/**
 * Decompresses a given buffer using the specified compression strategy.
 *
 * @param {Uint8Array} input - The buffer to be decompressed.
 * @param {SupportedCompressionStrategies} compressionStrategy - The compression strategy to use for decompression (e.g., Brotli or GZip).
 * @returns {Uint8Array} The decompressed buffer.
 */
export function decompressBuffer(input: Uint8Array, compressionStrategy: SupportedCompressionStrategies): Uint8Array {
    const compressor = CompressionStrategyMap[compressionStrategy];
    return compressor.decompress(input);
}
