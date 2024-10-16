// src/core/chunking/assembleChunks.ts

import { Buffer } from 'node:buffer';
import { IChunk, ILogger } from '../../@types/index.ts';

/**
 * Assembles chunks of encrypted data into a single Buffer.
 *
 * @param {Object[]} encryptedDataArray - An array of objects containing the chunkId and data buffer.
 * @param {number} encryptedDataArray[].chunkId - The unique identifier for the chunk.
 * @param {Buffer} encryptedDataArray[].data - The data buffer for the chunk.
 * @param {ILogger} logger - The logger instance to log debug messages.
 * @returns {Buffer} - The concatenated buffer containing the assembled encrypted data.
 */
export function assembleChunks(encryptedDataArray: IChunk[], logger: ILogger): Buffer {
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
function verifyChunkIds(encryptedDataArray: IChunk[]): void {
    encryptedDataArray.forEach((chunk, index) => {
        if (chunk.chunkId !== index) {
            throw new Error(
                `Missing or out-of-order chunk detected. Expected chunkId ${index}, found ${chunk.chunkId}.`,
            );
        }
    });
}
