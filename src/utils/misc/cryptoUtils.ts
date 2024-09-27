// src/utils/misc/cryptoUtils.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts a buffer using the given password.
 *
 * @param buffer - The data to be encrypted.
 * @param password - The password to use for encryption.
 * @return The encrypted data as a Buffer.
 */
export function encrypt(buffer: Buffer, password: string): Buffer {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypts the given buffer using the provided password.
 *
 * @param buffer - The buffer containing the encrypted data.
 * @param password - The password used to derive the decryption key.
 * @return The decrypted data as a Buffer.
 */
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
    console.log(computedChecksum);
    return computedChecksum === checksum;
}
