// src/core/lib/extraction.ts

import type { ChannelSequence, IAssembledImageData, IChunk, IDistributionMap, ILogger } from '../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { filePathExists } from '../../utils/storage/storageUtils.ts';
import * as path from 'jsr:@std/path';

import { getImage } from '../../utils/imageProcessing/imageHelper.ts';
import { extractBits } from '../../utils/bitManipulation/bitUtils.ts';
import { getChannelOffset } from '../../utils/misc/helpers.ts';

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
): Promise<IChunk[]> {
    const encryptedDataArray: { chunkId: number; data: Buffer }[] = [];

    for (const entry of distributionMap.entries) {
        const pngPath = path.join(inputFolder, entry.pngFile);
        if (!filePathExists(pngPath)) {
            throw new Error(`PNG file "${entry.pngFile}" specified in the distribution map does not exist.`);
        }

        logger.debug(`Extracting chunk ${entry.chunkId} from "${entry.pngFile}".`);

        const { data: imageData, info } = (await getImage(pngPath)) as IAssembledImageData;
        // Calculate the number of bits to extract based on bitsPerChannel in the distribution map
        const chunkBits = (entry.endChannelPosition - entry.startChannelPosition) * entry.bitsPerChannel;

        // Extract data
        const chunkBuffer = extractDataFromBuffer(
            entry.pngFile,
            imageData,
            entry.bitsPerChannel,
            entry.channelSequence,
            entry.startChannelPosition,
            chunkBits,
            logger,
            info.channels,
        );

        encryptedDataArray.push({ chunkId: entry.chunkId, data: chunkBuffer });
    }
    return encryptedDataArray;
}

/**
 * Extracts data from the image buffer using LSB steganography.
 * @param pngFile - Name of the PNG file (for error messages).
 * @param imageData - Raw image buffer data.
 * @param bitsPerChannel - Number of bits per channel to extract.
 * @param channelSequence - Sequence of channels to extract from.
 * @param startChannelPosition - Channel index to start extraction.
 * @param bitCount - Total number of bits to extract.
 * @param logger - Logger instance for debugging.
 * @param channels - Number of channels in the image.
 * @returns Buffer containing the extracted data.
 */
export function extractDataFromBuffer(
    pngFile: string,
    imageData: Buffer,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    startChannelPosition: number,
    bitCount: number,
    logger: ILogger,
    channels: number, // Number of channels in the image
): Buffer {
    // Input Validation
    if (bitsPerChannel < 1 || bitsPerChannel > 8) {
        throw new Error('bitsPerChannel must be between 1 and 8.');
    }

    if (channelSequence.length === 0) {
        throw new Error('channelSequence cannot be empty.');
    }

    const channelsNeeded = Math.ceil(bitCount / bitsPerChannel);
    const totalAvailableChannels = channelSequence.length * Math.floor(imageData.length / channels);
    const totalAvailableBits = totalAvailableChannels * bitsPerChannel;

    if (startChannelPosition < 0 || startChannelPosition + channelsNeeded > totalAvailableChannels) {
        throw new Error('Channel positions are out of bounds for data extraction.');
    }

    if (bitCount > totalAvailableBits - startChannelPosition * bitsPerChannel) {
        throw new Error('Not enough bits available to extract.');
    }

    logger.debug(
        `Extracting ${bitCount} bits from buffer starting at channel position ${startChannelPosition} with ${bitsPerChannel} bits per channel.`,
    );

    const extractedData = Buffer.alloc(Math.ceil(bitCount / 8), 0);
    let extractedBitIndex = 0;

    for (let i = 0; i < bitCount; i += bitsPerChannel) {
        // Calculate the current channel position in the image
        const currentChannelPos = startChannelPosition + Math.floor(i / bitsPerChannel);

        // Determine the channel to extract from
        const channelSequenceIndex = currentChannelPos % channelSequence.length;
        const pixelNumber = Math.floor(currentChannelPos / channelSequence.length);
        const channel = channelSequence[channelSequenceIndex];
        const channelOffset = getChannelOffset(channel);

        const channelIndex = pixelNumber * channels + channelOffset;

        if (channelIndex >= imageData.length) {
            throw new Error(
                `${pngFile} :: Channel index out of bounds during extraction at channel position ${currentChannelPos}.`,
            );
        }

        // Extract bitsPerChannel bits from the channel's LSBs using bitUtils
        const bits = extractBits(imageData[channelIndex], 0, bitsPerChannel);

        // Append the extracted bits to the output buffer
        for (let b = bitsPerChannel - 1; b >= 0; b--) {
            if (extractedBitIndex >= bitCount) break;
            const bit = (bits >> b) & 0x1;
            const byteIndex = Math.floor(extractedBitIndex / 8);
            const bitIndexInByte = 7 - (extractedBitIndex % 8);
            extractedData[byteIndex] |= bit << bitIndexInByte;
            extractedBitIndex++;
        }
    }

    logger.debug(`Data extraction completed. Extracted ${extractedBitIndex} bits.`);

    return extractedData;
}
