// src/@types/chunkingStrategy.ts

import { ILogger } from './logging.ts';

import { IChunk, IFileCapacityInfo } from './processing.ts';
import { IChunkDistributionInfo } from './distribution.ts';

/**
 * Interface for Chunk Distribution Strategies.
 */
export interface IChunkDistributionStrategy {
    /**
     * Distributes data chunks across PNG images based on the specific strategy.
     *
     * @param {IChunk[]} chunks - The chunks to be distributed.
     * @param {IFileCapacityInfo[]} existingEntries - Existing image capacities.
     * @param {string} inputPngFolder - Folder containing input PNG images.
     * @param {ILogger} logger - Logger for logging information.
     * @return {Promise<IChunkDistributionInfo>} - Updated distribution map entries and chunk map.
     */
    distributeChunks(
        chunks: IChunk[],
        existingEntries: IFileCapacityInfo[],
        inputPngFolder: string,
        logger: ILogger,
    ): Promise<IChunkDistributionInfo>;
}
