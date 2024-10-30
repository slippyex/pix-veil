// src/@types/image.ts

import sharp from 'sharp';

export interface IAssembledImageData {
    data: Uint8Array;
    info: sharp.OutputInfo;
}

export interface ImageToneCache {
    [imagePath: string]: ImageCapacity;
}

export interface ImageCapacity {
    low: number;
    mid: number;
    high: number;
}
