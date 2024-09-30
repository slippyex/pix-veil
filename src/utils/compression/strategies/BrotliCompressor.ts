// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/compressionStrategy.ts';

import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

/**
 * Class representing a Brotli compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class BrotliCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return zlib.brotliCompressSync(data);
    }
    public decompress(data: Buffer): Buffer {
        return zlib.brotliDecompressSync(data);
    }
}
