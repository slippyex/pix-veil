// src/utils/cryptography/crypto.ts

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { ILogger } from '../../@types/index.ts';
import { EncryptionStrategy } from './encryptionStrategy.ts';
import { AES256CBCStrategy } from './strategies/AES256CBCStrategy.ts';

/**
 * Encrypts the compressed data, generates checksum, and stores encrypted data.
 * @param compressedData - Compressed data buffer.
 * @param password - Password for encryption.
 * @param logger - Logger instance for debugging.
 * @returns Object containing encrypted data and its checksum.
 */
export function encryptData(compressedData: Buffer, password: string, logger: ILogger): Buffer {
    const encryptionStrategy: EncryptionStrategy = new AES256CBCStrategy();
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    const encryptedData = encryptionStrategy.encrypt(compressedData, password);
    const checksum = generateChecksum(encryptedData);
    if (logger.verbose) logger.info('Checksum generated for data integrity: ' + checksum);
    return encryptedData;
}

export function decryptData(encryptedBuffer: Buffer, password: string, logger: ILogger): Buffer {
    const encryptionStrategy: EncryptionStrategy = new AES256CBCStrategy();
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    return encryptionStrategy.decrypt(encryptedBuffer, password);
}
/**
 * Verifies the integrity of the encrypted data using checksum.
 */
export function verifyDataIntegrity(encryptedData: Buffer, checksum: string, logger: ILogger): void {
    if (logger.verbose) logger.info('Verifying data integrity...');
    const isChecksumValid = verifyChecksum(encryptedData, checksum);
    logger.debug(`Expected Checksum: ${checksum}`);
    logger.debug(`Computed Checksum: ${generateChecksum(encryptedData)}`);
    if (!isChecksumValid) {
        throw new Error('Data integrity check failed. The data may be corrupted or tampered with.');
    }
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
function verifyChecksum(buffer: Buffer, checksum: string): boolean {
    const computedChecksum = generateChecksum(buffer);
    console.log(computedChecksum);
    return computedChecksum === checksum;
}
