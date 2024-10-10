// src/core/decoder/index.ts

import { IDecodeOptions, SupportedCompressionStrategies } from '../../@types/index.ts';

import * as path from 'jsr:@std/path';

import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { assembleChunks, extractChunks } from './lib/extraction.ts';
import { readAndProcessDistributionMap } from '../../utils/distributionMap/mapUtils.ts';

/**
 * Decodes encrypted data from the input folder, decrypts it using the provided password, and writes the
 * decompressed output to the output folder.
 *
 * @param {Object} options - The options for the decode function.
 * @return {Promise<void>} A promise that resolves when the decoding process is complete.
 */
export async function decode(options: IDecodeOptions): Promise<void> {
    const { inputFolder, outputFolder, password, verbose, logger } = options;
    try {
        if (verbose) logger.info('Starting decoding process...');

        const distributionMap = await readAndProcessDistributionMap(inputFolder, password, logger);
        const encryptedDataChunks = await extractChunks(distributionMap, inputFolder, logger);
        const encryptedData = assembleChunks(encryptedDataChunks, logger);

        // Use the encrypted data length from the distribution map
        const exactEncryptedData = encryptedData.subarray(0, distributionMap.encryptedDataLength);

        if (logger.verbose) logger.info('Verifying and decrypting data...');
        verifyDataIntegrity(exactEncryptedData, distributionMap.checksum, logger);
        const decryptedData = decryptData(exactEncryptedData, password, logger);
        if (logger.verbose && distributionMap.compressionStrategy !== SupportedCompressionStrategies.None) {
            logger.info('Decompressing data...');
        }
        const decompressedData = decompressBuffer(decryptedData, distributionMap.compressionStrategy);
        const outputFile = path.join(outputFolder, distributionMap.originalFilename);
        if (logger.verbose) logger.info('Writing the output file...');
        await writeBufferToFile(outputFile, decompressedData);

        if (verbose) logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    } catch (error) {
        logger.error(`Decoding failed: ${error}`);
        throw error;
    }
}
