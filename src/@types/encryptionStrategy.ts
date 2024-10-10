// src/@types/encryptionStrategy.ts

export interface IEncryptionStrategy {
    encrypt(data: Uint8Array, password: string): Promise<Uint8Array>;
    decrypt(data: Uint8Array, password: string): Promise<Uint8Array>;
}
