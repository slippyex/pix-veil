// src/utils/cryptoUtils.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encrypt(buffer: Buffer, password: string): Buffer {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
}

export function decrypt(buffer: Buffer, password: string): Buffer {
    const iv = buffer.subarray(0, IV_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH);
    const key = crypto.createHash('sha256').update(password).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Generate SHA-256 checksum of the buffer.
 */
export function generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify if the checksum matches.
 */
export function verifyChecksum(buffer: Buffer, checksum: string): boolean {
    const computedChecksum = generateChecksum(buffer);
    return computedChecksum === checksum;
}
