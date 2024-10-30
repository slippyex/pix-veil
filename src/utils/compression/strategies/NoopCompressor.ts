// src/utils/compression/strategies/NoopCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';

/**
 * The NoneCompressor class provides an implementation of the CompressionStrategy
 * interface where no compression or decompression is applied to the data.
 *
 * Methods:
 * - compress: Returns the input data unchanged.
 * - decompress: Returns the input data unchanged.
 */
export class NoopCompressor implements CompressionStrategy {
    public compress(data: Uint8Array): Uint8Array {
        return data;
    }
    public decompress(data: Uint8Array): Uint8Array {
        return data;
    }
}
