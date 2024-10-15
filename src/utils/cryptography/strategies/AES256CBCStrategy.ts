import { Buffer } from 'node:buffer';
import { uint8ArrayToBuffer } from '../../storage/storageUtils.ts';
import { crypto } from 'jsr:@std/crypto';
import { EncryptionStrategy } from '../../../@types/encryptionStrategy.ts';
/**
 * AES256CBCStrategy class provides methods for encrypting and decrypting data
 * using the AES-256-CBC encryption algorithm.
 *
 * This class implements the EncryptionStrategy interface.
 */
export class AES256CBCStrategy implements EncryptionStrategy {
    private readonly algorithm = 'AES-CBC';
    private readonly ivLength = 16;

    async encrypt(data: Buffer, password: string): Promise<Buffer> {
        const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
        const key = await this.generateKeyFromPassword(password);
        const encrypted = await crypto.subtle.encrypt(
            { name: this.algorithm, iv },
            key,
            data,
        );
        const encryptedData = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedData.length);
        combined.set(iv);
        combined.set(encryptedData, iv.length);
        return uint8ArrayToBuffer(combined);
    }

    async decrypt(data: Buffer, password: string): Promise<Buffer> {
        const iv = data.subarray(0, this.ivLength);
        const encrypted = data.subarray(this.ivLength);
        const key = await this.generateKeyFromPassword(password);
        const decrypted = await crypto.subtle.decrypt(
            { name: this.algorithm, iv },
            key,
            encrypted,
        );
        return Buffer.from(decrypted);
    }

    private async generateKeyFromPassword(password: string): Promise<CryptoKey> {
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
                salt: new Uint8Array(16), // You may want to replace this with a proper salt
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
