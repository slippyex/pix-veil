// src/core/encoder/index.ts

import type { IEncodeOptions, ILogger } from '../../@types/index.ts';

import { cacheImageTones } from '../../utils/imageProcessing/imageHelper.ts';
import { prepareDistributionMapForInjection } from '../distributionMap/mapUtils.ts';
import { ensureOutputDirectory, isCompressed, readBufferFromFile } from '../../utils/storage/storageUtils.ts';
import { compressBuffer } from '../../utils/compression/compression.ts';
import { injectChunksIntoPngs, injectDistributionMapIntoCarrierPng } from './lib/injection.ts';
import { createHumanReadableDistributionMap } from '../../utils/debug/debugHelper.ts';
import { encryptData, generateChecksum } from '../../utils/cryptography/crypto.ts';
import { createChunkDistributionInformation } from './lib/distributeChunks.ts';
import { splitDataIntoChunks } from './lib/splitChunks.ts';
import { analyzePngCapacities } from './lib/analyzeCapacities.ts';
import type { Buffer } from 'node:buffer';
import { SupportedCompressionStrategies } from '../../utils/compression/compressionStrategies.ts';

import { decode } from '../decoder/index.ts';

import { basename, join } from 'jsr:@std/path';
import { EncodeStateMachine } from './stateMachine.ts';

// Define the order of compression strategies to try
const compressionOrder: SupportedCompressionStrategies[] = [
    SupportedCompressionStrategies.Brotli,
    SupportedCompressionStrategies.GZip,
    SupportedCompressionStrategies.None,
];

/**
 * Encodes data using a state machine based on provided options.
 *
 * @param {IEncodeOptions} options - The options to configure the encoding process.
 * @return {Promise<void>} A promise that resolves when the encoding is complete.
 */
export async function _encodeWithStateMachine(options: IEncodeOptions): Promise<void> {
    const stateMachine = new EncodeStateMachine(options);
    await stateMachine.run();
}

/**
 * Encodes the input file and embeds the data across multiple PNG images using steganography.
 *
 * @param {IEncodeOptions} options - The options for the encoding process.
 * @returns {Promise<void>} A promise that resolves when encoding is complete.
 */
export async function encode(options: IEncodeOptions): Promise<void> {
    const { inputFile, inputPngFolder, outputFolder, password, verify, verbose, debugVisual, logger } = options;
    const fileData = await readBufferFromFile(options.inputFile);
    // Capture only the filename (no path) using path.basename
    const originalFilename = basename(inputFile);
    const isCompressedFlag = isCompressed(originalFilename);
    await cacheImageTones(inputPngFolder, logger);

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
            const encryptedData = await encryptData(compressedData, options.password, logger);
            const encryptedDataLength = encryptedData.length;
            const checksum = await generateChecksum(encryptedData);

            // Step 3: Split encrypted data into chunks
            const chunks = splitDataIntoChunks(encryptedData, logger);

            // Step 4: Analyze PNG images for capacity
            const { pngCapacities, distributionCarrier } = analyzePngCapacities(inputPngFolder, logger);

            // Step 5: Distribute chunks across PNG images and obtain chunk map
            const { distributionMapEntries, chunkMap } = await createChunkDistributionInformation(
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
            const encryptedMapContent = await prepareDistributionMapForInjection(
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
            await createHumanReadableDistributionMap(
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
                const tempDecodedFolder = join(outputFolder, 'temp_decoded');
                ensureOutputDirectory(tempDecodedFolder);
                if (
                    await verificationStep(
                        fileData,
                        inputFile,
                        outputFolder,
                        compressionStrategy,
                        password,
                        verbose,
                        logger,
                    )
                ) break;
            } else {
                logger.info('Verification step skipped.');
                break;
            }
        } catch (error) {
            logger.error(`Encoding failed: ${error}`);
            throw error;
        }
    }
}

/**
 * Executes a verification step to ensure the integrity of encoded data by decoding it and comparing it to the original file data.
 *
 * @param {Buffer} originalFileData - The buffer containing the original file's data.
 * @param {string} inputFile - The path to the input file.
 * @param {string} inputFolder - The directory containing the input file.
 * @param {SupportedCompressionStrategies} compressionStrategy - The strategy used for compression.
 * @param {string} password - The password to use for the decoding process.
 * @param {boolean} verbose - Flag indicating whether to log verbose output.
 * @param {ILogger} logger - The logger instance used for logging information.
 * @return {Promise<boolean>} - A promise that resolves to true if verification succeeds, otherwise false.
 */
async function verificationStep(
    originalFileData: Buffer,
    inputFile: string,
    inputFolder: string,
    compressionStrategy: SupportedCompressionStrategies,
    password: string,
    verbose: boolean,
    logger: ILogger,
): Promise<boolean> {
    logger.info('Starting verification step...');
    const tempDecodedFolder = join(inputFolder, 'temp_decoded');
    ensureOutputDirectory(tempDecodedFolder);

    try {
        await decode({
            inputFolder,
            outputFolder: tempDecodedFolder,
            password,
            verbose,
            logger,
        });

        // Compare the original file and the decoded file
        const decodedFilePath = join(tempDecodedFolder, basename(inputFile));
        const decodedBuffer = await readBufferFromFile(decodedFilePath);

        if (decodedBuffer.subarray(0, originalFileData.length).equals(originalFileData)) {
            logger.success(`Verification successful with compression strategy: ${compressionStrategy}`);
            // Clean up temporary folder

            //    Deno.removeSync(tempDecodedFolder, { recursive: true });

            logger.info('Encoding completed successfully.');
        } else {
            throw new Error('decoded buffer does not match the original input');
        }
        return true;
    } catch (verificationError) {
        logger.error(`Verification step failed with compression strategy: ${compressionStrategy}`);
        logger.error(`Error: ${(verificationError as Error).message}`);
        throw verificationError;
    }
}
