// src/utils/imageProcessing/imageHelper.ts

import sharp from 'sharp';
import type { ChannelSequence, ILogger, ImageCapacity, ImageToneCache } from '../../@types/index.ts';
import { isBitSet, setBit } from '../bitManipulation/bitUtils.ts';
import { readDirectory } from '../storage/storageUtils.ts';
import path from 'node:path';

/**
 * In-memory cache for image tones.
 */
const toneCache: ImageToneCache = {};

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

export async function processImageTones(inputPngPath: string, logger: ILogger) {
    const pngsInDirectory = readDirectory(inputPngPath).filter((input) => input.endsWith('.png'));
    for (const png of pngsInDirectory) {
        const imagePath = path.join(inputPngPath, png);
        const image = sharp(imagePath).removeAlpha().toColourspace('srgb');

        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

        const capacity: ImageCapacity = { low: 0, mid: 0, high: 0 };

        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;

            if (brightness < 85) {
                capacity.low += 1;
            } else if (brightness < 170) {
                capacity.mid += 1;
            } else {
                capacity.high += 1;
            }
        }

        toneCache[imagePath] = capacity; // Cache the result
        logger.debug(
            `Analyzed tones for "${imagePath}": Low=${capacity.low}, Mid=${capacity.mid}, High=${capacity.high}.`,
        );
    }
}

/**
 * Analyze the image to categorize pixels into low, mid, and high-tone areas.
 * Utilizes caching to avoid redundant computations.
 */
export function getCachedImageTones(imagePath: string, logger: ILogger): ImageCapacity {
    if (toneCache[imagePath]) {
        logger.debug(`Retrieved cached tones for "${imagePath}".`);
        return toneCache[imagePath];
    } else {
        throw new Error(`no cache entry found for ${imagePath}`);
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
