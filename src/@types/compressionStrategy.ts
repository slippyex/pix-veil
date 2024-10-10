// src/@types/compressionStrategy.ts

import type { Buffer } from 'node:buffer';

export interface CompressionStrategy {
    compress(data: Buffer): Buffer;
    decompress(data: Buffer): Buffer;
}

/**
 * Enumeration of supported compression strategies in the order of preference.
 */
export enum SupportedCompressionStrategies {
    Brotli = 'brotli',
    GZip = 'gzip',
    None = 'none',
}
