// src/utils/imageProcessing/debugHelper.ts

import type { ChannelSequence, IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { getPixelIndex } from './imageHelper.ts';
import path from 'node:path';
import { config } from '../../config/index.ts';
import { generateDistributionMapText } from '../distributionMap/mapUtils.ts';
import { writeBufferToFile } from '../storage/storageUtils.ts';

/**
 * Adds two 8x8 debug blocks to the image data. A red block is placed at the start bit position,
 * and a blue block is placed at the end bit position. Both blocks are constrained by the image dimensions.
 *
 * @param {Buffer} imageData - The buffer containing the image data.
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {number} channels - The number of channels per pixel (e.g., 3 for RGB, 4 for RGBA).
 * @param {number} startBitPosition - The bit position where the red block should start.
 * @param {number} endBitPosition - The bit position where the blue block should end.
 * @param {number} bitsPerChannel - The number of bits used per channel.
 * @param {ChannelSequence[]} channelSequence - The channel sequence to be used for processing.
 * @param {ILogger} logger - Logger instance for debugging information.
 * @return {void}
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
    logger: ILogger,
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
