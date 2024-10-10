// src/@types/compressionStrategy.ts

export interface CompressionStrategy {
    compress(data: Uint8Array): Uint8Array;
    decompress(data: Uint8Array): Uint8Array;
}

/**
 * Enumeration of supported compression strategies in the order of preference.
 */
export enum SupportedCompressionStrategies {
    Brotli = 'brotli',
    GZip = 'gzip',
    None = 'none',
}
