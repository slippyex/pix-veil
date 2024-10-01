// src/core/decoder/lib/extraction.ts

import type { IDistributionMap, ILogger } from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { filePathExists, readDirectory } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { extractDataFromBuffer } from '../../../utils/imageProcessing/imageUtils.ts';
import { MAGIC_BYTE } from '../../../config/index.ts';


const imageMap = new Map<string, { data: Buffer; info: sharp.OutputInfo }>();

/**
 * Retrieves an image from the specified path, processing it and caching the result.
 *
 * @param {string} pngPath - The file path to the PNG image.
 * @return {Promise<{ data: Buffer, info: sharp.OutputInfo } | undefined>} A promise that resolves to an object containing the image data and information, or undefined if the image cannot be processed.
 */
async function getImage(pngPath: string): Promise<{ data: Buffer; info: sharp.OutputInfo } | undefined> {
    if (!imageMap.has(pngPath)) {
        const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
        const data = await image.raw().toBuffer({ resolveWithObject: true });
        imageMap.set(pngPath, { data: data.data, info: data.info });
    }
    return imageMap.get(pngPath);
}

/**
 * Extracts chunks of data from given PNG files as specified in the distribution map.
 *
 * @param {IDistributionMap} distributionMap - An object defining how data is distributed across multiple PNG files.
 * @param {string} inputFolder - The path to the folder containing the PNG files.
 * @param {ILogger} logger - An object used to log debug information during the extraction process.
 * @return {Promise<{ chunkId: number, data: Buffer }[]>} - A promise that resolves to an array of objects, each containing a chunkId and its associated data buffer.
 */
export async function extractChunks(
    distributionMap: IDistributionMap,
    inputFolder: string,
    logger: ILogger,
): Promise<{ chunkId: number; data: Buffer }[]> {
    const encryptedDataArray: { chunkId: number; data: Buffer }[] = [];

    for (const entry of distributionMap.entries) {
        const pngPath = path.join(inputFolder, entry.pngFile);
        if (!filePathExists(pngPath)) {
            throw new Error(`PNG file "${entry.pngFile}" specified in the distribution map does not exist.`);
        }

        logger.debug(`Extracting chunk ${entry.chunkId} from "${entry.pngFile}".`);

        const { data: imageData, info } = (await getImage(pngPath)) as { data: Buffer; info: sharp.OutputInfo };
        // Calculate the number of bits to extract based on bitsPerChannel in the distribution map
        const chunkBits = (entry.endPosition - entry.startPosition) * entry.bitsPerChannel;

        // Extract data
        const chunkBuffer = extractDataFromBuffer(
            entry.pngFile,
            imageData,
            entry.bitsPerChannel,
            entry.channelSequence,
            entry.startPosition,
            chunkBits,
            logger,
            info.channels,
        );

        encryptedDataArray.push({ chunkId: entry.chunkId, data: chunkBuffer });
    }
    return encryptedDataArray;
}

/**
 * Assembles chunks of encrypted data into a single Buffer.
 *
 * @param {Object[]} encryptedDataArray - An array of objects containing the chunkId and data buffer.
 * @param {number} encryptedDataArray[].chunkId - The unique identifier for the chunk.
 * @param {Buffer} encryptedDataArray[].data - The data buffer for the chunk.
 * @param {ILogger} logger - The logger instance to log debug messages.
 * @returns {Buffer} - The concatenated buffer containing the assembled encrypted data.
 */
export function assembleChunks(encryptedDataArray: { chunkId: number; data: Buffer }[], logger: ILogger): Buffer {
    // Sort chunks by chunkId to ensure correct order
    encryptedDataArray.sort((a, b) => a.chunkId - b.chunkId);

    verifyChunkIds(encryptedDataArray);
    // Concatenate all chunks to form the encrypted data
    const concatenatedEncryptedData = Buffer.concat(encryptedDataArray.map((chunk) => chunk.data));

    logger.debug(
        `All chunks extracted and concatenated successfully. Total encrypted data length: ${concatenatedEncryptedData.length} bytes.`,
    );

    return concatenatedEncryptedData;
}

/**
 * Verifies that each chunk in the encrypted data array has the correct sequential chunkId.
 *
 * @param {Array} encryptedDataArray - An array of objects containing chunkId and data. Each chunkId should be a number and data should be a Buffer.
 * @return {void} This function does not return a value. It throws an error if a chunkId is missing or out of order.
 */
function verifyChunkIds(encryptedDataArray: { chunkId: number; data: Buffer }[]): void {
    encryptedDataArray.forEach((chunk, index) => {
        if (chunk.chunkId !== index) {
            throw new Error(
                `Missing or out-of-order chunk detected. Expected chunkId ${index}, found ${chunk.chunkId}.`,
            );
        }
    });
}

/**
 * Scans a directory for PNG files that contain a distribution map.
 *
 * @param {string} inputFolder - The path to the folder containing PNG files to be scanned.
 * @param {ILogger} logger - A logger instance for logging debug information.
 * @return {Promise<Buffer | null>} A promise that resolves to a Buffer containing the distribution map if found,
 *                                   or null if no distribution map is found.
 */
export async function scanForDistributionMap(inputFolder: string, logger: ILogger): Promise<Buffer | null> {
    const carrierPngs = readDirectory(inputFolder).filter((i) => i.endsWith('.png'));
    for (const png of carrierPngs) {
        const pngPath = path.join(inputFolder, png);

        logger.debug(`Scanning for distributionMap in file "${png}".`);

        const { data: imageData, info } = (await getImage(pngPath)) as { data: Buffer; info: sharp.OutputInfo };

        // Step 1: Extract [MAGIC_BYTE][SIZE]
        const magicSizeBits = (MAGIC_BYTE.length + 4) * 8; // MAGIC_BYTE + SIZE (4 bytes)
        const magicSizeBuffer = extractDataFromBuffer(
            png,
            imageData,
            2,
            ['R', 'G', 'B'],
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
