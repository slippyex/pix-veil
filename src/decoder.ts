// src/decoder.ts

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import zlib from 'zlib';
import { IDecodeOptions, IDistributionMap } from './@types/';
import { decrypt, generateChecksum, verifyChecksum } from './utils/cryptoUtils';
import { Logger } from './utils/Logger';
import { config } from './constants';
import { extractDataFromBuffer } from './utils/image/imageUtils';
import { deserializeDistributionMap } from './utils/distributionMap/mapHelpers';

export async function decode(options: IDecodeOptions) {
    const { inputFolder, outputFile, password, verbose, logger } = options;
    try {
        if (verbose) logger.info('Starting decoding process...');

        const distributionMap = await readAndProcessDistributionMap(inputFolder, password, logger);
        const encryptedData = await extractChunks(distributionMap, inputFolder, logger);
        verifyDataIntegrity(encryptedData, distributionMap.checksum, logger);
        const decryptedData = decryptData(encryptedData, password, logger);
        const decompressedData = decompressData(decryptedData, logger);
        writeOutputFile(outputFile, decompressedData, logger);

        if (verbose) logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    } catch (error) {
        logger.error(`Decoding failed: ${error}`);
        throw error;
    }
}

/**
 * Reads, decrypts, decompresses, and deserializes the distribution map.
 */
async function readAndProcessDistributionMap(
    inputFolder: string,
    password: string,
    logger: Logger
): Promise<IDistributionMap> {
    const distributionMapPath = path.join(inputFolder, config.distributionMapFile + '.db');
    if (!fs.existsSync(distributionMapPath)) {
        throw new Error(`Distribution map file "${config.distributionMapFile}.db" not found in input folder.`);
    }

    if (logger.verbose) logger.info('Reading and processing the distribution map...');
    const rawDistributionMapEncrypted = fs.readFileSync(distributionMapPath);
    const rawDistributionMapDecrypted = decrypt(rawDistributionMapEncrypted, password);
    const rawDistributionMapDecompressed = zlib.brotliDecompressSync(rawDistributionMapDecrypted);
    const distributionMap = deserializeDistributionMap(rawDistributionMapDecompressed);
    return distributionMap;
}

/**
 * Extracts data chunks based on the distribution map.
 */
async function extractChunks(distributionMap: IDistributionMap, inputFolder: string, logger: Logger): Promise<Buffer> {
    let encryptedDataArray: { chunkId: number; data: Buffer }[] = [];

    for (const entry of distributionMap.entries) {
        const pngPath = path.join(inputFolder, entry.pngFile);
        if (!fs.existsSync(pngPath)) {
            throw new Error(`PNG file "${entry.pngFile}" specified in the distribution map does not exist.`);
        }

        logger.debug(`Extracting chunk ${entry.chunkId} from "${entry.pngFile}".`);

        // Load the PNG image
        const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
        const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });

        // Calculate the number of bits to extract based on bitsPerChannel in the distribution map
        const chunkBits = (entry.endPosition - entry.startPosition) * entry.bitsPerChannel;

        // Extract data
        const chunkBuffer = await extractDataFromBuffer(
            entry.pngFile,
            imageData,
            entry.bitsPerChannel,
            entry.channelSequence,
            entry.startPosition,
            chunkBits,
            logger,
            info.channels
        );

        encryptedDataArray.push({ chunkId: entry.chunkId, data: chunkBuffer });
    }

    // Sort chunks by chunkId to ensure correct order
    encryptedDataArray.sort((a, b) => a.chunkId - b.chunkId);

    // Verify that chunkIds are consecutive and start from 0
    for (let i = 0; i < encryptedDataArray.length; i++) {
        if (encryptedDataArray[i].chunkId !== i) {
            throw new Error(
                `Missing or out-of-order chunk detected. Expected chunkId ${i}, found ${encryptedDataArray[i].chunkId}.`
            );
        }
    }

    // Concatenate all chunks to form the encrypted data
    const concatenatedEncryptedData = Buffer.concat(encryptedDataArray.map(chunk => chunk.data));

    logger.debug(
        `All chunks extracted and concatenated successfully. Total encrypted data length: ${concatenatedEncryptedData.length} bytes.`
    );

    return concatenatedEncryptedData;
}

/**
 * Verifies the integrity of the encrypted data using checksum.
 */
function verifyDataIntegrity(encryptedData: Buffer, checksum: string, logger: Logger): void {
    if (logger.verbose) logger.info('Verifying data integrity...');
    const isChecksumValid = verifyChecksum(encryptedData, checksum);
    logger.debug(`Expected Checksum: ${checksum}`);
    logger.debug(`Computed Checksum: ${generateChecksum(encryptedData)}`);
    if (!isChecksumValid) {
        throw new Error('Data integrity check failed. The data may be corrupted or tampered with.');
    }
}

/**
 * Decrypts the encrypted data.
 */
function decryptData(encryptedData: Buffer, password: string, logger: Logger): Buffer {
    if (logger.verbose) logger.info('Decrypting the encrypted data...');
    const decryptedData = decrypt(encryptedData, password);
    return decryptedData;
}

/**
 * Decompresses the decrypted data.
 */
function decompressData(decryptedData: Buffer, logger: Logger): Buffer {
    if (logger.verbose) logger.info('Decompressing data...');
    const decompressedData = zlib.brotliDecompressSync(decryptedData);
    return decompressedData;
}

/**
 * Writes the decompressed data to the output file.
 */
function writeOutputFile(outputFile: string, decompressedData: Buffer, logger: Logger): void {
    if (logger.verbose) logger.info('Writing the output file...');
    fs.writeFileSync(outputFile, decompressedData);
}
