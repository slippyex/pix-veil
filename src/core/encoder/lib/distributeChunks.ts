// src/core/encoder/lib/distributeChunks.ts

import type {
    ChannelSequence,
    IChunk,
    IChunkDistributionInfo,
    IDistributionMapEntry,
    ILogger,
    IUsedPng,
} from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import * as path from 'jsr:/@std/path';
import { config } from '../../../config/index.ts';
import { getCachedImageTones, getRandomPosition } from '../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';
import crypto from 'node:crypto';

/**
 * Distributes the given chunks across multiple PNG images based on their tone capacities.
 *
 * @param {IChunk[]} chunks - An array of chunks to be distributed.
 * @param {Object[]} pngCapacities - An array of objects describing each PNG's capacity and tone information.
 * @param {string} pngCapacities[].file - The PNG file name.
 * @param {number} pngCapacities[].capacity - The capacity of the PNG in bytes.
 * @param {'low' | 'mid' | 'high'} pngCapacities[].tone - The tone of the PNG.
 * @param {string} inputPngFolder - The folder path containing input PNG images.
 * @param {ILogger} logger - Logger instance for logging information.
 * @return {Object} An object containing the distribution map entries and chunk map.
 * @return {IDistributionMapEntry[]} return.distributionMapEntries - Array of distribution map entries that map chunks to PNG images.
 * @return {Map<number, Buffer>} return.chunkMap - Map storing chunk IDs and their corresponding chunk data.
 */
export function createChunkDistributionInformation(
    chunks: IChunk[],
    pngCapacities: { file: string; capacity: number; tone: 'low' | 'mid' | 'high' }[],
    inputPngFolder: string,
    logger: ILogger,
): IChunkDistributionInfo {
    if (logger.verbose) logger.info('Distributing chunks across PNG images based on tones...');

    const distributionMapEntries: IDistributionMapEntry[] = [];
    const usedPngs: Record<string, IUsedPng> = {};

    // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
    for (const png of pngCapacities) {
        usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
    }

    // Initialize usedPositions to track channel usage per PNG using Uint8Array
    const usedPositions: Record<string, Uint8Array> = {};
    const pngToneChannels: Record<string, { low: number; mid: number; high: number }> = {};

    for (const png of pngCapacities) {
        const pngPath = path.join(inputPngFolder, png.file);
        const capacity = getCachedImageTones(pngPath, logger);
        pngToneChannels[png.file] = {
            low: capacity.low,
            mid: capacity.mid,
            high: capacity.high,
        };
        const totalChannels = capacity.low + capacity.mid + capacity.high;
        const byteLength = Math.ceil(totalChannels / 8);
        usedPositions[png.file] = new Uint8Array(byteLength);
    }

    // Sort PNGs by tone priority: low > mid > high
    const sortedPngCapacities = _.orderBy(
        pngCapacities,
        ['tone'],
        ['asc'], // 'low' < 'mid' < 'high'
    );

    // Create a Map to store chunkId to chunk data
    const chunkMap = new Map<number, Buffer>();

    for (const chunk of chunks) {
        let assigned = false;

        for (const png of sortedPngCapacities) {
            // Check if PNG can receive more chunks
            if (usedPngs[png.file].chunkCount >= config.chunksDefinition.maxChunksPerPng) {
                logger.debug(`Reached max chunks for "${png.file}".`);
                continue; // Skip this PNG as it reached the maximum chunk limit
            }

            // Check if PNG has enough capacity for the chunk
            if (usedPngs[png.file].usedCapacity + chunk.data.length > png.capacity) {
                continue; // Not enough capacity, try next PNG
            }

            // Calculate channels needed for this chunk
            const bitsPerChannel = config.bitsPerChannelForDistributionMap;

            // Retrieve tone channel counts
            const { low, mid, high } = pngToneChannels[png.file];

            // Find a non-overlapping position based on weighted channels
            let randomPosition;
            try {
                randomPosition = getRandomPosition(
                    low,
                    mid,
                    high,
                    chunk.data.length,
                    bitsPerChannel,
                    usedPositions[png.file],
                    logger,
                );
            } catch (_error) {
                logger.warn(
                    `Unable to find non-overlapping position for chunk ${chunk.id} in "${png.file}". Trying next PNG.`,
                );
                continue; // Try next PNG
            }

            const { start, end } = randomPosition;

            // Assign the chunk to this PNG
            usedPngs[png.file].usedCapacity += chunk.data.length;
            usedPngs[png.file].chunkCount += 1;
            usedPngs[png.file].chunks.push(chunk);

            // Add to chunkMap
            chunkMap.set(chunk.id, chunk.data);

            // Generate a deterministic channel sequence based on chunk ID
            const channelSequence = generateDeterministicChannelSequence(chunk.id);

            // Create distribution map entry
            distributionMapEntries.push({
                chunkId: chunk.id,
                pngFile: png.file,
                startChannelPosition: start,
                endChannelPosition: end,
                bitsPerChannel: bitsPerChannel,
                channelSequence, // Deterministic sequence
            });

            if (logger.verbose) {
                logger.info(
                    `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with ${bitsPerChannel} bits per channel. Position: ${start}-${end}, Channels: ${
                        channelSequence.join(
                            ', ',
                        )
                    }`,
                );
            }

            assigned = true;
            break; // Move to the next chunk
        }

        if (!assigned) {
            throw new Error(`Not enough capacity to embed chunk ${chunk.id} within the PNG images.`);
        }
    }

    if (logger.verbose) logger.info('Chunks distributed successfully.');

    return { distributionMapEntries, chunkMap };
}

