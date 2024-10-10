// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { compress as brotliCompress, decompress as brotliDecompress } from 'https://deno.land/x/brotli/mod.ts';

/**
 * Class representing a Brotli compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class BrotliCompressor implements CompressionStrategy {
    public compress(data: Uint8Array): Uint8Array {
        return brotliCompress(data);
    }
    public decompress(data: Uint8Array): Uint8Array {
        return brotliDecompress(data);
    }
}
