// src/utils/compression/compression.ts

import { Buffer } from 'node:buffer';
import { BrotliCompressor } from './strategies/BrotliCompressor.ts';
import { CompressionStrategy } from '../../@types/compressionStrategy.ts';

/**
 * Compresses a given input buffer using a specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be compressed.
 * @param {CompressionStrategy} [compressor=new BrotliCompressor()] - An instance of a compression strategy to use for compressing the input buffer.
 *                                                                    Defaults to BrotliCompressor.
 * @returns {Buffer} The compressed buffer.
 */
export function compressBuffer(input: Buffer, compressor: CompressionStrategy = new BrotliCompressor()): Buffer {
    return compressor.compress(input);
}

/**
 * Decompresses the given input buffer using the specified compression strategy.
 *
 * @param {Buffer} input - The buffer to be decompressed.
 * @param {CompressionStrategy} [compressor=new BrotliCompressor()] - The decompression strategy to use. Defaults to BrotliCompressor.
 * @returns {Buffer} The decompressed buffer.
 */
export function decompressBuffer(input: Buffer, compressor: CompressionStrategy = new BrotliCompressor()): Buffer {
    return compressor.decompress(input);
}
