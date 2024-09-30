// src/@types/encryptionStrategy.ts

import type { Buffer } from 'node:buffer';

export interface EncryptionStrategy {
    encrypt(data: Buffer, password: string): Buffer;
    decrypt(data: Buffer, password: string): Buffer;
}
