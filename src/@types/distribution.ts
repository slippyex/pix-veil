// src/@types/distribution.ts

import { SupportedCompressionStrategies } from '../utils/compression/compressionStrategies.ts';
import { IChunk } from './processing.ts';

export type ChannelSequence = 'R' | 'G' | 'B' | 'A';
export interface IDistributionMapEntry {
    chunkId: number;
    pngFile: string;
    startChannelPosition: number;
    endChannelPosition: number;
    bitsPerChannel: number;
    channelSequence: ChannelSequence[];
}

export interface IDistributionMap {
    entries: IDistributionMapEntry[];
    originalFilename: string;
    checksum: string;
    encryptedDataLength: number;
    compressionStrategy: SupportedCompressionStrategies;
}

export interface IChunkDistributionInfo {
    distributionMapEntries: IDistributionMapEntry[];
    chunkMap: Map<number, Uint8Array>;
}

export interface IUsedPng {
    usedCapacity: number;
    chunkCount: number;
    chunks: IChunk[];
}
