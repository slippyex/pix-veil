// src/core/imageHandler/strategies/WasmImageProcessor.ts

import type { IAssembledImageData, Metadata, OutputInfo } from '../../../@types/index.ts';
import { load_image_assembled, write_image_data } from '../../../../image_processor/pkg/image_processor.js';
import { config } from '../../../config/index.ts';
import { readBufferFromFile, writeBufferToFile } from '../../../utils/storage/storageUtils.ts';

export class WasmImageProcessor {
    /**
     * Loads image data from a given PNG file path.
     *
     * @param {string} pngPath - The file path to the PNG image.
     * @return {Promise<IAssembledImageData>} A promise that resolves with the assembled image data including metadata and information.
     */
    public async loadImageData(pngPath: string): Promise<IAssembledImageData> {
        try {
            // Read the PNG file as a byte array.
            const pngData = await readBufferFromFile(pngPath);

            console.time('load_image_assembled');
            const assembledData = load_image_assembled(pngData);
            console.timeEnd('load_image_assembled');

            const meta: Metadata = {
                width: assembledData.metadata.width,
                height: assembledData.metadata.height,
                channels: assembledData.metadata.channels as 1 | 2 | 3 | 4,
            };

            const info: OutputInfo = {
                width: meta.width!,
                height: meta.height!,
                channels: meta.channels!,
            };
            return {
                data: new Uint8Array(assembledData.data.buffer),
                info,
                meta,
            };
        } catch (error) {
            console.error('Error in loadImageData:', error);
            throw error;
        }
    }

    /**
     * Writes image data to a PNG file.
     *
     * @param {Uint8Array} imageData - The raw image data to be written.
     * @param {OutputInfo} info - An object containing image output information such as width and height.
     * @param {string} outputPngPath - The path to the output PNG file.
     * @return {Promise<void>} A promise that resolves when the image data has been successfully written to the file.
     * @throws Will throw an error if writing the image data fails.
     */
    public async writeImageData(imageData: Uint8Array, info: OutputInfo, outputPngPath: string): Promise<void> {
        try {
            console.time('write_image_data');
            const pngBytes: Uint8Array = write_image_data(
                imageData,
                info.width,
                info.height,
                config.imageCompression.compressionLevel,
            );
            await writeBufferToFile(outputPngPath, pngBytes);
            console.timeEnd('write_image_data');
        } catch (error) {
            console.error('Error in writeImageData:', error);
            throw error;
        }
    }
}
