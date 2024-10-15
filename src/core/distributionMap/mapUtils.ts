// src/core/distributionMap/mapUtils.ts

import type { IAssembledImageData, IDistributionMap, IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { deserializeDistributionMap, serializeDistributionMap } from './mapHelpers.ts';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from '../../utils/compression/compression.ts';
import { decryptData, encryptData } from '../../utils/cryptography/crypto.ts';
import { extractDataFromBuffer } from '../decoder/lib/extraction.ts';
import { SupportedCompressionStrategies } from '../../utils/compression/compressionStrategies.ts';
import { MAGIC_BYTE } from '../../config/index.ts';
import { getImage } from '../../utils/imageProcessing/imageHelper.ts';
import { readDirectory } from '../../utils/storage/storageUtils.ts';
import * as path from 'jsr:@std/path';

/**
 * Prepare the distribution map for injection by serializing, compressing, and encrypting it.
 *
 * @param {IDistributionMapEntry[]} distributionMapEntries - The entries for the distribution map.
 * @param {SupportedCompressionStrategies} compressionStrategy - The compression strategy to use.
 * @param {string} inputFile - The input file for which the distribution map is prepared.
 * @param {string} checksum - The checksum of the input file.
 * @param {string} password - The password used for encrypting the distribution map.
 * @param {number} encryptedDataLength - The length of the encrypted data.
 * @param {ILogger} logger - The logger instance for logging information.
 * @returns {Buffer} The encrypted buffer containing the compressed distribution map.
 */
export async function prepareDistributionMapForInjection(
    distributionMapEntries: IDistributionMapEntry[],
    compressionStrategy: SupportedCompressionStrategies,
    inputFile: string,
    checksum: string,
    password: string,
    encryptedDataLength: number,
    logger: ILogger,
): Promise<Buffer> {
    if (logger.verbose) logger.info('Creating and injecting the distribution map...');
    const serializedMap = createDistributionMap(
        distributionMapEntries,
        compressionStrategy,
        inputFile,
        checksum,
        encryptedDataLength,
    );
    const distributionMapCompressed = compressBuffer(serializedMap, SupportedCompressionStrategies.Brotli);
    const encrypted = await encryptData(distributionMapCompressed, password, logger);
    if (logger.verbose) logger.info(`Distribution map compressed and encrypted for injection.`);
    return encrypted;
}

/**
 * Reads and processes a distribution map from the specified input folder.
 *
 * @param {string} inputFolder - The folder containing the distribution map file.
 * @param {string} password - The password used to decrypt the distribution map.
 * @param {ILogger} logger - The logger instance for logging information.
 * @return {Promise<IDistributionMap>} The processed distribution map.
 */
export async function readAndProcessDistributionMap(
    inputFolder: string,
    password: string,
    logger: ILogger,
): Promise<IDistributionMap> {
    const distributionMapFromCarrier = await scanForAndExtractDistributionMap(inputFolder, logger);
    if (distributionMapFromCarrier) {
        return processDistributionMap(distributionMapFromCarrier, password, logger);
    }
    throw new Error('Distribution map not found in input folder.');
}

/**
 * Processes an encrypted distribution map by decrypting, decompressing, and deserializing it.
 *
 * @param {Buffer} rawDistributionMapEncrypted - The encrypted distribution map data as a Buffer.
 * @param {string} password - The password used to decrypt the distribution map.
 * @param {ILogger} logger - The logger instance used to log relevant information and errors.
 * @return {IDistributionMap} - The resulting distribution map after decryption, decompression, and deserialization.
 */
async function processDistributionMap(
    rawDistributionMapEncrypted: Buffer,
    password: string,
    logger: ILogger,
): Promise<IDistributionMap> {
    const rawDistributionMapDecrypted = await decryptData(rawDistributionMapEncrypted, password, logger);
    const rawDistributionMapDecompressed = decompressBuffer(
        rawDistributionMapDecrypted,
        SupportedCompressionStrategies.Brotli,
    );
    return deserializeDistributionMap(rawDistributionMapDecompressed);
}

/**
 * Creates a distribution map buffer from the provided entries and metadata.
 *
 * @param {IDistributionMapEntry[]} entries - Array of distribution map entries.
 * @param {SupportedCompressionStrategies} compressionStrategy - Strategy used for compressing the data.
 * @param {string} originalFilename - The original filename of the data being distributed.
 * @param {string} checksum - A checksum value for data integrity verification.
 * @param {number} encryptedDataLength - The length of the encrypted data.
 * @returns {Buffer} Serialized buffer representation of the distribution map.
 */
export function createDistributionMap(
    entries: IDistributionMapEntry[],
    compressionStrategy: SupportedCompressionStrategies,
    originalFilename: string,
    checksum: string,
    encryptedDataLength: number, // New parameter
): Buffer {
    const distributionMap: IDistributionMap = {
        entries,
        originalFilename,
        compressionStrategy,
        checksum,
        encryptedDataLength,
    };
    return serializeDistributionMap(distributionMap);
}

/**
 * Scans the given folder for PNG images and attempts to extract a distribution map from each image.
 *
 * @param {string} inputFolder - The path to the folder containing PNG images to scan.
 * @param {ILogger} logger - The logger instance used for logging debug, info, and warning messages.
 * @return {Promise<Buffer|null>} - A promise that resolves to a Buffer containing the distribution map if found, or null otherwise.
 */
async function scanForAndExtractDistributionMap(inputFolder: string, logger: ILogger): Promise<Buffer | null> {
    const carrierPngs = readDirectory(inputFolder).filter((i) => i.endsWith('.png'));
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
