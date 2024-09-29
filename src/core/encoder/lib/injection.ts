// src/core/encoder/lib/injection.ts

import { Buffer } from 'node:buffer';
import { IDistributionMapEntry, ILogger } from '../../../@types/index.ts';
import { ensureOutputDirectory, writeBufferToFile } from '../../../utils/storage/storageUtils.ts';
import path from 'node:path';
import sharp from 'sharp';
import { injectDataIntoBuffer } from '../../../utils/imageProcessing/imageUtils.ts';
import { config } from '../../../config/index.ts';

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

    // Ensure output folder exists
    ensureOutputDirectory(outputFolder);
    if (logger.verbose) logger.debug(`Ensured output folder "${outputFolder}".`);

    // Group distribution map entries by PNG file
    const pngToChunksMap: Record<string, IDistributionMapEntry[]> = {};
    distributionMapEntries.forEach(entry => {
        if (!pngToChunksMap[entry.pngFile]) {
            pngToChunksMap[entry.pngFile] = [];
        }
        pngToChunksMap[entry.pngFile].push(entry);
    });

    // Inject all chunks per PNG in a single operation
    const injectPromises = Object.entries(pngToChunksMap).map(async ([pngFile, entries]) => {
        const inputPngPath = path.join(inputPngFolder, pngFile);
        const outputPngPath = path.join(outputFolder, pngFile);

        // Load the PNG image once
        const image = sharp(inputPngPath).removeAlpha().toColourspace('srgb');
        const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });
        const { channels: imageChannels, width, height } = info;

        // Iterate over each chunk assigned to this PNG
        for (const entry of entries) {
            const chunkData = chunkMap.get(entry.chunkId);
            if (!chunkData) {
                throw new Error(`Chunk data for chunkId ${entry.chunkId} not found.`);
            }

            // Inject data into the image buffer
            injectDataIntoBuffer(
                imageData,
                chunkData,
                entry.bitsPerChannel,
                entry.channelSequence,
                entry.startPosition,
                debugVisual,
                logger,
                width,
                height,
                imageChannels,
                entry.endPosition
            );
        }

        // Save the modified image to the output folder
        const modifiedImage = sharp(imageData, {
            raw: {
                width: width,
                height: height,
                channels: imageChannels
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
        if (logger.verbose) logger.info(`Injected all assigned chunks into "${pngFile}" and saved to output folder.`);
    });

    await Promise.all(injectPromises);
    if (logger.verbose) logger.info('All chunks injected successfully.');
}
