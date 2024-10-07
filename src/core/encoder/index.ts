// src/core/encoder/index.ts

import type { IEncodeOptions } from '../../@types/index.ts';

import path from 'node:path';

import { processImageTones } from '../../utils/imageProcessing/imageHelper.ts';
import { prepareDistributionMapForInjection } from '../../utils/distributionMap/mapUtils.ts';
import { ensureOutputDirectory, isCompressed, readBufferFromFile } from '../../utils/storage/storageUtils.ts';
import { compressBuffer } from '../../utils/compression/compression.ts';
import { injectChunksIntoPngs, injectDistributionMapIntoCarrierPng } from './lib/injection.ts';
import { createHumanReadableDistributionMap } from '../../utils/imageProcessing/debugHelper.ts';
import { encryptData, generateChecksum } from '../../utils/cryptography/crypto.ts';
import { createChunkDistributionInformation } from './lib/distributeChunks.ts';
import { splitDataIntoChunks } from './lib/splitChunks.ts';
import { analyzePngCapacities } from './lib/analyzeCapacities.ts';
import type { Buffer } from 'node:buffer';
import { SupportedCompressionStrategies } from '../../utils/compression/compressionStrategies.ts';

import { decode } from '../decoder/index.ts';
import fs from 'node:fs';

// Define the order of compression strategies to try
const compressionOrder: SupportedCompressionStrategies[] = [
    SupportedCompressionStrategies.Brotli,
    SupportedCompressionStrategies.GZip,
    SupportedCompressionStrategies.None,
];

/**
 * Encodes the input file and embeds the data across multiple PNG images using steganography.
 *
 * @param {IEncodeOptions} options - The options for the encoding process.
 * @returns {Promise<void>} A promise that resolves when encoding is complete.
 */
export async function encode(options: IEncodeOptions): Promise<void> {
    const { inputFile, inputPngFolder, outputFolder, password, verify, verbose, debugVisual, logger } = options;
    const fileData = readBufferFromFile(options.inputFile);
    // Capture only the filename (no path) using path.basename
    const originalFilename = path.basename(inputFile);
    const isCompressedFlag = isCompressed(originalFilename);
    await processImageTones(inputPngFolder, logger);

    const compressionStrategyOrder = isCompressedFlag ? [SupportedCompressionStrategies.None] : compressionOrder;
    for (const compressionStrategy of compressionStrategyOrder) {
        try {
            if (verbose) logger.info(`Starting encoding process for file '${originalFilename}' ...`);

            // Step 1: Compress the input buffer
            let compressedData: Buffer;
            try {
                compressedData = compressBuffer(fileData, compressionStrategy);
            } catch (_err) {
                compressedData = fileData;
            }

            // Step 2: Encrypt the compressed data and generate checksum
            const encryptedData = encryptData(compressedData, options.password, logger);
            const encryptedDataLength = encryptedData.length;
            const checksum = generateChecksum(encryptedData);

            // Step 3: Split encrypted data into chunks
            const chunks = splitDataIntoChunks(encryptedData, logger);

            // Step 4: Analyze PNG images for capacity
            const { analyzed: pngCapacities, distributionCarrier } = analyzePngCapacities(inputPngFolder, logger);

            // Step 5: Distribute chunks across PNG images and obtain chunk map
            const { distributionMapEntries, chunkMap } = createChunkDistributionInformation(
                chunks,
                pngCapacities,
                inputPngFolder,
                logger,
            );

            // Step 6: Inject chunks into PNG images
            await injectChunksIntoPngs(
                distributionMapEntries,
                chunkMap,
                inputPngFolder,
                outputFolder,
                debugVisual,
                logger,
            );

            // Step 7: Create and store the distribution map
            const encryptedMapContent = prepareDistributionMapForInjection(
                distributionMapEntries,
                compressionStrategy,
                originalFilename,
                checksum,
                password,
                encryptedDataLength,
                logger,
            );

            // Step 8: Inject distribution map into carrier png
            await injectDistributionMapIntoCarrierPng(
                inputPngFolder,
                outputFolder,
                distributionCarrier,
                encryptedMapContent,
                logger,
            );

            // Step 9: Generate human-readable distribution map text file
            createHumanReadableDistributionMap(
                distributionMapEntries,
                distributionCarrier.file,
                originalFilename,
                checksum,
                outputFolder,
                compressionStrategy,
                logger,
            );

            // Step 10: Verification Step (if enabled)
            if (verify) {
                logger.info('Starting verification step...');
                const tempDecodedFolder = path.join(outputFolder, 'temp_decoded');
                ensureOutputDirectory(tempDecodedFolder);

                try {
                    await decode({
                        inputFolder: outputFolder,
                        outputFolder: tempDecodedFolder,
                        password,
                        verbose,
                        logger,
                    });

                    // Compare the original file and the decoded file
                    const decodedFilePath = path.join(tempDecodedFolder, path.basename(inputFile));
                    const decodedBuffer = readBufferFromFile(decodedFilePath);

                    if (decodedBuffer.subarray(0, fileData.length).equals(fileData)) {
                        logger.success(`Verification successful with compression strategy: ${compressionStrategy}`);
                        // Clean up temporary folder

                        fs.rmSync(tempDecodedFolder, { recursive: true, force: true });
                        logger.info('Encoding completed successfully.');
                        break; // Exit the compression strategy loop
                    } else {
                        logger.error(`Verification failed with compression strategy: ${compressionStrategy}`);
                        throw new Error('Verification failed during encoding.');
                    }
                } catch (verificationError) {
                    logger.error(`Verification step failed with compression strategy: ${compressionStrategy}`);
                    logger.error(`Error: ${(verificationError as Error).message}`);
                    // Clean up temporary folder before retrying
                    fs.rmSync(tempDecodedFolder, { recursive: true, force: true });
                }
            } else {
                logger.info('Verification step skipped.');
                break;
            }
        } catch (error) {
            logger.error(`Encoding failed: ${error}`);
        }
    }
}
