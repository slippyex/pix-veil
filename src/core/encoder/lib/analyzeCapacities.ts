// src/core/encoder/lib/analyzeCapacities.ts

import type { ILogger } from '../../../@types/index.ts';

import path from 'node:path';
import { readDirectory } from '../../../utils/storage/storageUtils.ts';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageUtils.ts';
import { config } from '../../../config/index.ts';

/**
 * Analyzes the capacities of PNG images in a specified folder to determine their suitability for data embedding.
 *
 * @param {string} inputPngFolder - The directory containing PNG images to be analyzed.
 * @param {ILogger} logger - The logger instance used for logging information and debugging.
 * @return {Object} - An object containing the analyzed capacities of the PNG files and the distribution carrier:
 *                    - analyzed: An array of objects representing each PNG file analyzed with its calculated capacity.
 *                    - distributionCarrier: An object representing the PNG file with the smallest capacity suitable for use as a distribution carrier.
 */
export function analyzePngCapacities(
    inputPngFolder: string,
    logger: ILogger,
): {
    analyzed: { file: string; capacity: number }[];
    distributionCarrier: { file: string; capacity: number };
} {
    if (logger.verbose) {
        logger.info('Analyzing PNG images for capacity...');
    }

    const pngFiles = readDirectory(inputPngFolder).filter((file) => file.endsWith('.png'));

    if (pngFiles.length === 0) {
        throw new Error('No PNG files found in the input folder.');
    }

    if (pngFiles.length < 2) {
        throw new Error('At least two PNG files are required (one for distribution map and at least one for data).');
    }

    const analyzedFiles = pngFiles.map((png) => {
        const pngPath = path.join(inputPngFolder, png);
        const capacity = getCachedImageTones(pngPath, logger); // Use cached tones

        const bitsPerChannel = config.bitsPerChannelForDistributionMap;
        const channelsPerPixel = 3; // R, G, B
        const totalEmbeddableChannels = (capacity.low + capacity.mid + capacity.high) * channelsPerPixel;
        const channelsNeededPerByte = Math.ceil(8 / bitsPerChannel); // Number of channels needed to embed one byte
        const totalEmbeddableBytes = Math.floor(totalEmbeddableChannels / channelsNeededPerByte);

        if (logger.verbose) {
            logger.debug(`PNG "${png}" can embed up to ${totalEmbeddableBytes} bytes.`);
        }

        return {
            file: png,
            capacity: totalEmbeddableBytes,
        };
    });

    // pick the png with the least capacity to host the distributionMap
    const distributionCarrier = analyzedFiles.reduce((prev, curr) => (prev.capacity < curr.capacity ? prev : curr));

    return {
        analyzed: analyzedFiles.filter((af) => af.file !== distributionCarrier.file),
        distributionCarrier,
    };
}
