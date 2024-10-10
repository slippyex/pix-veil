// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { compress as brotliCompress, decompress as brotliDecompress } from 'https://deno.land/x/brotli/mod.ts';
import type { Buffer } from 'node:buffer';
import { uint8ArrayToBuffer } from '../../storage/storageUtils.ts';

/**
 * Class representing a Brotli compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class BrotliCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(brotliCompress(data));
    }
    public decompress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(brotliDecompress(uint8ArrayToBuffer(data)));
    }
}
