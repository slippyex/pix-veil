// src/core/encoder/lib/injection.ts

import type { IDistributionMapEntry, ILogger } from '../../../@types/index.ts';

import { Buffer } from 'node:buffer';
import { ensureOutputDirectory } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { injectDataIntoBuffer } from '../../../utils/imageProcessing/imageUtils.ts';
import { config, MAGIC_BYTE } from '../../../config/index.ts';
import pLimit from 'p-limit';
import * as os from 'node:os';

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
        const image = sharp(inputPngPath).removeAlpha().toColourspace('srgb');
        const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });

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

        const limit = pLimit(Math.max(1, cpuCount - 1)); // Adjust concurrency as needed

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
                            injectDataIntoBuffer(
                                imageData,
                                chunkData,
                                entry.bitsPerChannel,
                                entry.channelSequence,
                                entry.startPosition,
                                debugVisual,
                                logger,
                                info.width,
                                info.height,
                                info.channels,
                                entry.endPosition,
                            );
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
            (imageData, { width, height, channels }, logger) => {
                injectDataIntoBuffer(
                    imageData,
                    Buffer.concat([MAGIC_BYTE, encryptedMapContent, MAGIC_BYTE]),
                    2, // bitsPerChannel
                    ['R', 'G', 'B'], // channelSequence
                    0, // startPosition
                    false, // debugVisual
                    logger,
                    width,
                    height,
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
