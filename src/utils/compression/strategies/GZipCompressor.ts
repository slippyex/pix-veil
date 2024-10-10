// src/utils/compression/strategies/BrotliCompressor.ts

import type { CompressionStrategy } from '../../../@types/index.ts';
import { gunzip, gzip } from 'https://deno.land/x/compress@v0.4.5/mod.ts';
import type { Buffer } from 'node:buffer';
import { bufferToUint8Array, uint8ArrayToBuffer } from '../../storage/storageUtils.ts';

/**
 * The GZipCompressor class implements the CompressionStrategy interface,
 * providing methods for compressing and decompressing data using the GZip algorithm.
 */
export class GZipCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(gzip(bufferToUint8Array(data)));
    }
    public decompress(data: Buffer): Buffer {
        return uint8ArrayToBuffer(gunzip(bufferToUint8Array(data)));
    }
}
