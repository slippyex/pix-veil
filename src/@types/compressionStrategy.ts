// src/@types/compressionStrategy.ts

export interface CompressionStrategy {
    compress(data: Uint8Array): Uint8Array;
    decompress(data: Uint8Array): Uint8Array;
}
