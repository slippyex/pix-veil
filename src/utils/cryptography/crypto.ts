// src/utils/cryptography/crypto.ts

import type { ILogger } from '../../@types/index.ts';
import type { EncryptionStrategy } from '../../@types/encryptionStrategy.ts';

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { AES256CBCStrategy } from './strategies/AES256CBCStrategy.ts';

/**
 * Encrypts the given compressed data using the provided encryption strategy.
 * Logs the process if verbose mode is enabled.
 *
 * @param {Buffer} data - The data to be encrypted, provided as a buffer.
 * @param {string} password - The password used to encrypt the data.
 * @param {ILogger} logger - The logger used to log the encryption process, especially if verbose mode is set to true.
 * @param {EncryptionStrategy} [encryptionStrategy=AES256CBCStrategy()] - The encryption strategy to be used. Defaults to AES-256-CBC if not provided.
 * @returns {Buffer} The encrypted data as a buffer.
 */
export function encryptData(
    data: Buffer,
    password: string,
    logger: ILogger,
    encryptionStrategy: EncryptionStrategy = new AES256CBCStrategy(),
): Buffer {
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    const encryptedData = encryptionStrategy.encrypt(data, password);
    const checksum = generateChecksum(encryptedData);
    if (logger.verbose) logger.info('Checksum generated for data integrity: ' + checksum);
    return encryptedData;
}

/**
 * Decrypts the provided encrypted buffer using the given password and encryption strategy.
 *
 * @param {Buffer} encryptedBuffer - The buffer containing encrypted data to be decrypted.
 * @param {string} password - The password used for the decryption process.
 * @param {ILogger} logger - The logger object used for logging information.
 * @param {EncryptionStrategy} [encryptionStrategy=new AES256CBCStrategy()] - The encryption strategy to use for decryption. Defaults to AES256CBCStrategy.
 * @returns {Buffer} - The decrypted buffer.
 */
export function decryptData(
    encryptedBuffer: Buffer,
    password: string,
    logger: ILogger,
    encryptionStrategy: EncryptionStrategy = new AES256CBCStrategy(),
): Buffer {
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    const checksum = generateChecksum(encryptedBuffer);
    logger.info(`checksum : ${checksum}`);
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
