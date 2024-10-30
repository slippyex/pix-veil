// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { compress as brotliCompress, decompress as brotliDecompress } from 'https://deno.land/x/brotli@0.1.7/mod.ts';

/**
 * Class representing a Brotli compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class BrotliCompressor implements CompressionStrategy {
    /**
     * Compresses the given data using the Brotli algorithm.
     *
     * @param {Uint8Array} data - The buffer containing data to be compressed.
     * @returns {Uint8Array} - The buffer containing the compressed data.
     */
    public compress(data: Uint8Array): Uint8Array {
        return brotliCompress(data);
    }

    /**
     * Decompresses a given Uint8Array object using Brotli decompression algorithm.
     *
     * @param {Uint8Array} data - The compressed data as a Buffer object.
     * @returns {Uint8Array} - The decompressed data as a Buffer object.
     */
    public decompress(data: Uint8Array): Uint8Array {
        return brotliDecompress(data);
    }
}
