// src/utils/imageProcessing/imageHelper.ts

import type { ChannelSequence } from '../../@types/index.ts';
import { isBitSet, setBit } from '../bitManipulation/bitMaskUtils.ts';

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
 * Finds and marks a non-overlapping position of consecutive channels.
 *
 * @param {Uint8Array} used - Uint8Array indicating which channels are already used.
 * @param {number} totalChannels - Total number of available channels.
 * @param {number} channelsNeeded - Number of consecutive channels required.
 * @return {{ start: number, end: number } | null} - The start and end indices of the non-overlapping position or null if no such position is found.
 */
export function getNonOverlappingPosition(
    used: Uint8Array,
    totalChannels: number,
    channelsNeeded: number,
): { start: number; end: number } | null {
    const maxStart = totalChannels - channelsNeeded;
    const attempts = 100; // Prevent infinite loops
    for (let i = 0; i < attempts; i++) {
        const start = Math.floor(Math.random() * maxStart);
        let overlap = false;
        for (let j = 0; j < channelsNeeded; j++) {
            if (isBitSet(used, start + j)) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            // Mark positions as used
            for (let j = 0; j < channelsNeeded; j++) {
                setBit(used, start + j);
            }
            return { start, end: start + channelsNeeded };
        }
    }
    return null; // No available position found
}

/**
 * Generates a random position within the provided image capacity that does not overlap with already used positions.
 *
 * @param {number} imageCapacity - The total capacity of the image in terms of available positions.
 * @param {number} chunkSize - The size of the chunk to hide within the image.
 * @param {number} bitsPerChannel - The number of bits used per channel in the image.
 * @param {Uint8Array} used - A Uint8Array indicating which channels have already been used.
 * @return {{ start: number, end: number }} An object containing the start and end positions for the chunk within the image.
 * @throws {Error} If unable to find a non-overlapping position for the chunk.
 */
export function getRandomPosition(
    imageCapacity: number,
    chunkSize: number,
    bitsPerChannel: number,
    used: Uint8Array,
): { start: number; end: number } {
    const channelsNeeded = Math.ceil((chunkSize * 8) / bitsPerChannel);
    const position = getNonOverlappingPosition(used, imageCapacity, channelsNeeded);
    if (position) {
        return position;
    } else {
        throw new Error('Unable to find a non-overlapping position for the chunk.');
    }
}
