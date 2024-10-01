// src/core/encoder/lib/distributeChunks.ts

import type { ChannelSequence, IChunk, IDistributionMapEntry, ILogger, IUsedPng } from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageUtils.ts';
import path from 'node:path';
import { config } from '../../../config/index.ts';
import { getRandomPosition } from '../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';
import { resetBitmask } from '../../../utils/bitManipulation/bitMaskUtils.ts';

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
    if (logger.verbose) logger.info('Distributing chunks across PNG images...');

    const distributionMapEntries: IDistributionMapEntry[] = [];
    const usedPngs: Record<string, IUsedPng> = {};

    // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
    for (const png of pngCapacities) {
        usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
    }

    // Initialize usedPositions to track channel usage per PNG using Uint8Array
    const usedPositions: Record<string, Uint8Array> = {};
    for (const png of pngCapacities) {
        const pngPath = path.join(inputPngFolder, png.file);
        const capacity = getCachedImageTones(pngPath, logger);
        const totalChannels = (capacity.low + capacity.mid + capacity.high) * 3; // R, G, B
        const byteLength = Math.ceil(totalChannels / 8);
        usedPositions[png.file] = new Uint8Array(byteLength);
    }

    // Shuffle the chunks to randomize distribution
    const shuffledChunks = _.shuffle(chunks);
    // Shuffle the PNGs to ensure random assignment
    const shuffledPngCapacities = _.shuffle(pngCapacities);

    // Create a Map to store chunkId to chunk data
    const chunkMap = new Map<number, Buffer>();

    // Assign chunks in a round-robin fashion to ensure balanced distribution
    let pngIndex = 0;
    while (shuffledChunks.length > 0) {
        const png = shuffledPngCapacities[pngIndex % shuffledPngCapacities.length];
        pngIndex++;

        // Check if PNG can receive more chunks
        if (usedPngs[png.file].chunkCount >= config.chunksDefinition.maxChunksPerPng) {
            resetBitmask(usedPositions[png.file]);
            delete usedPositions[png.file];
            logger.debug(`Cleared usedPositions for "${png.file}" after reaching max chunks.`);

            continue; // Skip this PNG as it reached the maximum chunk limit
        }

        // Check if PNG has enough capacity for the next chunk
        const nextChunk = shuffledChunks[0];
        if (usedPngs[png.file].usedCapacity + nextChunk.data.length > png.capacity) {
            // Not enough capacity, skip to the next PNG
            continue;
        }

        // Calculate channels needed for this chunk
        const bitsPerChannel = config.bitsPerChannelForDistributionMap;
        const channelSequence = _.shuffle(['R', 'G', 'B']) as ChannelSequence[];

        // Find a non-overlapping position
        let randomPosition;
        const cachedImageTones = getCachedImageTones(path.join(inputPngFolder, png.file), logger);
        try {
            randomPosition = getRandomPosition(
                cachedImageTones.low + cachedImageTones.mid + cachedImageTones.high,
                nextChunk.data.length,
                bitsPerChannel,
                usedPositions[png.file],
            );
        } catch (_error) {
            logger.warn(
                `Unable to find non-overlapping position for chunk ${nextChunk.id} in "${png.file}". Skipping this PNG.`,
            );
            continue; // Skip this PNG for this chunk
        }

        const { start, end } = randomPosition;

        // Assign the chunk to this PNG
        const chunk = shuffledChunks.shift()!;
        usedPngs[png.file].usedCapacity += chunk.data.length;
        usedPngs[png.file].chunkCount += 1;
        usedPngs[png.file].chunks.push(chunk);

        // Add to chunkMap
        chunkMap.set(chunk.id, chunk.data);

        // Create distribution map entry
        distributionMapEntries.push({
            chunkId: chunk.id,
            pngFile: png.file,
            startPosition: start, // Now in channels
            endPosition: end, // Now in channels
            bitsPerChannel: bitsPerChannel,
            channelSequence,
        });

        if (logger.verbose) {
            logger.info(
                `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with ${bitsPerChannel} bits per channel. Position: ${start}-${end}`,
            );
        }
    }

    // After distribution, check if all chunks have been assigned
    if (shuffledChunks.length > 0) {
        throw new Error('Not enough capacity to embed all chunks within the PNG images.');
    }

    if (logger.verbose) logger.info('Chunks distributed successfully.');

    // **Clear remaining usedPositions as they are no longer needed**
    for (const png of pngCapacities) {
        if (usedPositions[png.file]) {
            resetBitmask(usedPositions[png.file]);
            delete usedPositions[png.file];
            logger.debug(`Cleared usedPositions for "${png.file}" after distribution.`);
        }
    }

    return { distributionMapEntries, chunkMap };
}
