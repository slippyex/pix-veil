import { ChannelSequence, SupportedCompressionStrategies } from './index.ts';
import type { Buffer } from 'node:buffer';

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
    encryptedDataLength: number; // New field added
    compressionStrategy: SupportedCompressionStrategies;
}

export interface IChunkDistributionInfo {
    distributionMapEntries: IDistributionMapEntry[];
    chunkMap: Map<number, Buffer>;
}
