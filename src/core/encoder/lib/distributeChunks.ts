// src/core/encoder/lib/distributeChunks.ts

import type { IChunk, IChunkDistributionInfo, IChunkDistributionStrategy, ILogger } from '../../../@types/index.ts';

import { IFileCapacityInfo } from '../../../@types/index.ts';
import { ToneAndCapacityChunkDistributor } from '../../chunking/ToneAndCapacityChunkDistributor.ts';

/**
 * Creates chunk distribution information based on the provided distribution strategy.
 *
 * @param {IChunk[]} chunks - The array of chunks to be distributed.
 * @param {IFileCapacityInfo[]} pngCapacities - The list of file capacities for each PNG in which the chunks need to be distributed.
 * @param {string} inputPngFolder - The folder path where input PNG files are stored.
 * @param {ILogger} logger - The logger instance used for logging information during the distribution process.
 * @param {IChunkDistributionStrategy} [distributionStrategy=new DistributeChunks()] - The strategy used to distribute the chunks. Default is ToneAndCapacityChunkDistributor.
 *
 * @return {Promise<IChunkDistributionInfo>} A promise that resolves to the chunk distribution information.
 */
export async function createChunkDistributionInformation(
    chunks: IChunk[],
    pngCapacities: IFileCapacityInfo[],
    inputPngFolder: string,
    logger: ILogger,
    distributionStrategy: IChunkDistributionStrategy = new ToneAndCapacityChunkDistributor(),
): Promise<IChunkDistributionInfo> {
    return await distributionStrategy.distributeChunks(chunks, pngCapacities, inputPngFolder, logger);
}
