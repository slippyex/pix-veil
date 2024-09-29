// src/core/encoder/index.ts

import path from 'node:path';

import { processImageTones } from '../../utils/imageProcessing/imageUtils.ts';
import { IEncodeOptions } from '../../@types/index.ts';
import { createAndStoreDistributionMap } from '../../utils/distributionMap/mapUtils.ts';

import { readBufferFromFile } from '../../utils/storage/storageUtils.ts';
import { compressBuffer } from '../../utils/compression/compression.ts';
import { injectChunksIntoPngs } from './lib/injection.ts';
import { createHumanReadableDistributionMap } from '../../utils/imageProcessing/debugHelper.ts';
import { encryptData, generateChecksum } from '../../utils/cryptography/crypto.ts';
import { distributeChunksAcrossPngs } from './lib/distributeChunks.ts';
import { splitDataIntoChunks } from './lib/splitChunks.ts';
import { analyzePngCapacities } from './lib/analyzeCapacities.ts';

/**
 * Encodes a file into PNG images using steganography.
 * @param options - Encoding options.
 */
export async function encode(options: IEncodeOptions) {
    const { inputFile, inputPngFolder, outputFolder, password, verbose, debugVisual, logger } = options;
    try {
        if (verbose) logger.info('Starting encoding process...');
        // Capture only the filename (no path) using path.basename
        const originalFilename = path.basename(inputFile); // This ensures only the file name without the path

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
        const pngCapacities = analyzePngCapacities(inputPngFolder, logger);

        // Step 6: Distribute chunks across PNG images and obtain chunk map
        const { distributionMapEntries, chunkMap } = distributeChunksAcrossPngs(
            chunks,
            pngCapacities,
            inputPngFolder,
            logger
        );

        // Step 7: Inject chunks into PNG images
        await injectChunksIntoPngs(distributionMapEntries, chunkMap, inputPngFolder, outputFolder, debugVisual, logger);

        // Step 8: Create and store the distribution map
        const encryptedMapContent = createAndStoreDistributionMap(
            distributionMapEntries,
            originalFilename,
            checksum,
            password,
            outputFolder,
            logger
        );

        // Step 9: Generate human-readable distribution map text file
        createHumanReadableDistributionMap(distributionMapEntries, originalFilename, checksum, outputFolder, logger);

        logger.info('Encoding completed successfully.');
    } catch (error) {
        logger.error(`Encoding failed: ${error}`);
        throw error;
    }
}
