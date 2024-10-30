// src/core/chunking/assembleChunks.ts

import { IChunk, ILogger } from '../../@types/index.ts';

/**
 * Assembles chunks of encrypted data into a single Buffer.
 *
 * @param {Object[]} encryptedDataArray - An array of objects containing the chunkId and data buffer.
 * @param {number} encryptedDataArray[].chunkId - The unique identifier for the chunk.
 * @param {Uint8Array} encryptedDataArray[].data - The data buffer for the chunk.
 * @param {ILogger} logger - The logger instance to log debug messages.
 * @returns {Uint8Array} - The concatenated buffer containing the assembled encrypted data.
 */
export function assembleChunks(encryptedDataArray: IChunk[], logger: ILogger): Uint8Array {
    // Sort chunks by chunkId to ensure correct order
    encryptedDataArray.sort((a, b) => a.chunkId - b.chunkId);

    verifyChunkIds(encryptedDataArray);

    // Concatenate all chunks to form the encrypted data
    const concatenatedEncryptedData = new Uint8Array(
        encryptedDataArray.reduce((acc, chunk) => acc + chunk.data.length, 0),
    );

    // Track the offset while copying each Uint8Array chunk
    let offset = 0;
    encryptedDataArray.forEach((chunk) => {
        concatenatedEncryptedData.set(chunk.data, offset);
        offset += chunk.data.length;
    });
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
