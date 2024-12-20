// test/codec.test.ts

import { afterAll, beforeAll, describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { encode } from '../src/core/encoder/index.ts';

import seedrandom from 'seedrandom';
import { IChunk, IDistributionMapEntry } from '../src/@types/index.ts';

import * as path from 'jsr:@std/path';
import { ensureOutputDirectory, findProjectRoot, readDirectory } from '../src/utils/storage/storageUtils.ts';

import { getLogger, NoopLogFacility } from '../src/utils/logging/logUtils.ts';
import { closeKv } from '../src/utils/cache/cacheHelper.ts';
Deno.env.set('ENVIRONMENT', 'test');

const logger = getLogger('test-cases', NoopLogFacility, false);

// Mock Math.random for deterministic behavior
beforeAll(() => {
    seedrandom('fixed-seed', { global: true });
});

describe('Codec tests', () => {
    const fileUnderSubject = 'secret.pdf';
    const rootFolder = findProjectRoot(Deno.cwd()) as string;
    const inputFile = path.join(rootFolder, 'tests', 'test_input_files', 'files', fileUnderSubject);
    const inputPngFolder = path.join(rootFolder, 'tests', 'test_input_files', 'images');

    const encodedFolder = path.join(rootFolder, 'tests', 'test_output', 'encoded');
    const decodedFolder = path.join(rootFolder, 'tests', 'test_output', 'decoded');

    const password = 'test';
    beforeAll(() => {
        // Ensure clean test environment
        ensureOutputDirectory(encodedFolder);
        ensureOutputDirectory(decodedFolder);
    });

    afterAll(async () => {
        // Cleanup: Remove encoded and decoded folders
        await Deno.remove(decodedFolder, { recursive: true });
        closeKv();
    });

    it('should encode and verify the decoded the input file into PNG images', async () => {
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

    it('should correctly map chunkId to chunk data', () => {
        const te = new TextEncoder();
        const chunks: IChunk[] = [
            { chunkId: 0, data: te.encode('Chunk0') },
            { chunkId: 1, data: te.encode('Chunk1') },
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
        const chunkMap = new Map<number, Uint8Array>();
        chunks.forEach((chunk) => chunkMap.set(chunk.chunkId, chunk.data));

        // Assert that chunkMap contains all necessary entries
        distributionMapEntries.forEach((entry) => {
            expect(chunkMap.has(entry.chunkId)).toBe(true);
            expect(chunkMap.get(entry.chunkId)).toEqual(chunks.find((c) => c.chunkId === entry.chunkId)?.data);
        });
    });
});
