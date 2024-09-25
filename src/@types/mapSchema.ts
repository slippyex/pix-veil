// src/mapSchema.ts

import { ChannelSequence } from './types';

export interface DistributionMapHeader {
    //    magic: Buffer;           // MAGIC_BYTES (e.g., 4 bytes)
    entryCount: number; // 4 bytes
}

export interface DistributionMapEntrySchema {
    chunkId: number; // 4 bytes
    fileNameLength: number; // 2 bytes
    fileName: string; // Variable length
    startPosition: number; // 4 bytes
    endPosition: number; // 4 bytes
    bitsPerChannel: number; // 1 byte
    channelSeqLength: number; // 1 byte
    channelSequence: ChannelSequence[]; // Variable bits, packed into bytes
}

export interface DistributionMapChecksum {
    checksumLength: number; // 2 bytes
    checksum: Buffer; // Variable length
}

export interface DistributionMapBuffer {
    header: DistributionMapHeader;
    entries: DistributionMapEntrySchema[];
    checksum: DistributionMapChecksum;
}
