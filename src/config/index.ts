// src/config/index.ts

import { Buffer } from 'node:buffer';

export const MAGIC_BYTE = Buffer.from([0xde, 0xad, 0xfa, 0xce]);

export const config = {
    imageCompression: {
        compressionLevel: 7,
        adaptiveFiltering: false,
    },
    chunksDefinition: {
        maxChunksPerPng: 16, // Maximum number of chunks per PNG
        minChunksPerPng: 1, // Minimum number of chunks per PNG
        maxChunkSize: 8192, // Maximum size of each chunk in bytes
        minChunkSize: 1024, // Minimum size of each chunk in bytes
    },
    distributionMapFile: 'distribution_map',
    bitsPerChannelForDistributionMap: 2, // Must align with the embedding strategy
    toneWeighting: {
        low: 1.5, // Weighting factor for low-toned images
        mid: 1.0, // Weighting factor for mid-toned images
        high: 0.5, // Weighting factor for high-toned images
    },
};
