// src/utils/imageProcessing/imageHelper.ts

/// <reference lib="deno.unstable" />

import sharp from 'sharp';
import type { ChannelSequence, ILogger, ImageCapacity, ImageToneCache } from '../../@types/index.ts';
import { isBitSet, setBit } from '../bitManipulation/bitUtils.ts';
import { findProjectRoot, readDirectory } from '../storage/storageUtils.ts';
import path from 'node:path';
import type { Buffer } from 'node:buffer';
import fs from 'node:fs';
import openKv = Deno.openKv;

/**
 * In-memory cache for image tones.
 */
const toneCache: ImageToneCache = {};

// Initialize Deno KV
const kv = await initializeKvStore();

/**
 * Initializes and returns a Deno KV store instance.
 *
 * @return {Promise<Deno.Kv>} The initialized KV store.
 */
async function initializeKvStore(): Promise<Deno.Kv> {
    const rootDirectory = findProjectRoot(Deno.cwd());
    return await openKv(path.join(rootDirectory as string, 'deno-kv', 'pix-veil.db'));
}

export async function getImageData(pngPath: string): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
    return await image.raw().toBuffer({ resolveWithObject: true });
}
/**
 * Calculates the x and y coordinates of a pixel in an image based on
 * the channel position and various image parameters.
 *
 * @param {number} width - The width of the image in pixels.
 * @param {number} channelPosition - The position of the desired channel.
 * @param {number} bitsPerChannel - The number of bits used to represent a channel value.
 * @param {ChannelSequence[]} channelSequence - The array representing the sequence of channels.
 * @return {Object} The coordinates of the pixel.
 * @return {number} return.x - The x-coordinate of the pixel.
 * @return {number} return.y - The y-coordinate of the pixel.
 */
export function getPixelIndex(
    width: number,
    channelPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
): { x: number; y: number } {
    const channelIndex = Math.floor(channelPosition / bitsPerChannel);
    const pixelNumber = Math.floor(channelIndex / channelSequence.length);
    const x = pixelNumber % width;
    const y = Math.floor(pixelNumber / width);
    return { x, y };
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
        const { value } = await kv.get<ImageCapacity>(['pix-veil', key]);
        return value;
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
        await kv.set(['pix-veil', key], capacity);
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
export async function processImageTones(inputPngPath: string, logger: ILogger): Promise<void> {
    const pngsInDirectory = readDirectory(inputPngPath).filter((input) => input.toLowerCase().endsWith('.png'));
    for (const png of pngsInDirectory) {
        const imagePath = path.join(inputPngPath, png);
        let fileSize: number;

        try {
            const stats = fs.statSync(imagePath);
            if (!stats.isFile()) {
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
        let data: Buffer;
        let info: sharp.OutputInfo;

        try {
            const imageData = await getImageData(imagePath);
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
            const brightness = (r + g + b) / 3;

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
 * Helper function to get the channel offset based on the channel name.
 * @param channel - The channel name ('R', 'G', 'B', 'A').
 * @returns The channel offset index.
 */
export function getChannelOffset(channel: ChannelSequence): number {
    switch (channel) {
        case 'R':
            return 0;
        case 'G':
            return 1;
        case 'B':
            return 2;
        case 'A':
            return 3;
        default:
            throw new Error(`Invalid channel specified: ${channel}`);
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
