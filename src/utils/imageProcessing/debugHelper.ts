// src/utils/imageProcessing/debugHelper.ts

import type { IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { Buffer } from 'node:buffer';
import path from 'node:path';
import { config } from '../../config/index.ts';
import { generateDistributionMapText } from '../distributionMap/mapUtils.ts';
import { writeBufferToFile } from '../storage/storageUtils.ts';

/**
 * Adds a debug block to the image data at specified pixel coordinates to mark the start or end of an injected chunk.
 *
 * @param {Buffer} imageData - The buffer containing the image data.
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {number} channels - The number of channels per pixel (e.g., 3 for RGB, 4 for RGBA).
 * @param {'start' | 'end'} markerType - Specifies whether the block is a start or end marker.
 * @param {number} x - The x-coordinate (column) where the debug block starts.
 * @param {number} y - The y-coordinate (row) where the debug block starts.
 * @param {ILogger} logger - Logger instance for debugging information.
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
): void {
    // Define the size and color of the blocks
    const blockSize = 8; // 8x8 pixels
    const colors = {
        start: { R: 255, G: 0, B: 0 }, // Red for start
        end: { R: 0, G: 0, B: 255 }, // Blue for end
    };

    const color = colors[markerType];

    // Validate coordinates
    if (x < 0 || y < 0 || x + blockSize > width || y + blockSize > height) {
        logger.error(`Debug block ${markerType} position (${x}, ${y}) is out of image bounds.`);
        throw new Error(`Debug block ${markerType} position (${x}, ${y}) is out of image bounds.`);
    }

    logger.debug(`Adding ${markerType} debug block at position: (${x}, ${y}).`);

    for (let row = y; row < y + blockSize; row++) {
        for (let col = x; col < x + blockSize; col++) {
            const idx = (row * width + col) * channels;
            imageData[idx] = color.R;
            imageData[idx + 1] = color.G;
            imageData[idx + 2] = color.B;
            if (channels === 4) {
                imageData[idx + 3] = 255; // Preserve alpha
            }
        }
    }
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
