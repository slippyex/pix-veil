// src/core/lib/distributionMap.ts

import { extractDataFromBuffer } from '../extraction.ts';
import { MAGIC_BYTE } from '../../../config/index.ts';
import { getImage, processImageInjection } from '../../../utils/imageProcessing/imageHelper.ts';
import type { IAssembledImageData, IFileCapacityInfo, ILogger } from '../../../@types/index.ts';

import { readDirectory } from '../../../utils/storage/storageUtils.ts';
import * as path from 'jsr:@std/path';
import { serializeUInt32 } from '../../../utils/serialization/serializationHelpers.ts';
import { injectDataIntoBuffer } from '../injection.ts';
import { concatUint8Arrays } from '../../../utils/misc/helpers.ts';

/**
 * Scans the given folder for PNG images and attempts to extract a distribution map from each image.
 *
 * @param {string} inputFolder - The path to the folder containing PNG images to scan.
 * @param {ILogger} logger - The logger instance used for logging debug, info, and warning messages.
 * @return {Promise<Buffer|null>} - A promise that resolves to a Buffer containing the distribution map if found, or null otherwise.
 */
export async function scanForDistributionMap(inputFolder: string, logger: ILogger): Promise<Uint8Array | null> {
    const carrierPngs = readDirectory(inputFolder).filter((i) => i.endsWith('.png')) as string[];
    for (const png of carrierPngs) {
        const pngPath = path.join(inputFolder, png);

        logger.debug(`Scanning for distributionMap in file "${png}".`);

        const { data: imageData, info } = (await getImage(pngPath)) as IAssembledImageData;

        // Step 1: Extract [MAGIC_BYTE][SIZE]
        const magicSizeBits = (MAGIC_BYTE.length + 4) * 8; // MAGIC_BYTE + SIZE (4 bytes)
        const magicSizeBuffer = extractDataFromBuffer(
            png,
            imageData,
            2,
            ['R', 'G', 'B'], // channelSequence
            0,
            magicSizeBits,
            logger,
            info.channels,
        );

        // Validate MAGIC_BYTE
        if (!magicSizeBuffer.subarray(0, MAGIC_BYTE.length).equals(MAGIC_BYTE)) {
            logger.debug(`MAGIC_BYTE not found at the beginning of "${png}".`);
            continue;
        }

        // Extract SIZE
        const sizeBuffer = magicSizeBuffer.subarray(MAGIC_BYTE.length, MAGIC_BYTE.length + 4);
        const shiftExtraction = MAGIC_BYTE.length + sizeBuffer.length;
        const size = sizeBuffer.readUInt32BE(0);
        logger.debug(`Found distributionMap size: ${size} bytes in "${png}".`);

        // Step 2: Extract [DISTRIBUTION_MAP] based on SIZE
        const distributionMapBits = size * 8;
        const distributionMapBuffer = extractDataFromBuffer(
            png,
            imageData,
            2,
            ['R', 'G', 'B'],
            0,
            distributionMapBits + magicSizeBits,
            logger,
            info.channels,
        );

        const extractedDistributionMapBuffer = distributionMapBuffer.subarray(shiftExtraction, size + shiftExtraction);
        if (extractedDistributionMapBuffer.length === size) {
            logger.info(`Distribution map successfully extracted from "${png}".`);
            return extractedDistributionMapBuffer;
        } else {
            logger.warn(
                `Incomplete distribution map extracted from "${png}". Expected ${size} bytes, got ${extractedDistributionMapBuffer.length} bytes.`,
            );
        }
    }
    return null;
}

/**
 * Injects an encrypted distribution map into a carrier PNG file.
 *
 * @param {string} inputPngFolder - Path to the folder containing the input PNG file.
 * @param {string} outputFolder - Path to the folder where the output PNG file should be saved.
 * @param {Object} distributionCarrier - Object containing properties of the carrier file.
 * @param {string} distributionCarrier.file - The name of the carrier PNG file.
 * @param {number} distributionCarrier.capacity - The capacity of the carrier file.
 * @param {Buffer} encryptedMapContent - The encrypted distribution map content to be injected.
 * @param {ILogger} logger - Logger instance for logging operations and errors.
 * @return {Promise<void>} Resolves when the injection process is complete.
 */
export async function injectDistributionMapIntoCarrierPng(
    inputPngFolder: string,
    outputFolder: string,
    distributionCarrier: IFileCapacityInfo,
    encryptedMapContent: Uint8Array,
    logger: ILogger,
): Promise<void> {
    try {
        const inputPngPath = path.resolve(inputPngFolder, distributionCarrier.file);
        const outputPngPath = path.resolve(outputFolder, distributionCarrier.file);
        await processImageInjection(
            inputPngPath,
            outputPngPath,
            (imageData, { channels }, logger) => {
                injectDataIntoBuffer(
                    imageData,
                    concatUint8Arrays([MAGIC_BYTE, serializeUInt32(encryptedMapContent.length), encryptedMapContent]),
                    2, // bitsPerChannel
                    ['R', 'G', 'B'], // channelSequence
                    0, // startPosition
                    logger,
                    channels,
                );
            },
            logger,
        );
    } catch (error) {
        logger.error(`Failed to inject distribution map into carrier PNG: ${(error as Error).message}`);
        throw error;
    }
}
