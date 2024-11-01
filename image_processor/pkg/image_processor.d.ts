/* tslint:disable */
/* eslint-disable */
/**
 * Loads image data from PNG bytes, processes it, and returns assembled image data.
 * @param {Uint8Array} png_data
 * @returns {AssembledImageData}
 */
export function load_image_assembled(png_data: Uint8Array): AssembledImageData;
/**
 * Writes image data to PNG bytes with specified configurations.
 * @param {Uint8Array} raw_data
 * @param {number} width
 * @param {number} height
 * @param {number} compression_level
 * @returns {Uint8Array}
 */
export function write_image_data(raw_data: Uint8Array, width: number, height: number, compression_level: number): Uint8Array;
/**
 * Assembled image data including raw pixels and metadata.
 */
export class AssembledImageData {
  free(): void;
/**
 * Retrieves the raw image data as a Uint8Array.
 */
  readonly data: Uint8Array;
/**
 * Retrieves the image metadata.
 */
  readonly metadata: Metadata;
}
/**
 * Metadata about the image.
 */
export class Metadata {
  free(): void;
/**
 * Gets the number of channels in the image.
 */
  readonly channels: number;
/**
 * Gets the height of the image.
 */
  readonly height: number;
/**
 * Gets the width of the image.
 */
  readonly width: number;
}
