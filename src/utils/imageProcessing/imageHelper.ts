// src/utils/imageProcessing/imageHelper.ts

import type { IAssembledImageData, ILogger, ImageCapacity, ImageToneCache, OutputInfo } from '../../@types/index.ts';
import { isBitSet, setBit } from '../bitManipulation/bitUtils.ts';
import { readDirectory } from '../storage/storageUtils.ts';
import * as path from 'jsr:/@std/path';
import { getEntryFromCache, setCacheEntry } from '../cache/cacheHelper.ts';
import { loadImageData } from '../../core/imageProcessing/processor.ts';

/**
 * In-memory cache for image tones.
 */
export const toneCache: ImageToneCache = {};
const imageMap = new Map<string, IAssembledImageData>();

/**
 * Retrieves or loads an image from a specified PNG path.
 * If the image is not already cached, it loads the image data and caches it.
 *
 * @param {string} pngPath - The file path to the PNG image.
 * @return {Promise<IAssembledImageData | undefined>} - A promise that resolves to the image data if successful, or undefined if not.
 */
export async function getImage(pngPath: string): Promise<IAssembledImageData | undefined> {
    if (!imageMap.has(pngPath)) {
        const data = await loadImageData(pngPath);
        imageMap.set(pngPath, data);
    }
    return imageMap.get(pngPath);
}

/**
 * Determines a random non-overlapping position in the channel range for the provided chunk size.
 *
 * @param {number} lowChannels - The number of low tone channels.
 * @param {number} midChannels - The number of mid tone channels.
 * @param {number} highChannels - The number of high tone channels.
 * @param {number} chunkSize - Size of the chunk to be positioned.
 * @param {number} bitsPerChannel - Number of bits used per channel.
 * @param {Uint8Array} used - Array representing used channels with bits set for used positions.
 * @param {ILogger} logger - Logger instance for debug information.
 *
 * @return {{start: number, end: number}} An object containing the start and end positions of the selected channels.
 *
 * @throws Will throw an error if unable to find a non-overlapping position for the chunk.
 */