/**
 * Generates a deterministic sequence of channels ('R', 'G', 'B') based on a given chunk identifier.
 *
 * @param {number} chunkId - The identifier of the chunk, used to generate a unique channel sequence.
 * @return {ChannelSequence[]} A deterministic sequence of channels ordered based on the provided chunk identifier.
 */
function generateDeterministicChannelSequence(chunkId: number): ChannelSequence[] {
    // Create a hash from the chunk ID
    const hash = crypto.createHash('sha256').update(chunkId.toString()).digest('hex');

    // Convert hash to a seed value
    const seed = parseInt(hash.substring(0, 8), 16);

    // Use seed to shuffle the channel sequence deterministically
    const channels = ['R', 'G', 'B'] as ChannelSequence[];
    return shuffleArrayDeterministic(channels, seed);
}

/**
 * Shuffles an array of ChannelSequence objects deterministically based on a provided seed using the Fisher-Yates algorithm.
 *
 * @param {ChannelSequence[]} array - The array of ChannelSequence objects to be shuffled.
 * @param {number} seed - The seed to initialize the pseudo-random number generator for deterministic shuffling.
 * @return {ChannelSequence[]} The shuffled array of ChannelSequence objects.
 */
function shuffleArrayDeterministic(array: ChannelSequence[], seed: number): ChannelSequence[] {
    // Simple deterministic shuffle using Fisher-Yates algorithm with seed
    const shuffled = array.slice();
    let currentIndex = shuffled.length;
    let temporaryValue: ChannelSequence;
    let randomIndex: number;

    // Initialize a pseudo-random number generator with the seed
    const prng = mulberry32(seed);

    while (currentIndex !== 0) {
        randomIndex = Math.floor(prng() * currentIndex);
        currentIndex -= 1;

        // Swap
        temporaryValue = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temporaryValue;
    }

    return shuffled;
}

/**
 * Generates a pseudo-random number generator function based on the Mulberry32 algorithm.
 * Mulberry32 is a simple yet effective algorithm for generating pseudo-random numbers.
 *
 * @param {number} a - The seed value used to initialize the generator. Must be a positive integer.
 * @return {function(): number} A function that returns a pseudo-random number between 0 (inclusive) and 1 (exclusive) each time it is called.
 */
function mulberry32(a: number): () => number {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
