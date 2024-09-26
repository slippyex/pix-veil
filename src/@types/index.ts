// src/@types/index.ts

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

export interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
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
    logger: ILogger;
}

export interface DecodeOptions {
    inputFolder: string;
    outputFile: string;
    password: string;
    verbose: boolean;
    debugVisual: boolean;
    logger: ILogger;
}
export interface IUsedPng {
    usedCapacity: number;
    chunkCount: number;
    chunks: Chunk[];
}

export interface ILogger {
    debugMessages: string[];
    errorMessages: string[];
    readonly verbose: boolean;

    info(message: string): void;

    success(message: string): void;

    warn(message: string): void;

    error(message: string): void;

    debug(message: string): void;
}
