// src/core/encoder/lib/distributeChunks.ts

import { Buffer } from 'node:buffer';
import type { ChannelSequence, IChunk, IDistributionMapEntry, ILogger, IUsedPng } from '../../../@types/index.ts';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageUtils.ts';
import path from 'node:path';
import { config } from '../../../config/index.ts';
import { getRandomPosition } from '../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';

/**
 * Distributes chunks across PNG images and creates a mapping of chunkId to chunk data.
 * @param chunks - Array of chunks to distribute.
 * @param pngCapacities - Array of PNG capacities.
 * @param inputPngFolder - Path to the folder containing PNG images.
 * @param logger - Logger instance for debugging.
 * @returns Object containing distribution map entries and a chunk map.
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

    // Initialize usedPositions to track channel usage per PNG
    const usedPositions: Record<string, boolean[]> = {};
    for (const png of pngCapacities) {
        const pngPath = path.join(inputPngFolder, png.file);
        const capacity = getCachedImageTones(pngPath, logger);
        const totalChannels = (capacity.low + capacity.mid + capacity.high) * 3; // R, G, B
        usedPositions[png.file] = new Array(totalChannels).fill(false);
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
    return { distributionMapEntries, chunkMap };
}
