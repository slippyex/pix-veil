// src/core/encoder/lib/splitChunks.ts

import { Buffer } from 'node:buffer';
import type { IChunk, ILogger } from '../../../@types/index.ts';
import { config } from '../../../config/index.ts';

/**
 * Splits encrypted data into chunks based on configuration.
 * @param encryptedData - Encrypted data buffer.
 * @param logger - Logger instance for debugging.
 * @returns Array of chunks.
 */
export function splitDataIntoChunks(encryptedData: Buffer, logger: ILogger): IChunk[] {
    if (logger.verbose) logger.info('Splitting encrypted data into chunks...');
    const chunks: IChunk[] = [];
    let offset = 0;
    let chunkId = 0;

    while (offset < encryptedData.length) {
        const remaining = encryptedData.length - offset;
        const size = Math.min(
            config.chunksDefinition.minChunkSize *
                Math.ceil(
                    Math.random() * (config.chunksDefinition.maxChunkSize / config.chunksDefinition.minChunkSize),
                ),
            remaining,
        );
        const chunkData = encryptedData.subarray(offset, offset + size);
        chunks.push({ id: chunkId++, data: Buffer.from(chunkData) });
        offset += size;
    }

    if (logger.verbose) logger.info(`Total chunks created: ${chunks.length}`);
    return chunks;
}
