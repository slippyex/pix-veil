// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/compressionStrategy.ts';

import type { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

/**
 * The GZipCompressor class implements the CompressionStrategy interface,
 * providing methods for compressing and decompressing data using the GZip algorithm.
 */
export class GZipCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return zlib.gzipSync(data);
    }
    public decompress(data: Buffer): Buffer {
        return zlib.gunzipSync(data);
    }
}
