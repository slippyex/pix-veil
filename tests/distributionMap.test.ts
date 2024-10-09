// tests/distributionMap.test.ts

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { IDistributionMapEntry } from '../src/@types/index.ts';
import { createDistributionMap } from '../src/utils/distributionMap/mapUtils.ts';
import { deserializeDistributionMap } from '../src/utils/distributionMap/mapHelpers.ts';

import { SupportedCompressionStrategies } from '../src/utils/compression/compressionStrategies.ts';

Deno.env.set('ENVIRONMENT', 'test');

const checksum = 'abcdef1234567890';
const encryptionLength = 1024; // Example encrypted data length
const compressionStrategy = SupportedCompressionStrategies.Brotli;

describe('Distribution Map Serialization', () => {
    it('should serialize and deserialize distribution map correctly', () => {
        const originalFilename = 'file.ext';
        const entries: IDistributionMapEntry[] = [
            {
                chunkId: 1,
                pngFile: 'image1.png',
                startChannelPosition: 0,
                endChannelPosition: 100,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            },
            {
                chunkId: 2,
                pngFile: 'image2.png',
                startChannelPosition: 100,
                endChannelPosition: 200,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            },
        ];

        const serialized = createDistributionMap(
            entries,
            compressionStrategy,
            originalFilename,
            checksum,
            encryptionLength,
        );
        const deserialized = deserializeDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
        expect(deserialized.originalFilename).toEqual(originalFilename);
        expect(deserialized.encryptedDataLength).toEqual(encryptionLength);
        expect(deserialized.compressionStrategy).toEqual(compressionStrategy);
    });

    it('should handle empty distribution map entries', () => {
        const originalFilename = 'empty.ext';
        const entries: IDistributionMapEntry[] = [];
        const checksum = '0000000000000000';
        const encryptionLength = 0;
        const compressionStrategy = SupportedCompressionStrategies.None;

        const serialized = createDistributionMap(
            entries,
            compressionStrategy,
            originalFilename,
            checksum,
            encryptionLength,
        );
        const deserialized = deserializeDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
        expect(deserialized.originalFilename).toEqual(originalFilename);
        expect(deserialized.encryptedDataLength).toEqual(encryptionLength);
        expect(deserialized.compressionStrategy).toEqual(compressionStrategy);
    });

    it('should handle large distribution map entries', () => {
        const originalFilename = 'large.ext';
        const entries: IDistributionMapEntry[] = [];

        // Generate 1000 entries
        for (let i = 0; i < 1000; i++) {
            entries.push({
                chunkId: i,
                pngFile: `image${i}.png`,
                startChannelPosition: i * 10,
                endChannelPosition: i * 10 + 10,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            });
        }

        const checksum = '1234567890abcdef';
        const encryptionLength = 10000;
        const compressionStrategy = SupportedCompressionStrategies.GZip;

        const serialized = createDistributionMap(
            entries,
            compressionStrategy,
            originalFilename,
            checksum,
            encryptionLength,
        );
        const deserialized = deserializeDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
        expect(deserialized.originalFilename).toEqual(originalFilename);
        expect(deserialized.encryptedDataLength).toEqual(encryptionLength);
        expect(deserialized.compressionStrategy).toEqual(compressionStrategy);
    });

    it('should handle filenames with special characters', () => {
        const originalFilename = 'file @#$%.txt';
        const entries: IDistributionMapEntry[] = [
            {
                chunkId: 1,
                pngFile: 'image@!.png',
                startChannelPosition: 0,
                endChannelPosition: 50,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            },
        ];
        const checksum = 'abcdef1234567890';
        const encryptionLength = 512;
        const compressionStrategy = SupportedCompressionStrategies.Brotli;

        const serialized = createDistributionMap(
            entries,
            compressionStrategy,
            originalFilename,
            checksum,
            encryptionLength,
        );
        const deserialized = deserializeDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
        expect(deserialized.originalFilename).toEqual(originalFilename);
        expect(deserialized.encryptedDataLength).toEqual(encryptionLength);
        expect(deserialized.compressionStrategy).toEqual(compressionStrategy);
    });

    it('should validate magic bytes during serialization and deserialization', () => {
        const originalFilename = 'magic.ext';
        const entries: IDistributionMapEntry[] = [
            {
                chunkId: 1,
                pngFile: 'magic_image.png',
                startChannelPosition: 0,
                endChannelPosition: 100,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            },
        ];
        const checksum = 'deadbeefcafebabe';
        const encryptionLength = 256;
        const compressionStrategy = SupportedCompressionStrategies.GZip;

        const serialized = createDistributionMap(
            entries,
            compressionStrategy,
            originalFilename,
            checksum,
            encryptionLength,
        );

        // Corrupt the magic bytes
        serialized[0] = 0x00;
        serialized[1] = 0x00;
        serialized[2] = 0x00;
        serialized[3] = 0x00;

        expect(() => deserializeDistributionMap(serialized)).toThrow(
            'Magic bytes not found at the start of the distribution map.',
        );
    });
});
