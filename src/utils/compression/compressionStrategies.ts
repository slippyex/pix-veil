// src/utils/compression/CompressionStrategies.ts

import { type CompressionStrategy, SupportedCompressionStrategies } from '../../@types/index.ts';
import { BrotliCompressor } from './strategies/BrotliCompressor.ts';
import { GZipCompressor } from './strategies/GZipCompressor.ts';
import { NoopCompressor } from './strategies/NoopCompressor.ts';

/**
 * Mapping of compression strategy identifiers to their corresponding implementations.
 */
export const CompressionStrategyMap: Record<SupportedCompressionStrategies, CompressionStrategy> = {
    [SupportedCompressionStrategies.Brotli]: new BrotliCompressor(),
    [SupportedCompressionStrategies.GZip]: new GZipCompressor(),
    [SupportedCompressionStrategies.None]: new NoopCompressor(), // No compression
};
