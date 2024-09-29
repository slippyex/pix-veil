// src/core/decoder/index.ts

import * as path from 'jsr:@std/path';

import { IDecodeOptions } from '../../@types/index.ts';
import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { assembleChunks, extractChunks } from './lib/extraction.ts';
import { readAndProcessDistributionMap } from '../../utils/distributionMap/mapUtils.ts';

/**
 * Decodes and processes encrypted data from a specified input folder, decrypts it, decompresses it,
 * and writes the resulting data to an output folder.
 *
 * @param options - An object containing required options for the decode process.
 * @param options.inputFolder - The folder containing the input data to be decoded.
 * @param options.outputFolder - The folder where the decoded output will be saved.
 * @param options.password - The password used for decrypting the data.
 * @param options.verbose - A flag indicating whether to log detailed information during the decode process.
 * @param options.logger - Logger instance for logging information and errors.
 * @param options.logger.info - Function to log informational messages.
 * @param options.logger.error - Function to log error messages.
 *
 * @return {Promise<void>} A promise that resolves when the decoding process has completed successfully.
 */
export async function decode(options: IDecodeOptions): Promise<void> {
    const { inputFolder, outputFolder, password, verbose, logger } = options;
    try {
        if (verbose) logger.info('Starting decoding process...');

        const distributionMap = readAndProcessDistributionMap(inputFolder, password, logger);
        const encryptedDataChunks = await extractChunks(distributionMap, inputFolder, logger);
        const encryptedData = assembleChunks(encryptedDataChunks, logger);
        if (logger.verbose) logger.info('Verifying and decrypting data...');
        verifyDataIntegrity(encryptedData, distributionMap.checksum, logger);
        const decryptedData = decryptData(encryptedData, password, logger);
        if (logger.verbose) logger.info('Decompressing data...');
        const decompressedData = decompressBuffer(decryptedData);
        const outputFile = path.join(outputFolder, distributionMap.originalFilename);
        if (logger.verbose) logger.info('Writing the output file...');
        writeBufferToFile(outputFile, decompressedData);

        if (verbose) logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    } catch (error) {
        logger.error(`Decoding failed: ${error}`);
        throw error;
    }
}
