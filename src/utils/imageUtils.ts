// src/imageUtils.ts

import sharp from 'sharp';
import { ChannelSequence, ImageCapacity } from '../@types/types';
import { Logger } from './Logger';

/**
 * Interface for caching image tones to avoid redundant processing.
 */
interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
}

/**
 * In-memory cache for image tones.
 */
const toneCache: ImageToneCache = {};

/**
 * Analyze the image to categorize pixels into low, mid, and high-tone areas.
 * Utilizes caching to avoid redundant computations.
 */
export async function getCachedImageTones(imagePath: string, logger: Logger): Promise<ImageCapacity> {
    if (toneCache[imagePath]) {
        logger.debug(`Retrieved cached tones for "${imagePath}".`);
        return toneCache[imagePath];
    }

    const image = sharp(imagePath)
        .removeAlpha() // Remove alpha channel
        .toColourspace('srgb'); // Use 'srgb' consistently

    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { channels } = info;

    const capacity: ImageCapacity = { low: 0, mid: 0, high: 0 };

    for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;

        if (brightness < 85) {
            capacity.low += 1;
        } else if (brightness < 170) {
            capacity.mid += 1;
        } else {
            capacity.high += 1;
        }
    }

    toneCache[imagePath] = capacity; // Cache the result
    logger.debug(`Analyzed tones for "${imagePath}": Low=${capacity.low}, Mid=${capacity.mid}, High=${capacity.high}.`);
    return capacity;
}

/**
 * Injects data into the image buffer using LSB steganography.
 * @param imageData - Raw image buffer data.
 * @param data - Data to inject.
 * @param bitsPerChannel - Number of bits per channel to use.
 * @param channelSequence - Sequence of channels to inject into.
 * @param startBitPosition - Bit position to start injection.
 * @param debugVisual - Whether to add debug visual blocks.
 * @param logger - Logger instance for debugging.
 * @param width - Image width.
 * @param height - Image height.
 * @param channels - Number of channels in the image.
 * @param isDistributionMap - Optional parameter (default: false).
 */
export async function injectDataIntoBuffer(
    imageData: Buffer,
    data: Buffer,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    startBitPosition: number,
    debugVisual: boolean,
    logger: Logger,
    width: number,
    height: number,
    channels: 1 | 2 | 3 | 4,
    isDistributionMap = false
): Promise<void> {
    // Input Validation
    if (bitsPerChannel < 1 || bitsPerChannel > 8) {
        throw new Error('bitsPerChannel must be between 1 and 8.');
    }

    if (channelSequence.length === 0) {
        throw new Error('channelSequence cannot be empty.');
    }

    const totalDataBits = data.length * 8;
    const totalAvailableChannels = Math.floor(imageData.length / channels) * channelSequence.length;
    const totalAvailableBits = totalAvailableChannels * bitsPerChannel;

    if (startBitPosition < 0 || startBitPosition >= totalAvailableBits) {
        throw new Error('startBitPosition is out of bounds.');
    }

    if (totalDataBits > totalAvailableBits - startBitPosition) {
        throw new Error('Not enough space to inject all data.');
    }

    logger.debug(
        `Injecting ${data.length} bytes (${totalDataBits} bits) into buffer starting at bit position ${startBitPosition} with ${bitsPerChannel} bits per channel.`
    );

    let dataBitIndex = 0; // Track the number of bits injected

    for (let i = 0; i < totalDataBits; i += bitsPerChannel) {
        // Extract bitsPerChannel bits from data
        let bits = 0;
        for (let b = 0; b < bitsPerChannel; b++) {
            if (dataBitIndex < totalDataBits) {
                const byteIndex = Math.floor(dataBitIndex / 8);
                const bitIndex = 7 - (dataBitIndex % 8);
                const bit = (data[byteIndex] >> bitIndex) & 0x1;
                bits = (bits << 1) | bit;
                dataBitIndex++;
            } else {
                bits = bits << 1; // Pad with 0 if no bits left
            }
        }

        // Calculate the current bit position in the image
        const currentBitPos = startBitPosition + Math.floor(i / bitsPerChannel);

        // Determine the channel to inject into
        const channelSequenceIndex = currentBitPos % channelSequence.length;
        const pixelNumber = Math.floor(currentBitPos / channelSequence.length);
        const channel = channelSequence[channelSequenceIndex];
        const channelOffset = getChannelOffset(channel);

        const channelIndex = pixelNumber * channels + channelOffset;

        if (channelIndex >= imageData.length) {
            throw new Error('Channel index out of bounds during injection.');
        }

        // Inject the bits into the channel's LSBs
        const mask = (1 << bitsPerChannel) - 1;
        imageData[channelIndex] = (imageData[channelIndex] & ~mask) | (bits & mask);

        //    logger.debug(`Injected bits ${bits.toString(2).padStart(bitsPerChannel, '0')} into channel ${channel} at index ${channelIndex}.`);
    }

    // Calculate bits used, accounting for any padding bits
    const bitsUsed = Math.ceil(totalDataBits / bitsPerChannel) * bitsPerChannel;
    const endBitPosition = startBitPosition + bitsUsed;

    // If debugVisual is enabled, add red and blue blocks
    if (debugVisual) {
        logger.debug(`Adding debug visual blocks to buffer.`);
        addDebugBlocks(
            imageData,
            width,
            height,
            channels,
            startBitPosition,
            endBitPosition,
            bitsPerChannel,
            channelSequence,
            logger
        );
    }

    logger.debug(`Data injection completed. Start Bit: ${startBitPosition}, End Bit: ${endBitPosition}.`);
}

