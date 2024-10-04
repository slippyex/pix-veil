// src/utils/distributionMap/mapUtils.ts

import type { IDistributionMap, IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { deserializeDistributionMap, serializeDistributionMap } from './mapHelpers.ts';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from '../compression/compression.ts';
import { decryptData, encryptData } from '../cryptography/crypto.ts';
import { scanForDistributionMap } from '../../core/decoder/lib/extraction.ts';

/**
 * Prepares a distribution map for injection by creating, compressing, and encrypting it.
 *
 * @param {IDistributionMapEntry[]} distributionMapEntries - Entries to be included in the distribution map.
 * @param {string} inputFile - The input file associated with the distribution map.
 * @param {string} checksum - The checksum to validate the distribution map.
 * @param {string} password - The password used for encrypting the distribution map.
 * @param {number} encryptedDataLength - The length of the encrypted data.
 * @param {ILogger} logger - The logger instance used for logging information and debugging.
 * @returns {Buffer} - The prepared distribution map as encrypted binary data, ready for injection.
 */
export function prepareDistributionMapForInjection(
    distributionMapEntries: IDistributionMapEntry[],
    isCompressed: boolean,
    inputFile: string,
    checksum: string,
    password: string,
    encryptedDataLength: number, // New parameter
    logger: ILogger,
): Buffer {
    if (logger.verbose) logger.info('Creating and injecting the distribution map...');
    const serializedMap = createDistributionMap(
        distributionMapEntries,
        isCompressed,
        inputFile,
        checksum,
        encryptedDataLength,
    );
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
 * Creates a distribution map from the given entries, original filename, checksum, and encrypted data length,
 * and returns it as a serialized Buffer.
 *
 * @param {IDistributionMapEntry[]} entries - The entries to be included in the distribution map.
 * @param {string} originalFilename - The original filename associated with the distribution.
 * @param {string} checksum - The checksum for verifying the integrity of the distribution data.
 * @param {number} encryptedDataLength - The length of the encrypted data.
 * @returns {Buffer} - The serialized distribution map.
 */
export function createDistributionMap(
    entries: IDistributionMapEntry[],
    isCompressed: boolean,
    originalFilename: string,
    checksum: string,
    encryptedDataLength: number, // New parameter
): Buffer {
    const distributionMap: IDistributionMap = {
        entries,
        originalFilename,
        compressed: isCompressed,
        checksum,
        encryptedDataLength,
    };
    return serializeDistributionMap(distributionMap);
}

/**
 * Generates a distribution map text for the given entries.
 *
 * @param {IDistributionMapEntry[]} entries - An array of distribution map entries.
 * @param {string} originalFilename - The name of the original file.
 * @param {string} distributionCarrier - The filename of the png which is used as carrier for the distribution map.
 * @param {string} checksum - The checksum of the original file.
 * @return {string} The formatted distribution map text.
 */
export function generateDistributionMapText(
    entries: IDistributionMapEntry[],
    originalFilename: string,
    distributionCarrier: string,
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
    text += `Distribution Carrier PNG: ${distributionCarrier}\n`;

    return text;
}
