// src/utils/compression.ts
import { promisify } from 'util';
import zlib from 'zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export const compressData = async (data: Buffer): Promise<Buffer> => {
    return await brotliCompress(data);
};

export const decompressData = async (data: Buffer): Promise<Buffer> => {
    return await brotliDecompress(data);
};
