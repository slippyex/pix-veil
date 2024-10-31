/* tslint:disable */
/* eslint-disable */
/**
 * @param {Uint8Array} png_data
 * @returns {Uint8Array}
 */
export function load_image_raw(png_data: Uint8Array): Uint8Array;
/**
 * @param {Uint8Array} png_data
 * @returns {any}
 */
export function get_image_metadata(png_data: Uint8Array): any;
/**
 * @param {Uint8Array} raw_data
 * @param {number} width
 * @param {number} height
 * @param {number} compression_level
 * @param {boolean} adaptive_filtering
 * @returns {Uint8Array}
 */
export function write_image_data(raw_data: Uint8Array, width: number, height: number, compression_level: number, adaptive_filtering: boolean): Uint8Array;
