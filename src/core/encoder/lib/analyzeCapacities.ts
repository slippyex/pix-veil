// src/core/encoder/lib/analyzeCapacities.ts

import type { ILogger } from '../../../@types/index.ts';

import path from 'node:path';
import { readDirectory } from '../../../utils/storage/storageUtils.ts';
import { getCachedImageTones } from '../../../utils/imageProcessing/imageHelper.ts';
import { config } from '../../../config/index.ts';

/**
 * Analyzes PNG images in a given folder to determine their capacity for embedding data
 * based on tones and identifies the best image to use as a distribution map.
 *
 * @param {string} inputPngFolder - The folder containing the PNG images to be analyzed.
 * @param {ILogger} logger - A logger instance for logging information and debug messages.
 *
 * @return {Object} An object containing two properties:
 * - analyzed: an array of objects representing each analyzed PNG file and its capacity.
 * - distributionCarrier: an object representing the PNG file chosen as the distribution carrier.
 */
export function analyzePngCapacities(
    inputPngFolder: string,
    logger: ILogger,
): {
    analyzed: { file: string; capacity: number; tone: 'low' | 'mid' | 'high' }[];
    distributionCarrier: { file: string; capacity: number; tone: 'low' | 'mid' | 'high' };
} {
    if (logger.verbose) {
        logger.info('Analyzing PNG images for capacity based on tones...');
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
        const capacity = getCachedImageTones(pngPath, logger); // { low, mid, high }

        const bitsPerChannel = config.bitsPerChannelForDistributionMap;
        const channelsPerPixel = 3; // R, G, B

        // Calculate weighted embeddable channels
        const totalEmbeddableChannels = (capacity.low * 2 + capacity.mid + capacity.high * 0.5) * channelsPerPixel;

        // Calculate channels needed per byte
        const channelsNeededPerByte = Math.ceil(8 / bitsPerChannel); // e.g., 2 bits per channel => 4 channels per byte

        // Total embeddable bytes based on weighted channels
        const totalEmbeddableBytes = Math.floor(totalEmbeddableChannels / channelsNeededPerByte);

        if (logger.verbose) {
            logger.debug(`PNG "${png}" can embed up to ${totalEmbeddableBytes} bytes based on tones.`);
        }

        // Determine predominant tone
        let predominantTone: 'low' | 'mid' | 'high';
        if (capacity.low >= capacity.mid && capacity.low >= capacity.high) {
            predominantTone = 'low';
        } else if (capacity.mid >= capacity.low && capacity.mid >= capacity.high) {
            predominantTone = 'mid';
        } else {
            predominantTone = 'high';
        }

        return {
            file: png,
            capacity: totalEmbeddableBytes,
            tone: predominantTone,
        };
    });

    // pick the png with the least capacity to host the distributionMap
    const distributionCarrier = analyzedFiles.reduce((prev, curr) => (prev.capacity < curr.capacity ? prev : curr));

    return {
        analyzed: analyzedFiles.filter((af) => af.file !== distributionCarrier.file),
        distributionCarrier,
    };
}
