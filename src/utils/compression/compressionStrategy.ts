// src/utils/compression/compressionStrategy.ts

import type { Buffer } from 'node:buffer';

export interface CompressionStrategy {
    compress(data: Buffer): Buffer;
    decompress(data: Buffer): Buffer;
}
