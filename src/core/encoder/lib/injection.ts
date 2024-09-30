// src/core/encoder/lib/injection.ts
import { Buffer } from 'node:buffer';
import { IDistributionMapEntry, ILogger } from '../../../@types/index.ts';
import { ensureOutputDirectory } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { injectDataIntoBuffer } from '../../../utils/imageProcessing/imageUtils.ts';
import { config } from '../../../config/index.ts';
import pLimit from 'p-limit';
import * as os from 'node:os';

const cpuCount = os.cpus().length;

/**
 * Processes the image by loading, injecting data, and saving it.
 * @param inputPngPath - Path to the input PNG image.
 * @param outputPngPath - Path to the output PNG image.
 * @param injectorFn - Function to inject data into the image buffer.
 * @param logger - Logger instance for debugging.
 */
async function processImage(
    inputPngPath: string,
    outputPngPath: string,
    injectorFn: (imageData: Buffer, info: sharp.OutputInfo, logger: ILogger) => void,
    logger: ILogger
): Promise<void> {
    try {
        const image = sharp(inputPngPath).removeAlpha().toColourspace('srgb');
        const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });

        injectorFn(imageData, info, logger);

        await sharp(imageData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: info.channels
            }
        })
            .png({
                compressionLevel: config.imageCompression.compressionLevel,
                adaptiveFiltering: config.imageCompression.adaptiveFiltering,
                palette: false
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
 * Injects chunks into their respective PNG images.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param chunkMap - Map of chunkId to chunk data.
 * @param inputPngFolder - Path to the folder containing input PNG images.
 * @param outputFolder - Path to the output folder for modified PNG images.
 * @param debugVisual - Whether to add debug visual blocks.
 * @param logger - Logger instance for debugging.
 */
export async function injectChunksIntoPngs(
    distributionMapEntries: IDistributionMapEntry[],
    chunkMap: Map<number, Buffer>,
    inputPngFolder: string,
    outputFolder: string,
    debugVisual: boolean,
    logger: ILogger
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
                                entry.endPosition
                            );
                        }
                    },
                    logger
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
 * Injects a distribution map into a carrier PNG image.
 * @param inputPngFolder - Path to the folder containing input PNG images.
 * @param outputFolder - Path to the output folder for modified PNG images.
 * @param distributionCarrier - Details of the carrier PNG and its capacity.
 * @param encryptedMapContent - Encrypted distribution map content to inject.
 * @param logger - Logger instance for debugging.
 */
export async function injectDistributionMapIntoCarrierPng(
    inputPngFolder: string,
    outputFolder: string,
    distributionCarrier: { file: string; capacity: number },
    encryptedMapContent: Buffer,
    logger: ILogger
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
                    encryptedMapContent,
                    2, // bitsPerChannel
                    ['R', 'G', 'B'], // channelSequence
                    0, // startPosition
                    false, // debugVisual
                    logger,
                    width,
                    height,
                    channels
                );
            },
            logger
        );
    } catch (error) {
        logger.error(`Failed to inject distribution map into carrier PNG: ${(error as Error).message}`);
        throw error;
    }
}
