// src/config.ts

import { Buffer } from 'node:buffer';

export const MAGIC_BYTE = Buffer.from([0xde, 0xad, 0xfa, 0xce]);

export const config = {
    imageCompression: {
        compressionLevel: 7,
        adaptiveFiltering: false
    },
    chunksDefinition: {
        maxChunksPerPng: 16,
        minChunksPerPng: 1,
        maxChunkSize: 4096,
        minChunkSize: 16
    },
    distributionMapFile: 'distribution_map',
    // Using 2 bits per channel on all RGB channels
    bitsPerChannelForDistributionMap: 2
};
