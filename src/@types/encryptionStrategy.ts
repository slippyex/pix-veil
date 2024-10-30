// src/@types/encryptionStrategy.ts

export interface EncryptionStrategy {
    encrypt(data: Uint8Array, password: string): Promise<Uint8Array>;
    decrypt(data: Uint8Array, password: string): Promise<Uint8Array>;
}
