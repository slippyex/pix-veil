// src/types.ts

import { Logger } from './shared/utils/Logger';

export type ChannelSequence = 'R' | 'G' | 'B' | 'A';

export interface Chunk {
    id: number;
    data: Buffer;
}

export interface DistributionMapEntry {
    chunkId: number;
    pngFile: string;
    startPosition: number;
    endPosition: number;
    bitsPerChannel: number;
    channelSequence: ChannelSequence[];
}

export interface DistributionMap {
    entries: DistributionMapEntry[];
    checksum: string;
}

export interface ImageCapacity {
    low: number;
    mid: number;
    high: number;
}

export interface EncodeOptions {
    inputFile: string;
    inputPngFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    debugVisual: boolean;
    logger: Logger;
}

export interface DecodeOptions {
    inputFolder: string;
    outputFile: string;
    password: string;
    verbose: boolean;
    debugVisual: boolean;
    logger: Logger;
}