export function getRandomPosition(
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

/**
 * Retrieves the image capacity from Deno KV using the unique cache key.
 *
 * @param {string} imagePath - The full path to the PNG image.
 * @param {number} fileSize - The size of the PNG image in bytes.
 * @return {Promise<ImageCapacity | null>} - The image capacity or null if not found.
 */
async function retrieveImageCapacity(imagePath: string, fileSize: number): Promise<ImageCapacity | null> {
    const key = getToneCacheKey(imagePath, fileSize);
    try {
        return await getEntryFromCache<ImageCapacity>('pix-veil', key);
    } catch (error) {
        // Log the error and return null to indicate a cache miss
        console.error(`Failed to retrieve cache for "${imagePath}": ${(error as Error).message}`);
        return null;
    }
}

/**
 * Constructs a unique cache key using the full path and file size.
 *
 * @param {string} imagePath - The full path to the PNG image.
 * @param {number} fileSize - The size of the PNG image in bytes.
 * @return {string} - The constructed cache key.
 */
function getToneCacheKey(imagePath: string, fileSize: number): string {
    return `${imagePath}:${fileSize}`;
}

/**
 * Stores the image capacity in Deno KV using the unique cache key.
 *
 * @param {string} imagePath - The full path to the PNG image.
 * @param {number} fileSize - The size of the PNG image in bytes.
 * @param {ImageCapacity} capacity - The image capacity data.
 * @return {Promise<void>} - Resolves when the data is stored.
 */
async function storeImageCapacity(imagePath: string, fileSize: number, capacity: ImageCapacity): Promise<void> {
    const key = getToneCacheKey(imagePath, fileSize);
    try {
        await setCacheEntry('pix-veil', key, capacity);
    } catch (error) {
        console.error(`Failed to store cache for "${imagePath}": ${(error as Error).message}`);
    }
}

/**
 * Analyzes all PNG images in the specified directory for their tone capacities.
 * Loads existing cache entries from Deno KV into the in-memory `toneCache`.
 * For cache misses, analyzes the image and stores the result in both `toneCache` and Deno KV.
 *
 * @param {string} inputPngPath - The directory containing PNG images.
 * @param {ILogger} logger - Logger instance for debugging information.
 * @return {Promise<void>} - Resolves when all images have been processed.
 */
export async function cacheImageTones(inputPngPath: string, logger: ILogger): Promise<void> {
    const pngsInDirectory = readDirectory(inputPngPath).filter((input) => input.toLowerCase().endsWith('.png'));
    for (const png of pngsInDirectory) {
        const imagePath = path.join(inputPngPath, png);
        let fileSize: number;

        try {
            const stats = Deno.statSync(imagePath);
            if (!stats.isFile) {
                logger.warn(`"${imagePath}" is not a file. Skipping.`);
                continue;
            }
            fileSize = stats.size;
        } catch (error) {
            logger.error(`Failed to get file stats for "${imagePath}": ${(error as Error).message}`);
            continue;
        }

        // Attempt to retrieve from Deno KV
        const cachedCapacity = await retrieveImageCapacity(imagePath, fileSize);
        if (cachedCapacity) {
            toneCache[imagePath] = cachedCapacity;
            logger.debug(`Cache hit for "${imagePath}". Loaded capacity from Deno KV.`);
            continue;
        }

        // Cache miss: Analyze the image
        logger.debug(`Cache miss for "${imagePath}". Analyzing image tones...`);
        let data: Uint8Array;
        let info: OutputInfo;

        try {
            const imageData = await loadImageData(imagePath);
            data = imageData.data;
            info = imageData.info;
        } catch (error) {
            logger.error(`Failed to read image data for "${imagePath}": ${(error as Error).message}`);
            continue;
        }

        const capacity: ImageCapacity = { low: 0, mid: 0, high: 0 };

        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = info.channels >= 2 ? data[i + 1] : 0; // Handle grayscale images
            const b = info.channels >= 3 ? data[i + 2] : 0; // Handle grayscale or RGB images

            // const brightness = (r + g + b) / 3;
            // why? utilizing the "luminance formula" in order to cater
            // for the human eye perception (green is perceived brighter than red or blue)
            const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            if (brightness < 85) {
                capacity.low += 1;
            } else if (brightness < 170) {
                capacity.mid += 1;
            } else {
                capacity.high += 1;
            }
        }

        // Update the in-memory cache
        toneCache[imagePath] = capacity;
        logger.debug(
            `Analyzed tones for "${imagePath}": Low=${capacity.low}, Mid=${capacity.mid}, High=${capacity.high}.`,
        );

        // Store the result in Deno KV
        await storeImageCapacity(imagePath, fileSize, capacity);
        logger.debug(`Stored capacity for "${imagePath}" in Deno KV.`);
    }
}

/**
 * Retrieves the cached image tones from the in-memory `toneCache`.
 * Remains synchronous as per requirement.
 *
 * @param {string} imagePath - The full path to the PNG image.
 * @param {ILogger} logger - Logger instance for debugging information.
 * @return {ImageCapacity} - The image capacity data.
 * @throws {Error} - If no cache entry is found for the image.
 */
export function getCachedImageTones(imagePath: string, logger: ILogger): ImageCapacity {
    const capacity = toneCache[imagePath];
    if (capacity) {
        logger.debug(`Retrieved cached tones for "${imagePath}" from in-memory cache.`);
        return capacity;
    } else {
        throw new Error(`No cache entry found for "${imagePath}". Ensure that "processImageTones" has been run.`);
    }
}

/**
 * Selects a weighted random choice from an array of objects containing weight and tone.
 *
 * @param {Array<{ weight: number; tone: 'low' | 'mid' | 'high' }>} choices - The array of choice objects where each object has a weight and tone.
 * @param {ILogger} logger - Logger for debugging the selection process.
 * @return {'low' | 'mid' | 'high'} - The randomly selected tone based on the provided weights.
 */
function weightedRandomChoice(
    choices: Array<{ weight: number; tone: 'low' | 'mid' | 'high' }>,
    logger: ILogger,
): 'low' | 'mid' | 'high' {
    const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    for (const choice of choices) {
        cumulative += choice.weight;
        if (random < cumulative) {
            logger.debug(`Weighted random choice selected tone "${choice.tone}" with weight ${choice.weight}.`);
            return choice.tone;
        }
    }
    // Fallback
    const fallback = choices[choices.length - 1].tone;
    logger.debug(`Weighted random choice fallback to tone "${fallback}".`);
    return fallback;
}
