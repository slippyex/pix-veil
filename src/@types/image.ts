// src/@types/image.ts

import type { Buffer } from 'node:buffer';
import sharp from 'sharp';

export interface IAssembledImageData {
    data: Buffer;
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
