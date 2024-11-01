// src/core/imageHandler/strategies/SharpImageProcessor.ts

import sharp from 'sharp';
import { IAssembledImageData, OutputInfo } from '../../../@types/index.ts';
import { config } from '../../../config/index.ts';

export class SharpImageProcessor {
    /**
     * Loads image data from a given PNG file path, processes the image to remove the alpha channel
     * and converts it to the sRGB color space, then returns the raw image data along with metadata.
     *
     * @param {string} pngPath - The file path to the PNG image to be processed.
     * @return {Promise<IAssembledImageData>} A promise that resolves to an object containing raw image data and metadata.
     */
    public async loadImageData(pngPath: string): Promise<IAssembledImageData> {
        const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
        const rawBuffer = await image.raw().toBuffer({ resolveWithObject: true });
        return { ...rawBuffer, meta: await image.metadata() };
    }

    /**
     * Writes image data to a file in PNG format.
     *
     * @param {Uint8Array} imageData - The raw image data to be written.
     * @param {OutputInfo} info - Information about the image such as width, height, and channels.
     * @param {string} outputPngPath - The path where the PNG file will be saved.
     * @return {Promise<void>} A promise that resolves when the file has been written.
     */
    public async writeImageData(imageData: Uint8Array, info: OutputInfo, outputPngPath: string): Promise<void> {
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
}
