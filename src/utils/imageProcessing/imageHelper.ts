// src/utils/imageProcessing/imageHelper.ts

import sharp from 'sharp';
import type { IAssembledImageData, ILogger, ImageCapacity, ImageToneCache } from '../../@types/index.ts';
import { isBitSet, setBit } from '../bitManipulation/bitUtils.ts';
import { readDirectory } from '../storage/storageUtils.ts';
import * as path from 'jsr:@std/path';
import { Buffer } from 'node:buffer';

import { createCacheKey, getCacheValue, setCacheValue } from '../cache/cacheHelper.ts';
import { weightedRandomChoice } from '../misc/helpers.ts';

/**
 * In-memory cache for image tones.
 */
const toneCache: ImageToneCache = {};
const imageMap = new Map<string, IAssembledImageData>();

/**
 * Retrieves an image from the specified path, processing it and caching the result.
 *
 * @param {string} pngPath - The file path to the PNG image.
 * @return {Promise<{ data: Buffer, info: sharp.OutputInfo } | undefined>} A promise that resolves to an object containing the image data and information, or undefined if the image cannot be processed.
 */
export async function getImage(pngPath: string): Promise<IAssembledImageData | undefined> {
    if (!imageMap.has(pngPath)) {
        const data = await loadImageData(pngPath);
        imageMap.set(pngPath, data);
    }
    return imageMap.get(pngPath);
}

/**
 * Asynchronously retrieves image data and associated information from a PNG file.
 *
 * @param {string} pngPath - The file path to the PNG image.
 * @returns {Promise<{ data: Buffer; info: sharp.OutputInfo }>}
 *          A promise that resolves to an object containing the image data buffer and output information.
 */
export async function loadImageData(pngPath: string): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
    return await image.raw().toBuffer({ resolveWithObject: true });
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
async function getImageCapacity(imagePath: string, fileSize: number): Promise<ImageCapacity | null> {
    const key = createCacheKey(imagePath, fileSize);
    try {
        return await getCacheValue<ImageCapacity>('pix-veil', key);
    } catch (error) {
        // Log the error and return null to indicate a cache miss
        console.error(`Failed to retrieve cache for "${imagePath}": ${(error as Error).message}`);
        return null;
    }
}

/**
 * Stores the image capacity in Deno KV using the unique cache key.
 *
 * @param {string} imagePath - The full path to the PNG image.
 * @param {number} fileSize - The size of the PNG image in bytes.
 * @param {ImageCapacity} capacity - The image capacity data.
 * @return {Promise<void>} - Resolves when the data is stored.
 */
async function setImageCapacity(imagePath: string, fileSize: number, capacity: ImageCapacity): Promise<void> {
    try {
        // Store the result in Deno KV
        const cacheKey = createCacheKey(imagePath, fileSize);
        await setCacheValue('pix-veil', cacheKey, capacity);
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
            const stats = await Deno.stat(imagePath);
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
        const cachedCapacity = await getImageCapacity(imagePath, fileSize);
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
        await setImageCapacity(imagePath, fileSize, capacity);
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
export function getCachedImageTones(imagePath: string): ImageCapacity {
    const capacity = toneCache[imagePath];
    if (capacity) {
        return capacity;
    } else {
        throw new Error(`No cache entry found for "${imagePath}". Ensure that "processImageTones" has been run.`);
    }
}
