// src/utils/compression/strategies/BrotliCompressor.ts

import { Buffer } from 'node:buffer';
import { CompressionStrategy } from '../../../@types/compressionStrategy.ts';
import zlib from 'node:zlib';

export class BrotliCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return zlib.brotliCompressSync(data);
    }
    public decompress(data: Buffer): Buffer {
        return zlib.brotliDecompressSync(data);
    }
}
