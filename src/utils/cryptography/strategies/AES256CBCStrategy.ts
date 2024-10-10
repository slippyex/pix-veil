// src/utils/cryptography/strategies/AES256CBCStrategy.ts

import type { IEncryptionStrategy } from '../../../@types/encryptionStrategy.ts';

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

/**
 * AES256CBCStrategy class provides methods for encrypting and decrypting data
 * using the AES-256-CBC encryption algorithm.
 *
 * This class implements the EncryptionStrategy interface.
 */
export class AES256CBCStrategy implements IEncryptionStrategy {
    private readonly algorithm = 'aes-256-cbc';
    private readonly ivLength = 16;

    encrypt(data: Buffer, password: string): Buffer {
        const iv = crypto.randomBytes(this.ivLength);
        const key = crypto.createHash('sha256').update(password).digest();
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    }

    decrypt(data: Buffer, password: string): Buffer {
        const iv = data.subarray(0, this.ivLength);
        const encrypted = data.subarray(this.ivLength);
        const key = crypto.createHash('sha256').update(password).digest();
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAutoPadding(false);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
}
