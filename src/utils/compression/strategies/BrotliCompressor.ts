// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { compress as brotliCompress, decompress as brotliDecompress } from 'https://deno.land/x/brotli@0.1.7/mod.ts';
import type { Buffer } from 'node:buffer';
import { uint8ArrayToBuffer } from '../../storage/storageUtils.ts';

/**
 * Class representing a Brotli compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class BrotliCompressor implements CompressionStrategy {
    /**
     * Compresses the given data using the Brotli algorithm.
     *
     * @param {Buffer} data - The buffer containing data to be compressed.
     * @returns {Buffer} - The buffer containing the compressed data.
     */
    public compress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(brotliCompress(data));
    }

    /**
     * Decompresses a given Buffer object using Brotli decompression algorithm.
     *
     * @param {Buffer} data - The compressed data as a Buffer object.
     * @returns {Buffer} - The decompressed data as a Buffer object.
     */
    public decompress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(brotliDecompress(uint8ArrayToBuffer(data)));
    }
}
