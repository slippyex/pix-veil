// src/core/encoder/index.ts

import type { IEncodeOptions } from '../../@types/index.ts';

import path from 'node:path';

import { processImageTones } from '../../utils/imageProcessing/imageUtils.ts';
import { prepareDistributionMapForInjection } from '../../utils/distributionMap/mapUtils.ts';
import { readBufferFromFile } from '../../utils/storage/storageUtils.ts';
import { compressBuffer } from '../../utils/compression/compression.ts';
import { injectChunksIntoPngs, injectDistributionMapIntoCarrierPng } from './lib/injection.ts';
import { createHumanReadableDistributionMap } from '../../utils/imageProcessing/debugHelper.ts';
import { encryptData, generateChecksum } from '../../utils/cryptography/crypto.ts';
import { distributeChunksAcrossPngs } from './lib/distributeChunks.ts';
import { splitDataIntoChunks } from './lib/splitChunks.ts';
import { analyzePngCapacities } from './lib/analyzeCapacities.ts';

/**
 * Encodes the input file and embeds the data across multiple PNG images using steganography.
 *
 * @param {IEncodeOptions} options - The options for the encoding process.
 * @param {string} options.inputFile - Path to the input file to be encoded.
 * @param {string} options.inputPngFolder - Directory containing PNG images to use for encoding.
 * @param {string} options.outputFolder - Directory where the encoded PNG images will be saved.
 * @param {string} options.password - Password used for encrypting the data.
 * @param {boolean} options.verbose - Flag to enable verbose logging.
 * @param {boolean} options.debugVisual - Flag to enable visual debugging information.
 * @param {object} options.logger - Logger object for logging debug and information messages.
 * @returns {Promise<void>} A promise that resolves when encoding is complete.
 */
export async function encode(options: IEncodeOptions): Promise<void> {
    const { inputFile, inputPngFolder, outputFolder, password, verbose, debugVisual, logger } = options;
    try {
        if (verbose) logger.info('Starting encoding process...');

        // Capture only the filename (no path) using path.basename
        const originalFilename = path.basename(inputFile);

        // Step 1: Read and compress the input file
        logger.debug('Reading and compressing the input file...');
        const fileData = readBufferFromFile(options.inputFile);
        const compressedData = compressBuffer(fileData);

        // Step 2: Encrypt the compressed data and generate checksum
        logger.debug('Encrypting the compressed data...');
        const encryptedData = encryptData(compressedData, options.password, logger);
        const checksum = generateChecksum(encryptedData);

        // Step 3: Split encrypted data into chunks
        const chunks = splitDataIntoChunks(encryptedData, logger);

        // Step 4: Pre-warm the image tones cache
        await processImageTones(inputPngFolder, logger);

        // Step 5: Analyze PNG images for capacity
        const { analyzed: pngCapacities, distributionCarrier } = analyzePngCapacities(inputPngFolder, logger);

        // Step 6: Distribute chunks across PNG images and obtain chunk map
        const { distributionMapEntries, chunkMap } = distributeChunksAcrossPngs(
            chunks,
            pngCapacities,
            inputPngFolder,
            logger,
        );

        // Step 7: Inject chunks into PNG images
        await injectChunksIntoPngs(distributionMapEntries, chunkMap, inputPngFolder, outputFolder, debugVisual, logger);

        // Step 8: Create and store the distribution map
        const encryptedMapContent = prepareDistributionMapForInjection(
            distributionMapEntries,
            originalFilename,
            checksum,
            password,
            logger,
        );

        await injectDistributionMapIntoCarrierPng(
            inputPngFolder,
            outputFolder,
            distributionCarrier,
            encryptedMapContent,
            logger,
        );

        // Step 9: Generate human-readable distribution map text file
        createHumanReadableDistributionMap(distributionMapEntries, originalFilename, checksum, outputFolder, logger);

        logger.info('Encoding completed successfully.');
    } catch (error) {
        logger.error(`Encoding failed: ${error}`);
        throw error;
    }
}
