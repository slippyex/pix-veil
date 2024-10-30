// src/utils/cryptography/strategies/AES256CBCStrategy.ts

import { crypto } from 'jsr:@std/crypto';
import { EncryptionStrategy } from '../../../@types/index.ts';
/**
 * AES256CBCStrategy class provides methods for encrypting and decrypting data
 * using the AES-256-CBC encryption algorithm.
 *
 * This class implements the EncryptionStrategy interface.
 */
export class AES256CBCStrategy implements EncryptionStrategy {
    private readonly algorithm = 'AES-CBC';
    private readonly ivLength = 16;

    /**
     * Encrypts provided data buffer using a specified password.
     * Combines salt, IV (initialization vector), and the encrypted data.
     *
     * @param {Uint8Array} data - The data buffer to encrypt.
     * @param {string} password - The password used to derive the encryption key.
     * @return {Promise<Uint8Array>} - A promise that resolves to a buffer containing the encrypted data.
     */
    async encrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
        const key = await this.generateKeyFromPassword(password, salt);
        const encrypted = await crypto.subtle.encrypt(
            { name: this.algorithm, iv },
            key,
            data,
        );
        const encryptedData = new Uint8Array(encrypted);
        // Combine salt, iv, and encrypted data
        const combined = new Uint8Array(salt.length + iv.length + encryptedData.length);
        combined.set(salt);
        combined.set(iv, salt.length);
        combined.set(encryptedData, salt.length + iv.length);
        return combined;
    }

    /**
     * Decrypts the given data using the provided password.
     *
     * @param {Uint8Array} data - The encrypted data buffer containing salt, IV, and the encrypted content.
     * @param {string} password - The password to derive the decryption key.
     * @return {Promise<Uint8Array>} - The decrypted data as a buffer.
     */
    async decrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
        const salt = data.subarray(0, 16);
        const iv = data.subarray(16, 32);
        const encrypted = data.subarray(32);
        const key = await this.generateKeyFromPassword(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: this.algorithm, iv },
            key,
            encrypted,
        );
        return new Uint8Array(decrypted);
    }

    /**
     * Generates a cryptographic key from a password using PBKDF2.
     *
     * @param {string} password - The password to generate the key from.
     * @param {Uint8Array} salt - The salt to use for the key derivation.
     * @return {Promise<CryptoKey>} A promise that resolves to the generated cryptographic key.
     */
    private async generateKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: this.algorithm, length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }
}
