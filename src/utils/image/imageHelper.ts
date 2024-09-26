// src/utils/image/imageHelper.ts

// Function to calculate (x, y) from bit position
import { ChannelSequence } from '../../@types';

export function getPixelIndex(
    width: number,
    bitPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[]
): { x: number; y: number } {
    const channelIndex = Math.floor(bitPosition / bitsPerChannel);
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
 * Generates a random start and end position within the image capacity for a chunk.
 * Ensures that the chunk does not exceed the image capacity.
 */
export function getRandomPosition(imageCapacity: number, chunkSize: number): { start: number; end: number } {
    const maxStart = imageCapacity - chunkSize;
    if (maxStart <= 0) {
        return { start: 0, end: chunkSize };
    }
    const start = Math.floor(Math.random() * maxStart);
    const end = start + chunkSize;
    return { start, end };
}
