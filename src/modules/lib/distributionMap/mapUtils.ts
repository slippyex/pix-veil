// src/modules/lib/distributionMap/mapUtils.ts

import { serializeDistributionMap, deserializeDistributionMap } from './mapHelpers.ts';
import { IDistributionMap, IDistributionMapEntry, ILogger } from '../../../@types/index.ts';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from '../../../utils/misc/compressUtils.ts';
import { decrypt, encrypt } from '../../../utils/misc/cryptoUtils.ts';
import path from 'node:path';
import { config } from '../../../config.ts';
import { filePathExists, readBufferFromFile, writeBufferToFile } from '../../../utils/misc/storageUtils.ts';

/**
 * Creates and stores the distribution map.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param inputFile - Original input file name
 * @param checksum - Checksum of the encrypted data.
 * @param password - Password used for encryption.
 * @param outputFolder - Path to the output folder.
 * @param logger - Logger instance for debugging.
 */
export function createAndStoreDistributionMap(
    distributionMapEntries: IDistributionMapEntry[],
    inputFile: string,
    checksum: string,
    password: string,
    outputFolder: string,
    logger: ILogger
): Buffer {
    if (logger.verbose) logger.info('Creating and injecting the distribution map...');
    const serializedMap = createDistributionMap(distributionMapEntries, inputFile, checksum);
    const distributionMapCompressed = compressBuffer(serializedMap);
    const encryptedMap = encrypt(distributionMapCompressed, password);
    const distributionMapOutputPath = path.join(outputFolder, config.distributionMapFile + '.db');
    writeBufferToFile(distributionMapOutputPath, encryptedMap);
    if (logger.verbose) logger.info(`Distribution map encrypted and saved at "${distributionMapOutputPath}".`);
    return encryptedMap;
}

/**
 * Reads and processes a distribution map from a specified input folder. The method decrypts,
 * decompresses, and deserializes the distribution map file, and returns it as an object.
 *
 * @param {string} inputFolder - The folder containing the distribution map file.
 * @param {string} password - The password used for decrypting the distribution map file.
 * @param {ILogger} logger - The logger instance used for logging messages.
 * @return {IDistributionMap} The deserialized distribution map object.
 */
export function readAndProcessDistributionMap(
    inputFolder: string,
    password: string,
    logger: ILogger
): IDistributionMap {
    const distributionMapPath = path.join(inputFolder, config.distributionMapFile + '.db');
    if (!filePathExists(distributionMapPath)) {
        throw new Error(`Distribution map file "${config.distributionMapFile}.db" not found in input folder.`);
    }

    if (logger.verbose) logger.info('Reading and processing the distribution map...');
    const rawDistributionMapEncrypted = readBufferFromFile(distributionMapPath);
    const rawDistributionMapDecrypted = decrypt(rawDistributionMapEncrypted, password);
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
    checksum: string
): Buffer {
    const distributionMap: IDistributionMap = { entries, originalFilename, checksum };
    return serializeDistributionMap(distributionMap);
}

/**
 * Parses the distribution map buffer to reconstruct the DistributionMap object.
 * @param buffer - Buffer containing the serialized distribution map.
 * @returns Parsed DistributionMap object.
 */
export function parseDistributionMap(buffer: Buffer): IDistributionMap {
    return deserializeDistributionMap(buffer);
}

/**
 * Generates a human-readable distribution map text.
 */
export function generateDistributionMapText(
    entries: IDistributionMapEntry[],
    originalFilename: string,
    checksum: string
): string {
    let text = `Distribution Map - ${new Date().toISOString()}\n\n`;

    const pngMap: Record<string, IDistributionMapEntry[]> = {};

    entries.forEach(entry => {
        if (!pngMap[entry.pngFile]) {
            pngMap[entry.pngFile] = [];
        }
        pngMap[entry.pngFile].push(entry);
    });

    for (const png in pngMap) {
        text += `PNG File: ${png}\n`;
        text += `Chunks Embedded: ${pngMap[png].length}\n`;
        text += `Details:\n`;
        pngMap[png].forEach(entry => {
            const length = entry.endPosition - entry.startPosition;
            text += `  - Chunk ID: ${entry.chunkId}, Position: ${entry.startPosition}-${entry.endPosition}, Length: ${length} bytes, Bits/Channel: ${entry.bitsPerChannel}, Channels: ${entry.channelSequence.join(', ')}\n`;
        });
        text += `\n`;
    }

    text += `Checksum: ${checksum}\n`;
    text += `Original Filename: ${originalFilename}\n`;

    return text;
}
