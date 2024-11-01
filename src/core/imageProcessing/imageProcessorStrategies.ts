// src/utils/compression/CompressionStrategies.ts

import { ImageProcessor } from '../../@types/index.ts';
import { WasmImageProcessor } from './strategies/WasmImageProcessor.ts';
import { SharpImageProcessor } from './strategies/SharpImageProcessor.ts';

/**
 * Enumeration of supported compression strategies in the order of preference.
 */
export enum SupportedImageProcessorStrategies {
    Wasm = 'wasm',
    Sharp = 'sharp',
}

/**
 * Mapping of compression strategy identifiers to their corresponding implementations.
 */
export const ImageProcessorStrategyMap: Record<SupportedImageProcessorStrategies, ImageProcessor> = {
    [SupportedImageProcessorStrategies.Wasm]: new WasmImageProcessor(),
    [SupportedImageProcessorStrategies.Sharp]: new SharpImageProcessor(),
};
