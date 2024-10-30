// src/utils/imageProcessing/sharpSpecific.ts

import type { IAssembledImageData, OutputInfo } from '../../@types/index.ts';
import sharp from 'sharp';
import { config } from '../../config/index.ts';

/**
 * Loads and processes image data from a given PNG file path. The method removes the alpha channel,
 * converts the image to the sRGB color space, and returns the raw image data buffer.
 *
 * @param {string} pngPath - The path to the PNG file to be loaded.
 * @return {Promise<IAssembledImageData>} A promise that resolves to the processed image data buffer.
 */
export async function loadImageData(pngPath: string): Promise<IAssembledImageData> {
    const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
    const rawBuffer = await image.raw().toBuffer({ resolveWithObject: true });
    return { ...rawBuffer, meta: await image.metadata() };
}

/**
 * Writes the given raw image data to a PNG file at the specified output path.
 *
 * @param {Uint8Array} imageData - The raw image data to be written.
 * @param {OutputInfo} info - Information about the image dimensions and channels.
 * @param {string} outputPngPath - The file path where the output PNG should be saved.
 * @return {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function writeImageData(imageData: Uint8Array, info: OutputInfo, outputPngPath: string): Promise<void> {
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
}
