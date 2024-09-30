// src/utils/distributionMap/mapUtils.ts

import { deserializeDistributionMap, serializeDistributionMap } from './mapHelpers.ts';
import { IDistributionMap, IDistributionMapEntry, ILogger } from '../../@types/index.ts';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from '../compression/compression.ts';
import { decryptData, encryptData } from '../cryptography/crypto.ts';
import { scanForDistributionMap } from '../../core/decoder/lib/extraction.ts';

/**
 * Creates and stores the distribution map.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param inputFile - Original input file name
 * @param checksum - Checksum of the encrypted data.
 * @param password - Password used for encryption.
 * @param logger - Logger instance for debugging.
 */
export function prepareDistributionMapForInjection(
    distributionMapEntries: IDistributionMapEntry[],
    inputFile: string,
    checksum: string,
    password: string,
    logger: ILogger,
): Buffer {
    if (logger.verbose) logger.info('Creating and injecting the distribution map...');
    const serializedMap = createDistributionMap(distributionMapEntries, inputFile, checksum);
    const distributionMapCompressed = compressBuffer(serializedMap);
    const encrypted = encryptData(distributionMapCompressed, password, logger);
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
function processDistributionMap(
    rawDistributionMapEncrypted: Buffer,
    password: string,
    logger: ILogger,
): IDistributionMap {
    const rawDistributionMapDecrypted = decryptData(rawDistributionMapEncrypted, password, logger);
    const rawDistributionMapDecompressed = decompressBuffer(rawDistributionMapDecrypted);
    return deserializeDistributionMap(rawDistributionMapDecompressed);
}

/**
 * Creates a distribution map buffer with a header containing magic bytes and map length.
 * @param entries - Array of distribution map entries.
 * @param originalFilename - Original input file name
 * @param checksum - Checksum string for data integrity.
 * @returns Buffer containing the structured distribution map.
 */
export function createDistributionMap(
    entries: IDistributionMapEntry[],
    originalFilename: string,
    checksum: string,
): Buffer {
    const distributionMap: IDistributionMap = { entries, originalFilename, checksum };
    return serializeDistributionMap(distributionMap);
}

/**
 * Generates a human-readable distribution map text.
 */
export function generateDistributionMapText(
    entries: IDistributionMapEntry[],
    originalFilename: string,
    checksum: string,
): string {
    let text = `Distribution Map - ${new Date().toISOString()}\n\n`;

    const pngMap: Record<string, IDistributionMapEntry[]> = {};

    entries.forEach((entry) => {
        if (!pngMap[entry.pngFile]) {
            pngMap[entry.pngFile] = [];
        }
        pngMap[entry.pngFile].push(entry);
    });

    for (const png in pngMap) {
        text += `PNG File: ${png}\n`;
        text += `Chunks Embedded: ${pngMap[png].length}\n`;
        text += `Details:\n`;
        pngMap[png].forEach((entry) => {
            const length = entry.endPosition - entry.startPosition;
            text +=
                `  - Chunk ID: ${entry.chunkId}, Position: ${entry.startPosition}-${entry.endPosition}, Length: ${length} bytes, Bits/Channel: ${entry.bitsPerChannel}, Channels: ${
                    entry.channelSequence.join(', ')
                }\n`;
        });
        text += `\n`;
    }

    text += `Checksum: ${checksum}\n`;
    text += `Original Filename: ${originalFilename}\n`;

    return text;
}
