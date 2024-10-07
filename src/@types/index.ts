// src/@types/index.ts

import type { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { SupportedCompressionStrategies } from '../utils/compression/compressionStrategies.ts';

export type ChannelSequence = 'R' | 'G' | 'B' | 'A';

export interface IChunk {
    id: number;
    data: Buffer;
}

export interface IDistributionMapEntry {
    chunkId: number;
    pngFile: string;
    startPosition: number;
    endPosition: number;
    bitsPerChannel: number;
    channelSequence: ChannelSequence[];
}

export interface IDistributionMap {
    entries: IDistributionMapEntry[];
    originalFilename: string;
    checksum: string;
    encryptedDataLength: number; // New field added
    compressionStrategy: SupportedCompressionStrategies;
}

export interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
}

export interface ImageCapacity {
    low: number;
    mid: number;
    high: number;
}

export interface IEncodeOptions {
    inputFile: string;
    inputPngFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    debugVisual: boolean;
    logger: ILogger;
    verify?: boolean;
}

export interface IDecodeOptions {
    inputFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    logger: ILogger;
}

export interface IUsedPng {
    usedCapacity: number;
    chunkCount: number;
    chunks: IChunk[];
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

export type IOutputInfo = sharp.OutputInfo;

export interface IAssembledImageData {
    data: Buffer;
    info: IOutputInfo;
}
