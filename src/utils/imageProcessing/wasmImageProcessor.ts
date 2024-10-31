// src/utils/imageProcessing/wasmImageProcessor.ts

import type { IAssembledImageData, OutputInfo } from '../../@types/image.ts';
import { get_image_metadata, load_image_raw, write_image_data } from '../../../image_processor/pkg/image_processor.js';
import { readBufferFromFile, writeBufferToFile } from '../storage/storageUtils.ts';
import { config } from '../../config/index.ts';

/**
 * Loads image data from a PNG file, processes it using Rust functions, and
 * returns the assembled image data including metadata.
 *
 * @param {string} pngPath - The file path to the PNG image.
 * @return {Promise<IAssembledImageData>} A promise that resolves to an object containing the image data, metadata, and additional information.
 */
export async function loadImageData(pngPath: string): Promise<IAssembledImageData> {
    try {
        // Read the PNG file as a byte array
        const pngData = await readBufferFromFile(pngPath);

        // Call Rust function to get raw image data
        const rawData = load_image_raw(pngData);

        // Call Rust function to get image metadata
        const metadata = get_image_metadata(pngData);

        // Assemble OutputInfo from Metadata
        const info: OutputInfo = {
            width: metadata.width!,
            height: metadata.height!,
            channels: metadata.channels!,
        };
        return {
            data: new Uint8Array(rawData),
            info: info,
            meta: metadata,
        };
    } catch (error) {
        console.error('Error in loadImageData:', error);
        throw error;
    }
}

/**
 * Writes image data to a specified PNG file.
 *
 * @param {Uint8Array} imageData - The image data to be written.
 * @param {OutputInfo} info - Information about the image (e.g. width, height).
 * @param {string} outputPngPath - The file path where the PNG image will be saved.
 * @return {Promise<void>} A promise that resolves when the image data has been successfully written.
 */
export async function writeImageData(imageData: Uint8Array, info: OutputInfo, outputPngPath: string): Promise<void> {
    try {
        // Call Rust function to write image data
        const pngBytes = write_image_data(
            imageData,
            info.width,
            info.height,
            config.imageCompression.compressionLevel,
            config.imageCompression.adaptiveFiltering,
        );
        // Write the PNG bytes to the output file
        await writeBufferToFile(outputPngPath, pngBytes);
    } catch (error) {
        console.error('Error in writeImageData:', error);
        throw error;
    }
}
