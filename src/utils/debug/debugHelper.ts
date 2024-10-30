// src/utils/debug/debugHelper.ts

import type { IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import * as path from 'jsr:/@std/path';
import { config } from '../../config/index.ts';
import { writeBufferToFile } from '../storage/storageUtils.ts';

/**
 * Adds a debug block of specified type at specified coordinates on an image.
 *
 * @param {Uint8Array} imageData - The image data buffer.
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {number} channels - The number of color channels in the image (e.g., 3 for RGB, 4 for RGBA).
 * @param {'start' | 'end'} markerType - The type of marker to add, either 'start' (red) or 'end' (blue).
 * @param {number} x - The x-coordinate of the top-left corner of the debug block.
 * @param {number} y - The y-coordinate of the top-left corner of the debug block.
 * @param {ILogger} logger - The logger instance to use for logging messages.
 * @param {number} [initialBlockSize=16] - The size of the debug block (default is 16x16).
 *
 * @return {void}
 */
export function addDebugBlock(
    imageData: Uint8Array,
    width: number,
    height: number,
    channels: number,
    markerType: 'start' | 'end',
    x: number,
    y: number,
    logger: ILogger,
    initialBlockSize: number = 16,
): void {
    // Define colors based on marker type
    const colors: Record<'start' | 'end', { R: number; B: number }> = {
        start: { R: 255, B: 0 }, // Red for start
        end: { R: 0, B: 255 }, // Blue for end
    };

    const color = colors[markerType];
    const blockSize = Math.min(initialBlockSize, width - x, height - y);
    // Validate coordinates
    if (x < 0 || y < 0 || x + blockSize > width || y + blockSize > height) {
        const message =
            `Debug block ${markerType} position (${x}, ${y}) with size ${blockSize}x${blockSize} is out of image bounds.`;
        logger.error(message);
        throw new Error(message);
    }

    logger.debug(`Adding ${markerType} debug block at position: (${x}, ${y}) with size ${blockSize}x${blockSize}.`);

    // Create a single row buffer filled with the specified color
    const rowBuffer = new Uint8Array(blockSize * channels);
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
        //        rowBuffer.copy(imageData, bufferOffset, 0, blockSize * channels);
        imageData.set(rowBuffer.subarray(0, blockSize * channels), bufferOffset);
    });
}

/**
 * Generates a human-readable distribution map text file based on the provided distribution map entries.
 *
 * @param {IDistributionMapEntry[]} distributionMapEntries - Array of distribution map entry objects.
 * @param {string} distributionCarrier - The distribution carrier PNG file name.
 * @param {string} originalFilename - The original filename from which the distribution originated.
 * @param {string} checksum - The checksum of the original file.
 * @param {string} outputFolder - The directory path where output files should be saved.
 * @param {string} compressionStrategy - The compression strategy used.
 * @param {ILogger} logger - Logger instance for logging information.
 *
 * @return {Promise<void>} A promise that resolves when the human-readable distribution map text file is created.
 */
export async function createHumanReadableDistributionMap(
    distributionMapEntries: IDistributionMapEntry[],
    distributionCarrier: string,
    originalFilename: string,
    checksum: string,
    outputFolder: string,
    compressionStrategy: string,
    logger: ILogger,
): Promise<void> {
    if (logger.verbose) logger.info('Creating a human-readable distribution map text file...');
    const distributionMapTextPath = path.join(outputFolder, config.distributionMapFile + '.txt');
    let text = `Distribution Map - ${new Date().toISOString()}\n\n`;

    const pngMap: Record<string, IDistributionMapEntry[]> = {};

    distributionMapEntries.forEach((entry) => {
        if (!pngMap[entry.pngFile]) {
            pngMap[entry.pngFile] = [];
        }
        pngMap[entry.pngFile].push(entry);
    });

    for (const png in pngMap) {
        text += `PNG File: ${png}\n`;
        text += `Chunks Embedded: ${pngMap[png].length}\n`;
        text += `Details:\n`;
        pngMap[png].forEach((entry) => {
            const length = entry.endChannelPosition - entry.startChannelPosition;
            text +=
                `  - Chunk ID: ${entry.chunkId}, Position: ${entry.startChannelPosition}-${entry.endChannelPosition}, Length: ${length} bytes, Bits/Channel: ${entry.bitsPerChannel}, Channels: ${
                    entry.channelSequence.join(', ')
                }\n`;
        });
        text += `\n`;
    }

    text += `Checksum: ${checksum}\n`;
    text += `Original Filename: ${originalFilename}\n`;
    text += `Picked compression strategy: ${compressionStrategy}\n`;
    text += `Distribution Carrier PNG: ${distributionCarrier}\n`;
    await writeBufferToFile(distributionMapTextPath, new TextEncoder().encode(text));
    if (logger.verbose) logger.info(`Distribution map text file created at "${distributionMapTextPath}".`);
}
