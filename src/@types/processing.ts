// src/@types/processing.ts

import type { IDistributionMapEntry } from './distribution.ts';

export interface IFileCapacityInfo {
    file: string;
    capacity: number;
    tone: 'low' | 'mid' | 'high';
}
export interface IChunk {
    chunkId: number;
    data: Uint8Array;
}

export type PngToChunksMap = Record<string, IDistributionMapEntry[]>;
