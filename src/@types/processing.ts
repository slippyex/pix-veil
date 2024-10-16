// src/@types/processing.ts

import type { Buffer } from 'node:buffer';
import type { IDistributionMapEntry } from './distribution.ts';

export interface IFileCapacityInfo {
    file: string;
    capacity: number;
    tone: 'low' | 'mid' | 'high';
}
export interface IChunk {
    chunkId: number;
    data: Buffer;
}

export type PngToChunksMap = Record<string, IDistributionMapEntry[]>;
