// src/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const DIGEST = 'sha256';

/**
 * Derives a key from the given password and salt using PBKDF2.
 * @param password The password.
 * @param salt The salt.
 * @returns The derived key.
 */
const deriveKey = (password: string, salt: Buffer): Buffer => {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
};

/**
 * Encrypts the given data using AES-256-CBC.
 * The returned Buffer contains the salt, IV, and encrypted data concatenated.
 * @param data The data to encrypt.
 * @param password The password for encryption.
 * @returns The encrypted data as a Buffer.
 */
export const encryptData = (data: Buffer, password: string): Buffer => {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]);
};

/**
 * Decrypts the given data using AES-256-CBC.
 * Expects the input Buffer to contain the salt, IV, and encrypted data concatenated.
 * @param data The encrypted data as a Buffer.
 * @param password The password for decryption.
 * @returns The decrypted data as a Buffer.
 */
export const decryptData = (data: Buffer, password: string): Buffer => {
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = data.slice(SALT_LENGTH + IV_LENGTH);
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted;
};
