// src/core/chunking/ToneAndCapacityChunkDistributor.ts

import type {
    ChannelSequence,
    IChunk,
    IChunkDistributionInfo,
    IChunkDistributionStrategy,
    IDistributionMapEntry,
    IFileCapacityInfo,
    ILogger,
    IUsedPng,
} from '../../../../@types/index.ts';
import { getCachedImageTones } from '../../../../utils/imageProcessing/imageHelper.ts';
import _ from 'lodash';
import { config } from '../../../../config/index.ts';
import * as path from 'jsr:@std/path';
import seedrandom from 'seedrandom';
import { generateChecksum } from '../../../../utils/cryptography/crypto.ts';
import { isBitSet, setBit } from '../../../../utils/bitManipulation/bitUtils.ts';
import { weightedRandomChoice } from '../../../../utils/misc/random.ts';

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
        for (const png of pngCapacities) {
            usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
        }

        // Initialize usedPositions to track channel usage per PNG using Uint8Array
        const usedPositions: Record<string, Uint8Array> = {};
        const pngToneChannels: Record<string, { low: number; mid: number; high: number }> = {};

        for (const png of pngCapacities) {
            const pngPath = path.join(inputPngFolder, png.file);
            const capacity = getCachedImageTones(pngPath);
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
        const chunkMap = new Map<number, Uint8Array>();

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
                    randomPosition = this.getNonOverlappingRandomPosition(
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
        const hash = await generateChecksum(new Uint8Array(chunkId));
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

    /**
     * Generates a random position within the provided image capacity that does not overlap with already used positions.
     * Prioritizes channels based on tone weights.
     *
     * @param {number} lowChannels - Number of low-tone channels.
     * @param {number} midChannels - Number of mid-tone channels.
     * @param {number} highChannels - Number of high-tone channels.
     * @param {number} chunkSize - The size of the chunk to hide within the image.
     * @param {number} bitsPerChannel - The number of bits used per channel in the image.
     * @param {Uint8Array} used - A Uint8Array indicating which channels have already been used.
     * @param {ILogger} logger - Logger instance for debugging information.
     * @return {{ start: number, end: number }} An object containing the start and end channel indices for the chunk within the image.
     * @throws {Error} If unable to find a non-overlapping position for the chunk.
     */
    private getNonOverlappingRandomPosition(
        lowChannels: number,
        midChannels: number,
        highChannels: number,
        chunkSize: number,
        bitsPerChannel: number,
        used: Uint8Array,
        logger: ILogger,
    ): { start: number; end: number } {
        const channelsNeeded = Math.ceil((chunkSize * 8) / bitsPerChannel); // Number of channels needed
        const attempts = 100; // Prevent infinite loops

        for (let i = 0; i < attempts; i++) {
            // Weighted random selection based on tone
            const tone = weightedRandomChoice(
                [
                    { weight: 4, tone: 'low' as const },
                    { weight: 2, tone: 'mid' as const },
                    { weight: 1, tone: 'high' as const },
                ],
                logger,
            );

            let channelIndex;
            switch (tone) {
                case 'low':
                    channelIndex = Math.floor(Math.random() * lowChannels);
                    break;
                case 'mid':
                    channelIndex = Math.floor(Math.random() * midChannels);
                    break;
                case 'high':
                    channelIndex = Math.floor(Math.random() * highChannels);
                    break;
            }

            // Calculate absolute channel position based on tone
            let absoluteChannel;
            switch (tone) {
                case 'low':
                    absoluteChannel = channelIndex;
                    break;
                case 'mid':
                    absoluteChannel = lowChannels + channelIndex;
                    break;
                case 'high':
                    absoluteChannel = lowChannels + midChannels + channelIndex;
                    break;
            }

            const start = absoluteChannel;
            const end = start + channelsNeeded;

            // Ensure end does not exceed total channels
            const totalChannels = lowChannels + midChannels + highChannels;
            if (end > totalChannels) {
                continue; // Try another position
            }

            // Check for overlap
            let overlap = false;
            for (let j = start; j < end; j++) {
                if (isBitSet(used, j)) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                // Mark positions as used
                for (let j = start; j < end; j++) {
                    setBit(used, j);
                }
                logger.debug(`Selected channels ${start}-${end} based on tone "${tone}".`);
                return { start, end };
            }
        }

        throw new Error('Unable to find a non-overlapping position for the chunk.');
    }
}
