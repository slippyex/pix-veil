// src/utils/imageProcessing/debugHelper.ts

import type { IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import * as path from 'jsr:/@std/path';
import { config } from '../../config/index.ts';
import { generateDistributionMapText } from '../distributionMap/mapUtils.ts';
import { writeBufferToFile } from '../storage/storageUtils.ts';

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
 * @param {number} [initialBlockSize=16] - The size of the debug block (default is 16x16).
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

/**
 * Creates a human-readable distribution map text file from the given distribution map entries and other metadata.
 *
 * @param {IDistributionMapEntry[]} distributionMapEntries - The entries to be included in the distribution map.
 * @param {string} distributionCarrier - The carrier responsible for distribution.
 * @param {string} originalFilename - The original filename of the content being distributed.
 * @param {string} checksum - The checksum of the original content file.
 * @param {string} outputFolder - The directory where the distribution map file will be created.
 * @param {string} compressionStrategy - The strategy used for compressing the data.
 * @param {ILogger} logger - The logger instance used for logging information.
 * @return {void}
 */
export function createHumanReadableDistributionMap(
    distributionMapEntries: IDistributionMapEntry[],
    distributionCarrier: string,
    originalFilename: string,
    checksum: string,
    outputFolder: string,
    compressionStrategy: string,
    logger: ILogger,
): void {
    if (logger.verbose) logger.info('Creating a human-readable distribution map text file...');
    const distributionMapTextPath = path.join(outputFolder, config.distributionMapFile + '.txt');
    const distributionMapText = generateDistributionMapText(
        distributionMapEntries,
        originalFilename,
        distributionCarrier,
        checksum,
        compressionStrategy,
    );
    writeBufferToFile(distributionMapTextPath, Buffer.from(distributionMapText, 'utf-8'));
    if (logger.verbose) logger.info(`Distribution map text file created at "${distributionMapTextPath}".`);
}
