import type { Buffer } from 'node:buffer';
import sharp from 'sharp';

export type ChannelSequence = 'R' | 'G' | 'B' | 'A';

export interface IChunk {
    id: number;
    data: Buffer;
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
