// src/core/encoder/lib/injection.ts
import { Buffer } from 'node:buffer';
import { ChannelSequence, IDistributionMapEntry, ILogger } from '../../../@types/index.ts';
import { ensureOutputDirectory, writeBufferToFile } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { injectDataIntoBuffer } from '../../../utils/imageProcessing/imageUtils.ts';
import { config } from '../../../config/index.ts';

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
    const image = sharp(inputPngPath).removeAlpha().toColourspace('srgb');
    const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });

    injectorFn(imageData, info, logger);

    const modifiedImage = sharp(imageData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
        }
    })
        .toColourspace('srgb')
        .png({
            compressionLevel: config.imageCompression.compressionLevel,
            adaptiveFiltering: config.imageCompression.adaptiveFiltering,
            palette: false
        });

    const outputBuffer = await modifiedImage.toBuffer();
    writeBufferToFile(outputPngPath, outputBuffer);

    if (logger.verbose) logger.info(`Processed image "${path.basename(outputPngPath)}" and saved to output folder.`);
}

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
    if (logger.verbose) logger.info('Injecting chunks into PNG images...');
    ensureOutputDirectory(outputFolder);
    if (logger.verbose) logger.debug(`Ensured output folder "${outputFolder}".`);

    const pngToChunksMap: Record<string, IDistributionMapEntry[]> = {};
    distributionMapEntries.forEach(entry => {
        if (!pngToChunksMap[entry.pngFile]) {
            pngToChunksMap[entry.pngFile] = [];
        }
        pngToChunksMap[entry.pngFile].push(entry);
    });

    const injectPromises = Object.entries(pngToChunksMap).map(([pngFile, entries]) => {
        const inputPngPath = path.join(inputPngFolder, pngFile);
        const outputPngPath = path.join(outputFolder, pngFile);

        return processImage(
            inputPngPath,
            outputPngPath,
            (imageData, info, logger) => {
                for (const entry of entries) {
                    const chunkData = chunkMap.get(entry.chunkId);
                    if (!chunkData) {
                        throw new Error(`Chunk data for chunkId ${entry.chunkId} not found.`);
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
        );
    });

    await Promise.all(injectPromises);

    if (logger.verbose) logger.info('All chunks injected successfully.');
}

export async function injectDistributionMapIntoCarrierPng(
    inputPngFolder: string,
    outputFolder: string,
    distributionCarrier: { file: string; capacity: number },
    encryptedMapContent: Buffer,
    logger: ILogger
) {
    const inputPngPath = path.join(inputPngFolder, distributionCarrier.file);
    const outputPngPath = path.join(outputFolder, distributionCarrier.file);

    await processImage(
        inputPngPath,
        outputPngPath,
        (imageData, { width, height, channels }, logger) => {
            injectDataIntoBuffer(
                imageData,
                encryptedMapContent,
                2,
                ['R', 'G', 'B'],
                0,
                false,
                logger,
                width,
                height,
                channels
            );
        },
        logger
    );
}
