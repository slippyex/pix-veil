// src/core/imageHandler/processor.ts

import type { IAssembledImageData, OutputInfo } from '../../@types/index.ts';
import { ImageProcessorStrategyMap, SupportedImageProcessorStrategies } from './imageProcessorStrategies.ts';

/**
 * Asynchronously loads image data from the specified PNG file path using the provided image processing strategy.
 *
 * @param {string} pngPath - The file path of the PNG image to be loaded.
 * @param {SupportedImageProcessorStrategies} processorStrategy - The strategy to be used for processing the image.
 * @return {Promise<IAssembledImageData>} A promise that resolves to the assembled image data object.
 */
export async function loadImageData(
    pngPath: string,
    processorStrategy: SupportedImageProcessorStrategies = SupportedImageProcessorStrategies.Wasm,
): Promise<IAssembledImageData> {
    const processor = ImageProcessorStrategyMap[processorStrategy];
    return await processor.loadImageData(pngPath);
}

/**
 * Writes image data to a specified file using a chosen processing strategy.
 *
 * @param {Uint8Array} imageData - The raw image data to be written.
 * @param {OutputInfo} info - Metadata information about the image.
 * @param {string} outputPngPath - The path where the PNG file will be saved.
 * @param {SupportedImageProcessorStrategies} processorStrategy - The strategy to use for processing the image.
 * @return {Promise<void>} A promise that resolves when the image data has been written.
 */
export async function writeImageData(
    imageData: Uint8Array,
    info: OutputInfo,
    outputPngPath: string,
    processorStrategy: SupportedImageProcessorStrategies = SupportedImageProcessorStrategies.Sharp,
): Promise<void> {
    const processor = ImageProcessorStrategyMap[processorStrategy];
    await processor.writeImageData(imageData, info, outputPngPath);
}