/**
 * Helper function to get the channel offset based on the channel name.
 * @param channel - The channel name ('R', 'G', 'B', 'A').
 * @returns The channel offset index.
 */
function getChannelOffset(channel: ChannelSequence): number {
    switch (channel) {
        case 'R':
            return 0;
        case 'G':
            return 1;
        case 'B':
            return 2;
        case 'A':
            return 3;
        default:
            throw new Error(`Invalid channel specified: ${channel}`);
    }
}

/**
 * Extracts data from the image buffer using LSB steganography.
 * @param imageData - Raw image buffer data.
 * @param bitsPerChannel - Number of bits per channel to extract.
 * @param channelSequence - Sequence of channels to extract from.
 * @param startBitPosition - Bit position to start extraction.
 * @param bitCount - Total number of bits to extract.
 * @param logger - Logger instance for debugging.
 * @param channels - Number of channels in the image.
 * @returns Buffer containing the extracted data.
 */
export async function extractDataFromBuffer(
    imageData: Buffer,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    startBitPosition: number,
    bitCount: number,
    logger: Logger,
    channels: number // Number of channels in the image
): Promise<Buffer> {
    // Input Validation
    if (bitsPerChannel < 1 || bitsPerChannel > 8) {
        throw new Error('bitsPerChannel must be between 1 and 8.');
    }

    if (channelSequence.length === 0) {
        throw new Error('channelSequence cannot be empty.');
    }

    const totalAvailableBits = Math.floor(imageData.length / channels) * channelSequence.length * bitsPerChannel;

    if (startBitPosition < 0 || startBitPosition >= totalAvailableBits) {
        throw new Error('startBitPosition is out of bounds.');
    }

    if (bitCount > totalAvailableBits - startBitPosition) {
        throw new Error('Not enough bits available to extract.');
    }

    logger.debug(
        `Extracting ${bitCount} bits from buffer starting at bit position ${startBitPosition} with ${bitsPerChannel} bits per channel.`
    );

    const extractedData = Buffer.alloc(Math.ceil(bitCount / 8), 0);
    let extractedBitIndex = 0;

    for (let i = 0; i < bitCount; i += bitsPerChannel) {
        // Calculate the current bit position in the image
        const currentBitPos = startBitPosition + Math.floor(i / bitsPerChannel);

        // Determine the channel to extract from
        const channelSequenceIndex = currentBitPos % channelSequence.length;
        const pixelNumber = Math.floor(currentBitPos / channelSequence.length);
        const channel = channelSequence[channelSequenceIndex];
        const channelOffset = getChannelOffset(channel);

        const channelIndex = pixelNumber * channels + channelOffset;

        if (channelIndex >= imageData.length) {
            throw new Error('Channel index out of bounds during extraction.');
        }

        // Extract bitsPerChannel bits from the channel's LSBs
        const bits = imageData[channelIndex] & ((1 << bitsPerChannel) - 1);

        // Append the extracted bits to the output buffer
        for (let b = bitsPerChannel - 1; b >= 0; b--) {
            if (extractedBitIndex >= bitCount) break;
            const bit = (bits >> b) & 0x1;
            const byteIndex = Math.floor(extractedBitIndex / 8);
            const bitIndexInByte = 7 - (extractedBitIndex % 8);
            extractedData[byteIndex] |= bit << bitIndexInByte;
            extractedBitIndex++;
        }

        logger.debug(
            `Extracted bits ${bits.toString(2).padStart(bitsPerChannel, '0')} from channel ${channel} at index ${channelIndex}.`
        );
    }

    logger.debug(`Data extraction completed. Extracted ${extractedBitIndex} bits.`);

    return extractedData;
}

