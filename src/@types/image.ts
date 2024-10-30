// src/@types/image.ts

export interface IAssembledImageData {
    data: Uint8Array;
    info: OutputInfo;
    meta: Metadata;
}

export interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
}

export interface ImageCapacity {
    low: number;
    mid: number;
    high: number;
}

export interface Metadata {
    width?: number;
    height?: number;
    channels?: 1 | 2 | 4 | 3;
}

export type OutputInfo = Required<Metadata>;
