// src/core/encoder/lib/analyzeCapacities.ts

import { ILogger } from '../../../@types/index.ts';
import path from 'node:path';
import { readDirectory } from '../../../utils/storage/storageUtils.ts';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageUtils.ts';
import { config } from '../../../config/index.ts';

/**
 * Analyzes PNG images for their embedding capacity.
 * @param inputPngFolder - Path to the folder containing PNG images.
 * @param logger - Logger instance for debugging.
 * @returns Array of PNG capacities.
 */
export function analyzePngCapacities(
    inputPngFolder: string,
    logger: ILogger
): {
    analyzed: { file: string; capacity: number }[];
    distributionCarrier: { file: string; capacity: number };
} {
    if (logger.verbose) {
        logger.info('Analyzing PNG images for capacity...');
    }

    const pngFiles = readDirectory(inputPngFolder).filter(file => file.endsWith('.png'));

    if (pngFiles.length === 0) {
        throw new Error('No PNG files found in the input folder.');
    }

    if (pngFiles.length < 2) {
        throw new Error('At least two PNG files are required (one for distribution map and at least one for data).');
    }

    const analyzedFiles = pngFiles.map(png => {
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
            capacity: totalEmbeddableBytes
        };
    });

    const distributionCarrier = analyzedFiles.reduce((prev, curr) => (prev.capacity < curr.capacity ? prev : curr));

    return {
        analyzed: analyzedFiles.filter(af => af.file !== distributionCarrier.file),
        distributionCarrier
    };
}
