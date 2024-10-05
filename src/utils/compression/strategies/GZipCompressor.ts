// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/compressionStrategy.ts';

import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

/**
 * Class representing a GZip compression strategy.
 *
 * This class provides methods to compress and decompress data using the Brotli algorithm.
 */
export class GZipCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return zlib.gzipSync(data);
    }
    public decompress(data: Buffer): Buffer {
        return zlib.gunzipSync(data);
    }
}
