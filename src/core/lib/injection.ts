// src/core/lib/injection.ts

import type { ChannelSequence, IDistributionMapEntry, ILogger } from '../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { ensureOutputDirectory } from '../../utils/storage/storageUtils.ts';
import * as path from 'jsr:@std/path';
import pLimit from 'p-limit';
import * as os from 'node:os';
import { addDebugBlock } from '../../utils/imageProcessing/debugHelper.ts';
import { extractBits, insertBits } from '../../utils/bitManipulation/bitUtils.ts';
import { extractDataFromBuffer } from './extraction.ts';
import { getChannelOffset } from '../../utils/misc/helpers.ts';
import { processImageInjection } from '../../utils/imageProcessing/imageHelper.ts';

const cpuCount = os.cpus().length;

type PngToChunksMap = Record<string, IDistributionMapEntry[]>;

/**
 * Injects specified chunks of data into PNG images.
 *
 * @param {IDistributionMapEntry[]} distributionMapEntries - An array of distribution map entries detailing which chunks to inject into which PNG files.
 * @param {Map<number, Buffer>} chunkMap - A map where keys are chunk IDs and values are Buffers containing the chunk data to be injected.
 * @param {string} inputPngFolder - Path to the folder containing input PNG files.
 * @param {string} outputFolder - Path to the folder where output PNG files will be saved after injection.
 * @param {boolean} debugVisual - Flag to indicate whether to enable debugging visuals.
 * @param {ILogger} logger - Logger instance for logging messages and errors.
 * @return {Promise<void>} A Promise that resolves when all chunk injections are completed.
 */
