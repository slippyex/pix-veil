// src/mapUtils.ts

import { serializeDistributionMap, deserializeDistributionMap } from './mapHelpers';
import { DistributionMap, DistributionMapEntry } from '../@types/types';

/**
 * Creates a distribution map buffer with a header containing magic bytes and map length.
 * @param entries - Array of distribution map entries.
 * @param checksum - Checksum string for data integrity.
 * @returns Buffer containing the structured distribution map.
 */
export function createDistributionMap(entries: DistributionMapEntry[], checksum: string): Buffer {
    const distributionMap: DistributionMap = { entries, checksum };
    return serializeDistributionMap(distributionMap);
}

/**
 * Parses the distribution map buffer to reconstruct the DistributionMap object.
 * @param buffer - Buffer containing the serialized distribution map.
 * @returns Parsed DistributionMap object.
 */
export function parseDistributionMap(buffer: Buffer): DistributionMap {
    return deserializeDistributionMap(buffer);
}
