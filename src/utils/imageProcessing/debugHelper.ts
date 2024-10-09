// src/utils/imageProcessing/debugHelper.ts

import type { ILogger } from '../../@types/index.ts';

import { Buffer } from 'node:buffer';

/**
 * Adds a debug block of specified type at specified coordinates on an image.
 *
 * @param {Buffer} imageData - The image data buffer.
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {number} channels - The number of color channels in the image (e.g., 3 for RGB, 4 for RGBA).
 * @param {'start' | 'end'} markerType - The type of marker to add, either 'start' (red) or 'end' (blue).
 * @param {number} x - The x-coordinate of the top-left corner of the debug block.
 * @param {number} y - The y-coordinate of the top-left corner of the debug block.
 * @param {ILogger} logger - The logger instance to use for logging messages.
 * @param {number} [blockSize=16] - The size of the debug block (default is 16x16).
 *
 * @return {void}
 */
export function addDebugBlock(
    imageData: Buffer,
    width: number,
    height: number,
    channels: number,
    markerType: 'start' | 'end',
    x: number,
    y: number,
    logger: ILogger,
    blockSize: number = 16,
): void {
    // Define colors based on marker type
    const colors: Record<'start' | 'end', { R: number; B: number }> = {
        start: { R: 255, B: 0 }, // Red for start
        end: { R: 0, B: 255 }, // Blue for end
    };

    const color = colors[markerType];

    // Validate coordinates
    if (x < 0 || y < 0 || x + blockSize > width || y + blockSize > height) {
        const message =
            `Debug block ${markerType} position (${x}, ${y}) with size ${blockSize}x${blockSize} is out of image bounds.`;
        logger.error(message);
        throw new Error(message);
    }

    logger.debug(`Adding ${markerType} debug block at position: (${x}, ${y}) with size ${blockSize}x${blockSize}.`);

    // Create a single row buffer filled with the specified color
    const rowBuffer = Buffer.alloc(blockSize * channels);
    [...Array(blockSize).keys()].forEach((i) => {
        rowBuffer[i * channels] = color.R;
        rowBuffer[i * channels + 2] = color.B;
        if (channels === 4) {
            rowBuffer[i * channels + 3] = 255;
        }
    });

    // Copy the row buffer into each row of the block
    Array.from({ length: blockSize }, (_, i) => y + i).forEach((row) => {
        const bufferOffset = (row * width + x) * channels;
        rowBuffer.copy(imageData, bufferOffset, 0, blockSize * channels);
    });
}
