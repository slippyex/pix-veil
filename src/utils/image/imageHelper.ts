// src/utils/image/imageHelper.ts

import { ChannelSequence } from '../../@types/index.ts';

/**
 * Calculates (x, y) coordinates from a given channel position.
 * @param width - Image width.
 * @param channelPosition - Position in channels.
 * @param bitsPerChannel - Number of bits per channel used.
 * @param channelSequence - Sequence of channels used.
 * @returns Object containing x and y coordinates.
 */
export function getPixelIndex(
    width: number,
    channelPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[]
): { x: number; y: number } {
    const channelIndex = Math.floor(channelPosition / bitsPerChannel);
    const pixelNumber = Math.floor(channelIndex / channelSequence.length);
    const x = pixelNumber % width;
    const y = Math.floor(pixelNumber / width);
    return { x, y };
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
 * Generates a non-overlapping start and end position within the image capacity for a chunk.
 * Ensures that the chunk does not exceed the image capacity and does not overlap with existing chunks.
 * @param used - Array tracking used channel positions.
 * @param totalChannels - Total number of channels in the image.
 * @param channelsNeeded - Number of channels required for the chunk.
 * @returns Object containing start and end positions, or null if no position found.
 */
export function getNonOverlappingPosition(
    used: boolean[],
    totalChannels: number,
    channelsNeeded: number
): { start: number; end: number } | null {
    const maxStart = totalChannels - channelsNeeded;
    const attempts = 100; // Prevent infinite loops
    for (let i = 0; i < attempts; i++) {
        const start = Math.floor(Math.random() * maxStart);
        const overlap = used.slice(start, start + channelsNeeded).some(channel => channel);
        if (!overlap) {
            // Mark positions as used
            used.fill(true, start, start + channelsNeeded);
            return { start, end: start + channelsNeeded };
        }
    }
    return null; // No available position found
}

/**
 * Generates a random start and end position within the image capacity for a chunk.
 * Ensures that the chunk does not exceed the image capacity.
 * @param imageCapacity - Total capacity in channels.
 * @param chunkSize - Size of the chunk in bytes.
 * @param bitsPerChannel - Number of bits per channel used.
 * @param used - Array tracking used channel positions.
 * @returns Object containing start and end positions.
 */
export function getRandomPosition(
    imageCapacity: number,
    chunkSize: number,
    bitsPerChannel: number,
    used: boolean[]
): { start: number; end: number } {
    const channelsNeeded = Math.ceil((chunkSize * 8) / bitsPerChannel);
    const position = getNonOverlappingPosition(used, imageCapacity, channelsNeeded);
    if (position) {
        return position;
    } else {
        throw new Error('Unable to find a non-overlapping position for the chunk.');
    }
}
