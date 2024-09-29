// src/core/decoder/lib/extraction.ts

import { Buffer } from 'node:buffer';
import { IDistributionMap, ILogger } from '../../../@types/index.ts';
import { filePathExists } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { extractDataFromBuffer } from '../../../utils/imageProcessing/imageUtils.ts';

const imageMap = new Map<string, { data: Buffer; info: sharp.OutputInfo }>();

/**
 * Retrieves an image from the specified path. If the image is not already
 * cached, it processes the image to remove the alpha channel and converts
 * it to the sRGB color space before storing it in the cache.
 *
 * @param pngPath The file path to the PNG image.
 * @return {Promise<{data: Buffer, info: sharp.OutputInfo} | undefined>}
 *         A promise that resolves to an object containing the image data
 *         and information if the image is found, otherwise undefined.
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
 * Extracts chunks of encrypted data from a series of PNG files based on provided distribution map.
 *
 * @param distributionMap The distribution map detailing the PNG file and chunk information.
 * @param inputFolder The path to the folder containing the input PNG files.
 * @param logger The logger instance for logging debug or error information.
 * @return {Promise<{ chunkId: number; data: Buffer }[]>} A promise that resolves to an array of objects containing chunk IDs and their corresponding data buffers.
 */
export async function extractChunks(
    distributionMap: IDistributionMap,
    inputFolder: string,
    logger: ILogger
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
            info.channels
        );

        encryptedDataArray.push({ chunkId: entry.chunkId, data: chunkBuffer });
    }
    return encryptedDataArray;
}

/**
 * Assembles chunks of encrypted data in the correct order and concatenates them into a single Buffer.
 *
 * @param  encryptedDataArray An array of objects containing chunkId and data Buffer.
 * @param logger An instance of a logger that implements a debug method.
 * @return {Buffer} The concatenated Buffer of all encrypted data chunks.
 */
export function assembleChunks(encryptedDataArray: { chunkId: number; data: Buffer }[], logger: ILogger): Buffer {
    // Sort chunks by chunkId to ensure correct order
    encryptedDataArray.sort((a, b) => a.chunkId - b.chunkId);

    verifyChunkIds(encryptedDataArray);
    // Concatenate all chunks to form the encrypted data
    const concatenatedEncryptedData = Buffer.concat(encryptedDataArray.map(chunk => chunk.data));

    logger.debug(
        `All chunks extracted and concatenated successfully. Total encrypted data length: ${concatenatedEncryptedData.length} bytes.`
    );

    return concatenatedEncryptedData;
}

/**
 * Verifies that each chunk in the provided array has the correct chunkId.
 *
 * @param encryptedDataArray An array of objects containing chunkId and data properties.
 * @throws Error an error if a chunk is missing or out of order.
 */
function verifyChunkIds(encryptedDataArray: { chunkId: number; data: Buffer }[]): void {
    encryptedDataArray.forEach((chunk, index) => {
        if (chunk.chunkId !== index) {
            throw new Error(
                `Missing or out-of-order chunk detected. Expected chunkId ${index}, found ${chunk.chunkId}.`
            );
        }
    });
}
