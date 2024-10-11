// src/@types/processing.ts

import type { Buffer } from 'node:buffer';
import sharp from 'sharp';

export type ChannelSequence = 'R' | 'G' | 'B' | 'A';

export interface IChunk {
    chunkId: number;
    data: Uint8Array;
}

export interface IFileCapacityInfo {
    file: string;
    capacity: number;
    tone: 'low' | 'mid' | 'high';
}
export interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
}

export interface ImageCapacity {
    low: number;
    mid: number;
    high: number;
}

export interface IUsedPng {
    usedCapacity: number;
    chunkCount: number;
    chunks: IChunk[];
}

export interface IAssembledImageData {
    data: Buffer;
    info: sharp.OutputInfo;
}
