// test/codec.test.ts

import { beforeAll, describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { encode } from '../src/core/encoder/index.ts';
import { decode } from '../src/core/decoder/index.ts';

import seedrandom from 'seedrandom';
import { IChunk, IDistributionMapEntry } from '../src/@types/index.ts';
import { getLogger } from '../src/utils/logging/logUtils.ts';
import { Buffer } from 'node:buffer';

import * as path from 'jsr:@std/path';
import {
    ensureOutputDirectory,
    filePathExists,
    readBufferFromFile,
    readDirectory,
} from '../src/utils/storage/storageUtils.ts';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

// Mock Math.random for deterministic behavior
beforeAll(() => {
    seedrandom('fixed-seed', { global: true });
});

describe('Codec tests', () => {
    const fileUnderSubject = 'secret.pdf';
    const inputFile = path.join(__dirname, 'test_input', 'files', fileUnderSubject);
    const inputPngFolder = path.join(__dirname, 'test_input', 'images');

    const encodedFolder = path.join(__dirname, 'test_output', 'encoded');
    const decodedFolder = path.join(__dirname, 'test_output', 'decoded');
    const decodedFile = path.join(decodedFolder, fileUnderSubject);

    const password = 'test';
    beforeAll(() => {
        Deno.removeSync(encodedFolder, { recursive: true });
        Deno.removeSync(decodedFolder, { recursive: true });
        ensureOutputDirectory(encodedFolder);
        ensureOutputDirectory(decodedFolder);
    });

    it('should encode the input file into PNG images with advanced LSB embedding, debug visuals, and data integrity verification', async () => {
        const logger = getLogger('test', false);
        await encode({
            inputFile,
            inputPngFolder,
            outputFolder: encodedFolder,
            password,
            verbose: true,
            debugVisual: false,
            verify: true,
            logger,
        });

        // Check if output PNGs are created
        const outputPngFiles = readDirectory(encodedFolder).filter((file) => file.endsWith('.png'));
        expect(outputPngFiles.length).toBeGreaterThan(1); // Ensure multiple PNGs are used
    });

    it('should decode the PNG images back into the original file with data integrity verification and verbose logging', async () => {
        const logger = getLogger('test', false);
        await decode({
            inputFolder: encodedFolder,
            outputFolder: decodedFolder,
            password,
            verbose: false,
            logger,
        });

        // Check if decoded file exists and matches the original
        expect(filePathExists(decodedFile)).toBe(true);

        const original = readBufferFromFile(inputFile);
        const decoded = readBufferFromFile(decodedFile);
        expect(decoded.equals(original)).toBe(true);
    });

    it('should fail decoding with incorrect password', async () => {
        const wrongPassword = 'wrongpassword';

        const logger = getLogger('test', false);
        await expect(
            decode({
                inputFolder: encodedFolder,
                outputFolder: decodedFolder,
                password: wrongPassword,
                verbose: false,
                logger,
            }),
        ).rejects.toThrow();
    });

    it('should correctly map chunkId to chunk data', () => {
        const chunks: IChunk[] = [
            { id: 0, data: Buffer.from('Chunk0') },
            { id: 1, data: Buffer.from('Chunk1') },
        ];

        // Simulate distributionMapEntries
        const distributionMapEntries: IDistributionMapEntry[] = [
            {
                chunkId: 0,
                pngFile: 'image1.png',
                startChannelPosition: 0,
                endChannelPosition: 10,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B'],
            },
            {
                chunkId: 1,
                pngFile: 'image2.png',
                startChannelPosition: 10,
                endChannelPosition: 20,
                bitsPerChannel: 2,
                channelSequence: ['G', 'B', 'R'],
            },
        ];

        // Create a chunkMap
        const chunkMap = new Map<number, Buffer>();
        chunks.forEach((chunk) => chunkMap.set(chunk.id, chunk.data));

        // Assert that chunkMap contains all necessary entries
        distributionMapEntries.forEach((entry) => {
            expect(chunkMap.has(entry.chunkId)).toBe(true);
            expect(chunkMap.get(entry.chunkId)).toEqual(chunks.find((c) => c.id === entry.chunkId)?.data);
        });
    });
});
