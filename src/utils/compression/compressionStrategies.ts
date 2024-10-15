// src/utils/compression/CompressionStrategies.ts

import { BrotliCompressor } from './strategies/BrotliCompressor.ts';
import { GZipCompressor } from './strategies/GZipCompressor.ts';
import { CompressionStrategy } from '../../@types/index.ts';
import { NoopCompressor } from './strategies/NoopCompressor.ts';

/**
 * Enumeration of supported compression strategies in the order of preference.
 */
export enum SupportedCompressionStrategies {
    Brotli = 'brotli',
    GZip = 'gzip',
    None = 'none',
}

/**
 * Mapping of compression strategy identifiers to their corresponding implementations.
 */
export const CompressionStrategyMap: Record<SupportedCompressionStrategies, CompressionStrategy> = {
    [SupportedCompressionStrategies.Brotli]: new BrotliCompressor(),
    [SupportedCompressionStrategies.GZip]: new GZipCompressor(),
    [SupportedCompressionStrategies.None]: new NoopCompressor(), // No compression
};