export async function embedChunksInImageBuffer(
    distributionMapEntries: IDistributionMapEntry[],
    chunkMap: Map<number, Buffer>,
    inputPngFolder: string,
    outputFolder: string,
    debugVisual: boolean,
    logger: ILogger,
): Promise<void> {
    try {
        if (logger.verbose) logger.info('Injecting chunks into PNG images...');
        await ensureOutputDirectory(outputFolder);
        if (logger.verbose) logger.debug(`Ensured output folder "${outputFolder}".`);

        const pngToChunksMap: PngToChunksMap = distributionMapEntries.reduce((acc, entry) => {
            acc[entry.pngFile] = acc[entry.pngFile] || [];
            acc[entry.pngFile].push(entry);
            return acc;
        }, {} as PngToChunksMap);

        const limit = pLimit(Math.max(1, cpuCount - 1));

        const injectPromises = Object.entries(pngToChunksMap).map(([pngFile, entries]) => {
            const inputPngPath = path.resolve(inputPngFolder, pngFile);
            const outputPngPath = path.resolve(outputFolder, pngFile);

            return limit(() =>
                processImageInjection(
                    inputPngPath,
                    outputPngPath,
                    (imageData, info, logger) => {
                        for (const entry of entries) {
                            const chunkData = chunkMap.get(entry.chunkId);
                            if (!chunkData) {
                                logger.error(`Chunk data for chunkId ${entry.chunkId} not found. Skipping this chunk.`);
                                continue;
                            }

                            // Calculate pixel positions based on startPosition
                            const pixelsPerChunk = Math.ceil((chunkData.length * 8) / entry.bitsPerChannel);
                            const totalPixels = info.width * info.height;
                            if (entry.startChannelPosition + pixelsPerChunk > totalPixels) {
                                logger.error(`Chunk ${entry.chunkId} exceeds image capacity. Skipping.`);
                                continue;
                            }

                            // Determine x, y for start debug block
                            const startPixel = entry.startChannelPosition;
                            const startX = startPixel % info.width;
                            const startY = Math.floor(startPixel / info.width);

                            // Determine x, y for end debug block
                            const endPixel = entry.endChannelPosition;
                            const endX = endPixel % info.width;
                            const endY = Math.floor(endPixel / info.width);

                            if (debugVisual) {
                                // Insert start debug block
                                addDebugBlock(
                                    imageData,
                                    info.width,
                                    info.height,
                                    info.channels,
                                    'start',
                                    startX,
                                    startY,
                                    logger,
                                );
                                // Insert end debug block
                                addDebugBlock(
                                    imageData,
                                    info.width,
                                    info.height,
                                    info.channels,
                                    'end',
                                    endX,
                                    endY,
                                    logger,
                                );
                            }

                            injectDataIntoBuffer(
                                imageData,
                                chunkData,
                                entry.bitsPerChannel,
                                entry.channelSequence,
                                entry.startChannelPosition,
                                logger,
                                info.channels,
                            );

                            const verifyChunkData = extractDataFromBuffer(
                                entry.pngFile,
                                imageData,
                                entry.bitsPerChannel,
                                entry.channelSequence,
                                entry.startChannelPosition,
                                entry.bitsPerChannel,
                                logger,
                                info.channels,
                            );
                            if (!Buffer.compare(verifyChunkData, chunkData)) {
                                throw new Error(`Injection error - verified chunk is not as expected`);
                            }
                        }
                    },
                    logger,
                )
            );
        });

        await Promise.all(injectPromises);

        if (logger.verbose) logger.info('All chunks injected successfully.');
    } catch (error) {
        logger.error(`Failed to inject chunks into PNGs: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * Injects data into the image buffer using LSB steganography.
 * @param imageData - Raw image buffer data.
 * @param data - Data to inject.
 * @param bitsPerChannel - Number of bits per channel to use.
 * @param channelSequence - Sequence of channels to inject into.
 * @param startChannelPosition - Channel index to start injection.
 * @param logger - Logger instance for debugging.
 * @param channels - Number of channels in the image.
 */
export function injectDataIntoBuffer(
    imageData: Buffer,
    data: Buffer,
    bitsPerChannel: number,
    channelSequence: ChannelSequence[],
    startChannelPosition: number,
    logger: ILogger,
    channels: 1 | 2 | 3 | 4,
) {
    // Input Validation
    if (bitsPerChannel < 1 || bitsPerChannel > 8) {
        throw new Error('bitsPerChannel must be between 1 and 8.');
    }

    if (channelSequence.length === 0) {
        throw new Error('channelSequence cannot be empty.');
    }

    const totalDataBits = data.length * 8;
    const channelsNeeded = Math.ceil(totalDataBits / bitsPerChannel);
    const totalAvailableChannels = channelSequence.length * Math.floor(imageData.length / channels);
    const totalAvailableBits = totalAvailableChannels * bitsPerChannel;

    if (startChannelPosition < 0 || startChannelPosition + channelsNeeded > totalAvailableChannels) {
        throw new Error('Channel positions are out of bounds for data injection.');
    }

    if (totalDataBits > totalAvailableBits - startChannelPosition * bitsPerChannel) {
        throw new Error('Not enough space to inject all data.');
    }

    logger.debug(
        `Injecting ${data.length} bytes (${totalDataBits} bits) into buffer starting at channel position ${startChannelPosition} with ${bitsPerChannel} bits per channel.`,
    );

    let dataBitIndex = 0; // Track the number of bits injected

    for (let i = 0; i < totalDataBits; i += bitsPerChannel) {
        // Extract bitsPerChannel bits from data
        let bits = 0;
        for (let b = 0; b < bitsPerChannel; b++) {
            if (dataBitIndex < totalDataBits) {
                const byteIndex = Math.floor(dataBitIndex / 8);
                const bitIndex = 7 - (dataBitIndex % 8);
                const bit = extractBits(data[byteIndex], bitIndex, 1);
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

        // Inject the bits into the channel's LSBs using bitUtils
        const originalByte = imageData[channelIndex];
        imageData[channelIndex] = insertBits(originalByte, bits, 0, bitsPerChannel);
    }

    // Calculate bits used, accounting for any padding bits
    const bitsUsed = Math.ceil(totalDataBits / bitsPerChannel) * bitsPerChannel;
    const finalEndChannelPosition = startChannelPosition + Math.ceil(bitsUsed / bitsPerChannel);

    logger.debug(
        `Data injection completed. Start Channel: ${startChannelPosition}, End Channel: ${finalEndChannelPosition}.`,
    );
}
