// src/utils/distributionMap/mapUtils.ts

import type { IDistributionMap, IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { deserializeDistributionMap, serializeDistributionMap } from './mapHelpers.ts';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from '../compression/compression.ts';
import { decryptData, encryptData } from '../cryptography/crypto.ts';
import { scanForDistributionMap } from '../../core/decoder/lib/extraction.ts';
import { SupportedCompressionStrategies } from '../compression/compressionStrategies.ts';

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
    const distributionMapFromCarrier = await scanForDistributionMap(inputFolder, logger);
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
