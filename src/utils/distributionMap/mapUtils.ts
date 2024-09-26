// src/utils/distributionMap/mapUtils.ts

import { serializeDistributionMap, deserializeDistributionMap } from './mapHelpers';
import { DistributionMap, DistributionMapEntry } from '../../@types';

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

/**
 * Generates a human-readable distribution map text.
 */
export function generateDistributionMapText(entries: DistributionMapEntry[], checksum: string): string {
    let text = `Distribution Map - ${new Date().toISOString()}\n\n`;

    const pngMap: Record<string, DistributionMapEntry[]> = {};

    entries.forEach(entry => {
        if (!pngMap[entry.pngFile]) {
            pngMap[entry.pngFile] = [];
        }
        pngMap[entry.pngFile].push(entry);
    });

    for (const png in pngMap) {
        text += `PNG File: ${png}\n`;
        text += `Chunks Embedded: ${pngMap[png].length}\n`;
        text += `Details:\n`;
        pngMap[png].forEach(entry => {
            const length = entry.endPosition - entry.startPosition;
            text += `  - Chunk ID: ${entry.chunkId}, Position: ${entry.startPosition}-${entry.endPosition}, Length: ${length} bytes, Bits/Channel: ${entry.bitsPerChannel}, Channels: ${entry.channelSequence.join(', ')}\n`;
        });
        text += `\n`;
    }

    text += `Checksum: ${checksum}\n`;

    return text;
}
