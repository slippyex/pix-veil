// src/utils/image/imageUtils.ts

import sharp from 'sharp';
import { ChannelSequence, ILogger, ImageCapacity, ImageToneCache } from '../../@types';
import { Logger } from '../Logger';
import { addDebugBlocks } from './debug';
import { getChannelOffset } from './imageHelper';

/**
 * In-memory cache for image tones.
 */
const toneCache: ImageToneCache = {};

/**
 * Analyze the image to categorize pixels into low, mid, and high-tone areas.
 * Utilizes caching to avoid redundant computations.
 */
export async function getCachedImageTones(imagePath: string, logger: ILogger): Promise<ImageCapacity> {
    if (toneCache[imagePath]) {
        logger.debug(`Retrieved cached tones for "${imagePath}".`);
        return toneCache[imagePath];
    }

    const image = sharp(imagePath).removeAlpha().toColourspace('srgb');

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
 * @param startChannelPosition - Channel index to start injection.
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
    startChannelPosition: number,
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
    const channelsNeeded = Math.ceil(totalDataBits / bitsPerChannel);
    const totalAvailableChannels = Math.floor(imageData.length / channels) * channelSequence.length;
    const totalAvailableBits = totalAvailableChannels * bitsPerChannel;

    if (startChannelPosition < 0 || startChannelPosition >= Math.floor(totalAvailableBits / bitsPerChannel)) {
        throw new Error('startChannelPosition is out of bounds.');
    }

    if (totalDataBits > totalAvailableBits - (startChannelPosition * bitsPerChannel)) {
        throw new Error('Not enough space to inject all data.');
    }

    logger.debug(
        `Injecting ${data.length} bytes (${totalDataBits} bits) into buffer starting at channel position ${startChannelPosition} with ${bitsPerChannel} bits per channel.`
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

        // Calculate the current channel position in the image
        const currentChannelPos = startChannelPosition + Math.floor(i / bitsPerChannel);

        // Determine the channel to inject into
        const channelSequenceIndex = currentChannelPos % channelSequence.length;
        const pixelNumber = Math.floor(currentChannelPos / channelSequence.length);
        const channel = channelSequence[channelSequenceIndex];
        const channelOffset = getChannelOffset(channel);

        const channelIndex = pixelNumber * channels + channelOffset;

        if (channelIndex >= imageData.length) {
            throw new Error(`Channel index out of bounds during injection at channel position ${currentChannelPos}.`);
        }

        // Inject the bits into the channel's LSBs
        const mask = (1 << bitsPerChannel) - 1;
        imageData[channelIndex] = (imageData[channelIndex] & ~mask) | (bits & mask);
    }

    // Calculate bits used, accounting for any padding bits
    const bitsUsed = Math.ceil(totalDataBits / bitsPerChannel) * bitsPerChannel;
    const endChannelPosition = startChannelPosition + Math.ceil(bitsUsed / bitsPerChannel);

    // If debugVisual is enabled, add red and blue blocks
    if (debugVisual && !isDistributionMap) {
        logger.debug(`Adding debug visual blocks to buffer.`);
        addDebugBlocks(
            imageData,
            width,
            height,
            channels,
            startChannelPosition,
            endChannelPosition,
            bitsPerChannel,
            channelSequence,
            logger
        );
    }

    logger.debug(`Data injection completed. Start Channel: ${startChannelPosition}, End Channel: ${endChannelPosition}.`);
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
export async function extractDataFromBuffer(
    pngFile: string,
    imageData: Buffer,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    startChannelPosition: number,
    bitCount: number,
    logger: ILogger,
    channels: number // Number of channels in the image
): Promise<Buffer> {
    // Input Validation
    if (bitsPerChannel < 1 || bitsPerChannel > 8) {
        throw new Error('bitsPerChannel must be between 1 and 8.');
    }

    if (channelSequence.length === 0) {
        throw new Error('channelSequence cannot be empty.');
    }

    const totalAvailableChannels = Math.floor(imageData.length / channels) * channelSequence.length;
    const totalAvailableBits = totalAvailableChannels * bitsPerChannel;

    if (startChannelPosition < 0 || startChannelPosition >= Math.floor(totalAvailableBits / bitsPerChannel)) {
        throw new Error('startChannelPosition is out of bounds.');
    }

    if (bitCount > totalAvailableBits - (startChannelPosition * bitsPerChannel)) {
        throw new Error('Not enough bits available to extract.');
    }

    logger.debug(
        `Extracting ${bitCount} bits from buffer starting at channel position ${startChannelPosition} with ${bitsPerChannel} bits per channel.`
    );

    const extractedData = Buffer.alloc(Math.ceil(bitCount / 8), 0);
    let extractedBitIndex = 0;

    for (let i = 0; i < bitCount; i += bitsPerChannel) {
        // Calculate the current bit position in the image
        const currentBitPos = (startChannelPosition * bitsPerChannel) + i;

        // Determine the channel to extract from
        const currentChannelPos = Math.floor(currentBitPos / bitsPerChannel);
        const channelSequenceIndex = currentChannelPos % channelSequence.length;
        const pixelNumber = Math.floor(currentChannelPos / channelSequence.length);
        const channel = channelSequence[channelSequenceIndex];
        const channelOffset = getChannelOffset(channel);

        const channelIndex = pixelNumber * channels + channelOffset;

        if (channelIndex >= imageData.length) {
            throw new Error(`${pngFile} :: Channel index out of bounds during extraction at channel position ${currentChannelPos}.`);
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
    }

    logger.debug(`Data extraction completed. Extracted ${extractedBitIndex} bits.`);

    return extractedData;
}
