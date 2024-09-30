import { Buffer } from 'node:buffer';
import { EncryptionStrategy } from '../../../@types/encryptionStrategy.ts';
import crypto from 'node:crypto';

export class AES256CBCStrategy implements EncryptionStrategy {
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
        const iv = data.slice(0, this.ivLength);
        const encrypted = data.slice(this.ivLength);
        const key = crypto.createHash('sha256').update(password).digest();
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
}
