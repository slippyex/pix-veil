import type { Buffer } from 'node:buffer';

export interface IFileCapacityInfo {
    file: string;
    capacity: number;
    tone: 'low' | 'mid' | 'high';
}
export interface IChunk {
    chunkId: number;
    data: Buffer;
}