// Function to calculate (x, y) from bit position
export const getPixelIndex = (
    width: number,
    bitPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[]
): { x: number; y: number } => {
    const channelIndex = Math.floor(bitPosition / bitsPerChannel);
    const pixelNumber = Math.floor(channelIndex / channelSequence.length);
    const x = pixelNumber % width;
    const y = Math.floor(pixelNumber / width);
    return { x, y };
};

/**
 * Adds debug visual blocks (red and blue) to the image buffer.
 * @param imageData - Raw image buffer data.
 * @param width - Image width.
 * @param height - Image height.
 * @param channels - Number of channels in the image.
 * @param startBitPosition - Bit position where data injection starts.
 * @param endBitPosition - Bit position where data injection ends.
 * @param bitsPerChannel - Number of bits per channel used.
 * @param channelSequence - Sequence of channels used.
 * @param logger - Logger instance for debugging.
 */
function addDebugBlocks(
    imageData: Buffer,
    width: number,
    height: number,
    channels: number,
    startBitPosition: number,
    endBitPosition: number,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    logger: Logger
): void {
    // Define the size and color of the blocks
    const blockSize = 8;
    const red = { R: 255, G: 0, B: 0 };
    const blue = { R: 0, G: 0, B: 255 };

    // Calculate start and end (x, y) positions
    const startPos = getPixelIndex(width, startBitPosition, bitsPerChannel, channelSequence);
    const endPos = getPixelIndex(width, endBitPosition, bitsPerChannel, channelSequence);

    // Add 8x8 red block at the start position
    logger.debug(`Adding red block at start position: (${startPos.x}, ${startPos.y}).`);
    for (let y = startPos.y; y < Math.min(startPos.y + blockSize, height); y++) {
        for (let x = startPos.x; x < Math.min(startPos.x + blockSize, width); x++) {
            const idx = (y * width + x) * channels;
            imageData[idx] = red.R;
            imageData[idx + 1] = red.G;
            imageData[idx + 2] = red.B;
            if (channels === 4) {
                imageData[idx + 3] = 255; // Preserve alpha
            }
        }
    }

    // Add 8x8 blue block at the end position
    logger.debug(`Adding blue block at end position: (${endPos.x}, ${endPos.y}).`);
    for (let y = endPos.y; y < Math.min(endPos.y + blockSize, height); y++) {
        for (let x = endPos.x; x < Math.min(endPos.x + blockSize, width); x++) {
            const idx = (y * width + x) * channels;
            imageData[idx] = blue.R;
            imageData[idx + 1] = blue.G;
            imageData[idx + 2] = blue.B;
            if (channels === 4) {
                imageData[idx + 3] = 255; // Preserve alpha
            }
        }
    }
}
