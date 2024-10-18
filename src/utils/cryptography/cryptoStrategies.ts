import { EncryptionStrategy } from '../../@types/index.ts';
import { AES256CBCStrategy } from './strategies/AES256CBCStrategy.ts';

export enum SupportedCryptoStrategies {
    AES256CBC = 'AES256CBC',
}

export const CryptoStrategies: Record<SupportedCryptoStrategies, EncryptionStrategy> = {
    [SupportedCryptoStrategies.AES256CBC]: new AES256CBCStrategy(),
};
