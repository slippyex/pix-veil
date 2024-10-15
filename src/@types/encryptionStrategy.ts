// src/@types/encryptionStrategy.ts

import type { Buffer } from 'node:buffer';

export interface EncryptionStrategy {
    encrypt(data: Buffer, password: string): Promise<Buffer>;
    decrypt(data: Buffer, password: string): Promise<Buffer>;
}
