// src/core/encoder/lib/splitChunks.ts
import type { IChunk, ILogger } from '../../../@types/index.ts';
import { Buffer } from 'node:buffer';
import { config } from '../../../config/index.ts';

/**
 * Splits encrypted data into chunks based on a random size within specified min and max chunk sizes.
 *
 * @param {Buffer} encryptedData - The data to be split into chunks.
 * @param {ILogger} logger - The logger object to output verbose information about the splitting process.
 * @return {IChunk[]} An array of chunks with each chunk containing a portion of the encrypted data.
 */
export function splitDataIntoChunks(encryptedData: Buffer, logger: ILogger): IChunk[] {
    if (logger.verbose) logger.info('Splitting encrypted data into chunks...');

    const chunks: IChunk[] = [];
    let offset = 0;
    let chunkId = 0;

    while (offset < encryptedData.length) {
        const remaining = encryptedData.length - offset;
        const size = calculateChunkSize(remaining);
        const chunkData = encryptedData.subarray(offset, offset + size);

        chunks.push({ id: chunkId++, data: Buffer.from(chunkData) });
        offset += size;
    }

    if (logger.verbose) logger.info(`Total chunks created: ${chunks.length}`);
    return chunks;
}

/**
 * Calculates the size of the next chunk.
 *
 * @param {number} remaining - The remaining size of the data to be chunked.
 * @return {number} - The calculated chunk size.
 */
function calculateChunkSize(remaining: number): number {
    return Math.min(
        config.chunksDefinition.minChunkSize * Math.ceil(
            Math.random() * (config.chunksDefinition.maxChunkSize / config.chunksDefinition.minChunkSize),
        ),
        remaining,
    );
}
