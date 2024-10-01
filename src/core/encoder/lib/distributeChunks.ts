// src/core/encoder/lib/distributeChunks.ts

import type { ChannelSequence, IChunk, IDistributionMapEntry, ILogger, IUsedPng } from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageUtils.ts';
import path from 'node:path';
import { config } from '../../../config/index.ts';
import { getRandomPosition } from '../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';

/**
 * Distributes given data chunks across PNG files based on their capacities.
 *
 * @param {IChunk[]} chunks - Array of data chunks to be distributed.
 * @param {Object[]} pngCapacities - Array of objects representing PNG files and their capacities.
 * @param {string} pngCapacities[].file - The file name of the PNG.
 * @param {number} pngCapacities[].capacity - The capacity of the PNG in bytes.
 * @param {string} inputPngFolder - Path to the folder containing input PNG files.
 * @param {ILogger} logger - Logger for logging informational and error messages.
 * @return {Object} The distribution result.
 * @return {IDistributionMapEntry[]} return.distributionMapEntries - The mapping of chunks to PNG files.
 * @return {Map<number, Buffer>} return.chunkMap - The mapping of chunk IDs to chunk data.
 */
export function distributeChunksAcrossPngs(
    chunks: IChunk[],
    pngCapacities: { file: string; capacity: number }[],
    inputPngFolder: string,
    logger: ILogger,
): { distributionMapEntries: IDistributionMapEntry[]; chunkMap: Map<number, Buffer> } {
    if (logger.verbose) logger.info('Distributing chunks across PNG images with even distribution and capacity verification...');

    const totalRequiredCapacity = chunks.reduce((acc, chunk) => acc + chunk.data.length, 0);
    const totalAvailableCapacity = pngCapacities.reduce((acc, png) => acc + png.capacity, 0);

    logger.debug(`Total required capacity: ${totalRequiredCapacity} bytes.`);
    logger.debug(`Total available capacity: ${totalAvailableCapacity} bytes.`);

    if (totalRequiredCapacity > totalAvailableCapacity) {
        throw new Error(
            `Insufficient total capacity: Required ${totalRequiredCapacity} bytes, but only ${totalAvailableCapacity} bytes are available across ${pngCapacities.length} PNGs.`,
        );
    }

    // Calculate the proportion of capacity for each PNG
    const capacityProportions = pngCapacities.map(png => ({
        file: png.file,
        capacity: png.capacity,
        proportion: png.capacity / totalAvailableCapacity,
    }));

    // Determine the number of chunks each PNG should handle based on capacity proportion
    const chunksPerPng = capacityProportions.map(png => Math.floor(png.proportion * chunks.length));

    // Adjust chunksPerPng to ensure all chunks are allocated
    const allocatedChunks = chunksPerPng.reduce((acc, num) => acc + num, 0);
    const remainingChunks = chunks.length - allocatedChunks;

    // Distribute remaining chunks one by one to PNGs with the highest remaining capacity proportion
    if (remainingChunks > 0) {
        const sortedPngs = capacityProportions
            .map((png, index) => ({ ...png, index }))
            .sort((a, b) => b.proportion - a.proportion);

        for (let i = 0; i < remainingChunks; i++) {
            chunksPerPng[sortedPngs[i % sortedPngs.length].index] += 1;
        }
    }

    // Create a queue of PNGs with their allocated chunk counts
    const pngQueue = pngCapacities.map((png, index) => ({
        file: png.file,
        capacity: png.capacity,
        allocatedChunks: chunksPerPng[index],
    }));

    // Initialize tracking structures
    const distributionMapEntries: IDistributionMapEntry[] = [];
    const chunkMap = new Map<number, Buffer>();
    const usedPngs: Record<string, IUsedPng> = {};

    for (const png of pngQueue) {
        usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
    }

    // Initialize a bitmask for each PNG to track used channels
    const usedBitmasks: Record<string, Uint8Array> = {};
    pngCapacities.forEach(png => {
        const imageTones = getCachedImageTones(path.join(inputPngFolder, png.file), logger);
        const imageCapacity = imageTones.low + imageTones.mid + imageTones.high;
        usedBitmasks[png.file] = new Uint8Array(Math.ceil(imageCapacity / 8));
    });

    // Shuffle chunks to randomize injection within allocated PNGs
    const shuffledChunks = _.shuffle(chunks);

    // Assign chunks to PNGs based on allocatedChunks
    for (const png of pngQueue) {
        const allocated = png.allocatedChunks;
        for (let i = 0; i < allocated; i++) {
            const chunk = shuffledChunks.pop();
            if (!chunk) break; // Safeguard, though total capacity is verified

            if (usedPngs[png.file].usedCapacity + chunk.data.length > png.capacity) {
                throw new Error(
                    `PNG file "${png.file}" does not have enough capacity for chunk ID ${chunk.id}. Required: ${chunk.data.length} bytes, Available: ${png.capacity - usedPngs[png.file].usedCapacity} bytes.`,
                );
            }

            // Calculate channels needed based on bitsPerChannel
            const bitsPerChannel = config.bitsPerChannelForDistributionMap;
            // Removed the unused 'channelsNeeded' variable

            // Find a suitable position in the PNG
            const imageCapacity = getCachedImageTones(path.join(inputPngFolder, png.file), logger).low +
                getCachedImageTones(path.join(inputPngFolder, png.file), logger).mid +
                getCachedImageTones(path.join(inputPngFolder, png.file), logger).high;

            let randomPosition;
            try {
                randomPosition = getRandomPosition(
                    imageCapacity,
                    chunk.data.length,
                    bitsPerChannel,
                    usedBitmasks[png.file], // Pass the bitmask
                );
            } catch (error) {
                throw new Error(
                    `Unable to find a non-overlapping position for chunk ID ${chunk.id} in PNG "${png.file}". Error: ${(error as Error).message}`,
                );
            }

            const { start, end } = randomPosition;

            // Assign the chunk
            distributionMapEntries.push({
                chunkId: chunk.id,
                pngFile: png.file,
                startPosition: start,
                endPosition: end,
                bitsPerChannel: bitsPerChannel,
                channelSequence: _.shuffle(['R', 'G', 'B']) as ChannelSequence[],
            });

            // Update tracking
            usedPngs[png.file].usedCapacity += chunk.data.length;
            usedPngs[png.file].chunkCount += 1;
            usedPngs[png.file].chunks.push(chunk);

            // Add to chunkMap
            chunkMap.set(chunk.id, chunk.data);

            logger.debug(
                `Assigned chunk ${chunk.id} (${chunk.data.length} bytes) to "${png.file}" at channels ${start}-${end}.`,
            );
        }
    }

    // Final verification to ensure all chunks are assigned
    if (shuffledChunks.length > 0) {
        throw new Error(
            `Not all chunks could be assigned. Remaining chunks count: ${shuffledChunks.length}. This should not happen as total capacity was verified.`,
        );
    }

    logger.info('Chunks distributed successfully across PNG images.');

    // Logging Distribution Summary
    const distributionSummary = pngQueue.map(png => ({
        pngFile: png.file,
        allocatedChunks: png.allocatedChunks,
        usedCapacity: usedPngs[png.file].usedCapacity,
        remainingCapacity: png.capacity - usedPngs[png.file].usedCapacity,
    }));

    logger.info('Distribution Summary:');
    distributionSummary.forEach(summary => {
        logger.info(
            `PNG "${summary.pngFile}": Allocated Chunks = ${summary.allocatedChunks}, Used Capacity = ${summary.usedCapacity} bytes, Remaining Capacity = ${summary.remainingCapacity} bytes.`,
        );
    });

    return { distributionMapEntries, chunkMap };
}
