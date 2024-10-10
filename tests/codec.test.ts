// test/codec.test.ts

import { afterAll, beforeAll, describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { encode } from '../src/core/encoder/index.ts';

import seedrandom from 'seedrandom';
import { IChunk, IDistributionMapEntry } from '../src/@types/index.ts';
import { Buffer } from 'node:buffer';

import * as path from 'jsr:@std/path';
import { ensureOutputDirectory, findProjectRoot, readDirectory } from '../src/utils/storage/storageUtils.ts';
import fs from 'node:fs';
import { getLogger, NoopLogFacility } from '../src/utils/logging/logUtils.ts';
import { closeKv } from '../src/utils/cache/cacheHelper.ts';

const logger = getLogger('test-cases', NoopLogFacility, false);

Deno.env.set('ENVIRONMENT', 'test');

// Mock Math.random for deterministic behavior
beforeAll(() => {
    seedrandom('fixed-seed', { global: true });
});

describe('Codec tests', () => {
    const fileUnderSubject = 'secret.pdf';
    const rootFolder = findProjectRoot(Deno.cwd()) as string;
    const inputFile = path.join(rootFolder, 'tests', 'test_input', 'files', fileUnderSubject);
    const inputPngFolder = path.join(rootFolder, 'tests', 'test_input', 'images');

    const encodedFolder = path.join(rootFolder, 'tests', 'test_output', 'encoded');
    const decodedFolder = path.join(rootFolder, 'tests', 'test_output', 'decoded');

    const password = 'test';
    beforeAll(async () => {
        // Ensure clean test environment
        fs.rmSync(encodedFolder, { recursive: true, force: true });
        fs.rmSync(decodedFolder, { recursive: true, force: true });
        await ensureOutputDirectory(encodedFolder);
        await ensureOutputDirectory(decodedFolder);
    });

    afterAll(() => {
        // Cleanup: Remove encoded and decoded folders
        //     fs.rmSync(encodedFolder, { recursive: true, force: true });
        //     fs.rmSync(decodedFolder, { recursive: true, force: true });
        closeKv();
    });

    it('should encode and verify the decoded the input file into PNG images', async () => {
        await encode({
            inputFile,
            inputPngFolder,
            outputFolder: encodedFolder,
            password,
            verbose: false,
            debugVisual: true,
            verify: true,
            logger,
        });

        // Check if output PNGs are created
        const outputPngFiles = readDirectory(encodedFolder).filter((file) => file.endsWith('.png'));
        expect(outputPngFiles.length).toBeGreaterThan(1); // Ensure multiple PNGs are used
    });

    it('should correctly map chunkId to chunk data', () => {
        const chunks: IChunk[] = [
            { chunkId: 0, data: Buffer.from('Chunk0') },
            { chunkId: 1, data: Buffer.from('Chunk1') },
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
        chunks.forEach((chunk) => chunkMap.set(chunk.chunkId, chunk.data));

        // Assert that chunkMap contains all necessary entries
        distributionMapEntries.forEach((entry) => {
            expect(chunkMap.has(entry.chunkId)).toBe(true);
            expect(chunkMap.get(entry.chunkId)).toEqual(chunks.find((c) => c.chunkId === entry.chunkId)?.data);
        });
    });
});
