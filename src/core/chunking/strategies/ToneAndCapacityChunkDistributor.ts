// src/core/chunking/strategies/ToneAndCapacityChunkDistributor.ts

import {
    ChannelSequence,
    IChunk,
    IChunkDistributionInfo,
    IChunkDistributionStrategy,
    IDistributionMapEntry,
    IFileCapacityInfo,
    ILogger,
    ImageCapacity,
    IUsedPng,
} from '../../../@types/index.ts';
import { getCachedImageTones, getRandomPosition } from '../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';
import { config } from '../../../config/index.ts';
import * as path from 'jsr:@std/path';
import seedrandom from 'seedrandom';
import { generateChecksum } from '../../../utils/cryptography/crypto.ts';
import { Buffer } from 'node:buffer';

export class ToneAndCapacityChunkDistributor implements IChunkDistributionStrategy {
    /**
     * Distributes chunks of data across PNG images according to their capacity and tone information.
     * The method ensures that chunks are evenly distributed and keeps track of the positions where each chunk is stored.
     *
     * @param {IChunk[]} chunks - An array of chunk objects that contain data to be distributed.
     * @param {IFileCapacityInfo[]} pngCapacities - An array of PNG files along with their tone capacities.
     * @param {string} inputPngFolder - The folder path where input PNG images are stored.
     * @param {ILogger} logger - A logging object for recording distribution progress and debugging information.
     *
     * @return {Promise<IChunkDistributionInfo>} A promise that resolves to an object containing the distribution map entries and a map of chunk IDs to chunk data.
     */
    public async distributeChunks(
        chunks: IChunk[],
        pngCapacities: IFileCapacityInfo[],
        inputPngFolder: string,
        logger: ILogger,
    ): Promise<IChunkDistributionInfo> {
        if (logger.verbose) logger.info('Distributing chunks across PNG images based on tones...');

        const distributionMapEntries: IDistributionMapEntry[] = [];
        const usedPngs: Record<string, IUsedPng> = {};

        // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
        pngCapacities.forEach((png) => {
            usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
        });

        // Initialize usedPositions to track channel usage per PNG using Uint8Array
        const usedPositions: Record<string, Uint8Array> = {};
        const pngToneChannels: Record<string, ImageCapacity> = {};

        for (const png of pngCapacities) {
            const pngPath = path.join(inputPngFolder, png.file);
            const capacity = getCachedImageTones(pngPath, logger);
            pngToneChannels[png.file] = { ...capacity };
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
                        `Unable to find non-overlapping position for chunk ${chunk.chunkId} in "${png.file}". Trying next PNG.`,
                    );
                    continue; // Try next PNG
                }

                const { start, end } = randomPosition;

                // Assign the chunk to this PNG
                usedPngs[png.file].usedCapacity += chunk.data.length;
                usedPngs[png.file].chunkCount += 1;
                usedPngs[png.file].chunks.push(chunk);

                // Add to chunkMap
                chunkMap.set(chunk.chunkId, chunk.data);

                // Generate a deterministic channel sequence based on chunk ID
                const channelSequence = await this.generateDeterministicChannelSequence(chunk.chunkId);

                // Create distribution map entry
                distributionMapEntries.push({
                    chunkId: chunk.chunkId,
                    pngFile: png.file,
                    startChannelPosition: start,
                    endChannelPosition: end,
                    bitsPerChannel: bitsPerChannel,
                    channelSequence, // Deterministic sequence
                });

                if (logger.verbose) {
                    logger.info(
                        `Assigned chunk ${chunk.chunkId} (Length: ${chunk.data.length} bytes) to "${png.file}" with ${bitsPerChannel} bits per channel. Position: ${start}-${end}, Channels: ${
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
                throw new Error(`Not enough capacity to embed chunk ${chunk.chunkId} within the PNG images.`);
            }
        }

        if (logger.verbose) logger.info('Chunks distributed successfully.');

        return { distributionMapEntries, chunkMap };
    }

    /**
     * Generates a deterministic sequence of channel orders based on the given chunk ID.
     *
     * @param {number} chunkId - The identifier of the chunk used to generate the sequence.
     * @return {Promise<ChannelSequence[]>} A promise that resolves to the shuffled channel sequence.
     */
    private async generateDeterministicChannelSequence(chunkId: number): Promise<ChannelSequence[]> {
        // Create a hash from the chunk ID
        const hash = await generateChecksum(Buffer.from('chunk-' + chunkId));
        // Convert hash to a seed value
        const seed = parseInt(hash.substring(0, 8), 16);

        // Use seed to shuffle the channel sequence deterministically
        const channels = ['R', 'G', 'B'] as ChannelSequence[];
        return this.shuffleArrayDeterministic(channels, seed);
    }

    /**
     * Shuffles an array of ChannelSequence objects in a deterministic way using the given seed.
     *
     * @param {ChannelSequence[]} array - The array of ChannelSequence objects to shuffle.
     * @param {number} seed - The seed value used for the pseudo-random number generator.
     * @return {ChannelSequence[]} The shuffled array of ChannelSequence objects.
     */
    private shuffleArrayDeterministic(array: ChannelSequence[], seed: number): ChannelSequence[] {
        const shuffled = array.slice();
        let currentIndex = shuffled.length;
        let temporaryValue: ChannelSequence;
        let randomIndex: number;

        // Initialize a pseudo-random number generator with the seed
        const prng = seedrandom(`chunk-${seed}`);
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
}
