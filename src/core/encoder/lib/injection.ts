// src/core/encoder/lib/injection.ts

import type { ChannelSequence, IDistributionMapEntry, ILogger, PngToChunksMap } from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { ensureOutputDirectory } from '../../../utils/storage/storageUtils.ts';
import * as path from 'jsr:/@std/path';
import sharp from 'sharp';
import { config, MAGIC_BYTE } from '../../../config/index.ts';
import pLimit from 'p-limit';
import * as os from 'node:os';
import { serializeUInt32 } from '../../../utils/serialization/serializationHelpers.ts';
import { addDebugBlock } from '../../../utils/debug/debugHelper.ts';
import { extractBits, insertBits } from '../../../utils/bitManipulation/bitUtils.ts';
import { getChannelOffset, loadImageData } from '../../../utils/imageProcessing/imageHelper.ts';
import { extractDataFromBuffer } from '../../decoder/lib/extraction.ts';

const cpuCount = os.cpus().length;

/**
 * Processes an image by reading it from an input path, applying an injector function,
 * and then saving the modified image to an output path.
 *
 * @param {string} inputPngPath - The input path of the PNG image to be processed.
 * @param {string} outputPngPath - The output path where the processed PNG image will be saved.
 * @param {function} injectorFn - A function that modifies the image data. This function takes
 *                                three arguments: imageData (Buffer), info (sharp.OutputInfo), and logger (ILogger).
 * @param {ILogger} logger - A logger instance used for logging messages.
 * @return {Promise<void>} - A promise that resolves when the image processing is completed.
 */
async function processImage(
    inputPngPath: string,
    outputPngPath: string,
    injectorFn: (imageData: Buffer, info: sharp.OutputInfo, logger: ILogger) => void,
    logger: ILogger,
): Promise<void> {
    try {
        const { data: imageData, info } = await loadImageData(inputPngPath);

        injectorFn(imageData, info, logger);

        await sharp(imageData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: info.channels,
            },
        })
            .png({
                compressionLevel: config.imageCompression.compressionLevel,
                adaptiveFiltering: config.imageCompression.adaptiveFiltering,
                palette: false,
            })
            .toFile(outputPngPath);

        logger.verbose && logger.info(`Processed image "${path.basename(outputPngPath)}" and saved to output folder.`);
    } catch (error) {
        logger.error(`Failed to process image "${inputPngPath}": ${(error as Error).message}`);
        throw error;
    }
}

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
export async function injectChunksIntoPngs(
    distributionMapEntries: IDistributionMapEntry[],
    chunkMap: Map<number, Buffer>,
    inputPngFolder: string,
    outputFolder: string,
    debugVisual: boolean,
    logger: ILogger,
): Promise<void> {
    try {
        if (logger.verbose) logger.info('Injecting chunks into PNG images...');
        ensureOutputDirectory(outputFolder);
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
                processImage(
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
 * Injects an encrypted distribution map into a carrier PNG file.
 *
 * @param {string} inputPngFolder - Path to the folder containing the input PNG file.
 * @param {string} outputFolder - Path to the folder where the output PNG file should be saved.
 * @param {Object} distributionCarrier - Object containing properties of the carrier file.
 * @param {string} distributionCarrier.file - The name of the carrier PNG file.
 * @param {number} distributionCarrier.capacity - The capacity of the carrier file.
 * @param {Buffer} encryptedMapContent - The encrypted distribution map content to be injected.
 * @param {ILogger} logger - Logger instance for logging operations and errors.
 * @return {Promise<void>} Resolves when the injection process is complete.
 */
export async function injectDistributionMapIntoCarrierPng(
    inputPngFolder: string,
    outputFolder: string,
    distributionCarrier: { file: string; capacity: number },
    encryptedMapContent: Buffer,
    logger: ILogger,
): Promise<void> {
    try {
        const inputPngPath = path.resolve(inputPngFolder, distributionCarrier.file);
        const outputPngPath = path.resolve(outputFolder, distributionCarrier.file);
        await processImage(
            inputPngPath,
            outputPngPath,
            (imageData, { channels }, logger) => {
                injectDataIntoBuffer(
                    imageData,
                    Buffer.concat([MAGIC_BYTE, serializeUInt32(encryptedMapContent.length), encryptedMapContent]),
                    2, // bitsPerChannel
                    ['R', 'G', 'B'], // channelSequence
                    0, // startPosition
                    logger,
                    channels,
                );
            },
            logger,
        );
    } catch (error) {
        logger.error(`Failed to inject distribution map into carrier PNG: ${(error as Error).message}`);
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
        // logger.debug(`changed byte ${originalByte} to ${modifiedByte}`);
        imageData[channelIndex] = insertBits(originalByte, bits, 0, bitsPerChannel);
    }

    // Calculate bits used, accounting for any padding bits
    const bitsUsed = Math.ceil(totalDataBits / bitsPerChannel) * bitsPerChannel;
    const finalEndChannelPosition = startChannelPosition + Math.ceil(bitsUsed / bitsPerChannel);

    logger.debug(
        `Data injection completed. Start Channel: ${startChannelPosition}, End Channel: ${finalEndChannelPosition}.`,
    );
}
