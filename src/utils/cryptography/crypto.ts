// src/utils/cryptography/crypto.ts

import type { ILogger } from '../../@types/index.ts';
import type { EncryptionStrategy } from '../../@types/encryptionStrategy.ts';

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { AES256CBCStrategy } from './strategies/AES256CBCStrategy.ts';

/**
 * Encrypts the provided compressed data using the specified password and encryption strategy.
 * Utilizes AES-256-CBC encryption to ensure data security. Additionally, it generates and logs
 * a checksum for data integrity verification.
 *
 * @param {Buffer} compressedData - The data to be encrypted in binary format.
 * @param {string} password - The password to use for the encryption process.
 * @param {ILogger} logger - The logger instance to log information during the encryption process.
 * @returns {Buffer} - The encrypted data in binary format.
 */
export function encryptData(compressedData: Buffer, password: string, logger: ILogger): Buffer {
    const encryptionStrategy: EncryptionStrategy = new AES256CBCStrategy();
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    const encryptedData = encryptionStrategy.encrypt(compressedData, password);
    const checksum = generateChecksum(encryptedData);
    if (logger.verbose) logger.info('Checksum generated for data integrity: ' + checksum);
    return encryptedData;
}

/**
 * Decrypts the given encrypted data using the provided password.
 * Utilizes the AES-256-CBC encryption strategy for decryption.
 *
 * @param {Buffer} encryptedBuffer - The buffer containing the encrypted data to be decrypted.
 * @param {string} password - The password to use for decrypting the data.
 * @param {ILogger} logger - Logger instance for logging information during the decryption process.
 * @returns {Buffer} - The decrypted data as a Buffer.
 */
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
 * Generates an SHA-256 checksum for the given buffer.
 *
 * @param {Buffer} buffer - The buffer for which to generate the checksum.
 * @return {string} The generated SHA-256 checksum encoded as a hexadecimal string.
 */
export function generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verifies whether the provided checksum matches the checksum computed from the given buffer.
 *
 * @param {Buffer} buffer - The buffer containing the data to compute the checksum from.
 * @param {string} checksum - The precomputed checksum to verify against.
 * @return {boolean} - Returns true if the computed checksum matches the provided checksum, otherwise false.
 */
function verifyChecksum(buffer: Buffer, checksum: string): boolean {
    const computedChecksum = generateChecksum(buffer);
    return computedChecksum === checksum;
}
