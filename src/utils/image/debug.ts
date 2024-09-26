// src/utils/image/debug.ts

import { ChannelSequence, ILogger } from '../../@types';
import { getPixelIndex } from './imageHelper';

/**
 * Adds debug visual blocks (red and blue) to the image buffer.
 * @param imageData - Raw image buffer data.
 * @param width - Image width.
 * @param height - Image height.
 * @param channels - Number of channels in the image.
 * @param startBitPosition - Bit position where data injection starts.
 * @param endBitPosition - Bit position where data injection ends.
 * @param bitsPerChannel - Number of bits per channel used.
 * @param channelSequence - Sequence of channels used.
 * @param logger - Logger instance for debugging.
 */
export function addDebugBlocks(
    imageData: Buffer,
    width: number,
    height: number,
    channels: number,
    startBitPosition: number,
    endBitPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    logger: ILogger
): void {
    // Define the size and color of the blocks
    const blockSize = 8;
    const red = { R: 255, G: 0, B: 0 };
    const blue = { R: 0, G: 0, B: 255 };

    // Calculate start and end (x, y) positions
    const startPos = getPixelIndex(width, startBitPosition, bitsPerChannel, channelSequence);
    const endPos = getPixelIndex(width, endBitPosition, bitsPerChannel, channelSequence);

    // Add 8x8 red block at the start position
    logger.debug(`Adding red block at start position: (${startPos.x}, ${startPos.y}).`);
    for (let y = startPos.y; y < Math.min(startPos.y + blockSize, height); y++) {
        for (let x = startPos.x; x < Math.min(startPos.x + blockSize, width); x++) {
            const idx = (y * width + x) * channels;
            imageData[idx] = red.R;
            imageData[idx + 1] = red.G;
            imageData[idx + 2] = red.B;
            if (channels === 4) {
                imageData[idx + 3] = 255; // Preserve alpha
            }
        }
    }

    // Add 8x8 blue block at the end position
    logger.debug(`Adding blue block at end position: (${endPos.x}, ${endPos.y}).`);
    for (let y = endPos.y; y < Math.min(endPos.y + blockSize, height); y++) {
        for (let x = endPos.x; x < Math.min(endPos.x + blockSize, width); x++) {
            const idx = (y * width + x) * channels;
            imageData[idx] = blue.R;
            imageData[idx + 1] = blue.G;
            imageData[idx + 2] = blue.B;
            if (channels === 4) {
                imageData[idx + 3] = 255; // Preserve alpha
            }
        }
    }
}
