import type { CompressionStrategy } from '../../../@types/index.ts';
import type { Buffer } from 'node:buffer';

/**
 * The NoneCompressor class provides an implementation of the CompressionStrategy
 * interface where no compression or decompression is applied to the data.
 *
 * Methods:
 * - compress: Returns the input data unchanged.
 * - decompress: Returns the input data unchanged.
 */
export class NoopCompressor implements CompressionStrategy {
    public compress(data: Buffer): Buffer {
        return data;
    }
    public decompress(data: Buffer): Buffer {
        return data;
    }
}
