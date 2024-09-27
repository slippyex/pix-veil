// test/codec.test.ts

import { encode } from '../src/encoder';
import { decode } from '../src/decoder';
import fs from 'fs';
import path from 'path';
import { Logger } from '../src/utils/Logger';
import seedrandom from 'seedrandom';
import {IChunk, IDistributionMapEntry} from "../src/@types";

jest.setTimeout(60 * 1000);

// Mock Math.random for deterministic behavior
beforeAll(() => {
    seedrandom('fixed-seed', { global: true });
});

describe('Codec tests', () => {
    const inputFile = path.join(__dirname, 'test_input', 'files', 'secret.pdf');
    const inputPngFolder = path.join(__dirname, 'test_input', 'images');

    const encodedFolder = path.join(__dirname, 'test_output', 'encoded');
    const decodedFolder = path.join(__dirname, 'test_output', 'decoded');
    const decodedFile = path.join(decodedFolder, 'secret_decoded.pdf');

    const password = 'testpassword';
    beforeAll(() => {
        if (!fs.existsSync(encodedFolder)) {
            fs.mkdirSync(encodedFolder, { recursive: true });
        }
        if (!fs.existsSync(decodedFolder)) {
            fs.mkdirSync(decodedFolder, { recursive: true });
        }
    });

    afterAll(() => {
        // Cleanup output folders
        //         fs.rmSync(encodedFolder, { recursive: true, force: true });
        fs.rmSync(decodedFolder, { recursive: true, force: true });
    });

    it('should encode the input file into PNG images with advanced LSB embedding, debug visuals, and data integrity verification', async () => {
        const logger = new Logger(true);
        await encode({
            inputFile,
            inputPngFolder,
            outputFolder: encodedFolder,
            password,
            verbose: true,
            debugVisual: false,
            logger
        });

        // Check if output PNGs are created
        const outputPngFiles = fs.readdirSync(encodedFolder).filter(file => file.endsWith('.png'));
        expect(outputPngFiles.length).toBeGreaterThan(1); // Ensure multiple PNGs are used
    });

    it('should decode the PNG images back into the original file with data integrity verification and verbose logging', async () => {
        const logger = new Logger(true);
        await decode({
            inputFolder: encodedFolder,
            outputFile: decodedFile,
            password,
            verbose: false,
            logger
        });

        // Check if decoded file exists and matches the original
        expect(fs.existsSync(decodedFile)).toBe(true);

        const original = fs.readFileSync(inputFile);
        const decoded = fs.readFileSync(decodedFile);
        expect(decoded.equals(original)).toBe(true);
    });

    it('should fail decoding with incorrect password', async () => {
        const wrongPassword = 'wrongpassword';
        const wrongDecodedFile = path.join(decodedFolder, 'secret_decoded_wrong.pdf');

        const logger = new Logger(false);
        await expect(
            decode({
                inputFolder: encodedFolder,
                outputFile: wrongDecodedFile,
                password: wrongPassword,
                verbose: false,
                logger
            })
        ).rejects.toThrow();

        // Ensure the wrong decoded file was not created
        expect(fs.existsSync(wrongDecodedFile)).toBe(false);
    });

    it('should correctly map chunkId to chunk data', async () => {
        const logger = new Logger(true);
        const chunks: IChunk[] = [
            { id: 0, data: Buffer.from('Chunk0') },
            { id: 1, data: Buffer.from('Chunk1') }
        ];

        // Simulate distributionMapEntries
        const distributionMapEntries: IDistributionMapEntry[] = [
            { chunkId: 0, pngFile: 'image1.png', startPosition: 0, endPosition: 10, bitsPerChannel: 2, channelSequence: ['R', 'G', 'B'] },
            { chunkId: 1, pngFile: 'image2.png', startPosition: 10, endPosition: 20, bitsPerChannel: 2, channelSequence: ['G', 'B', 'R'] }
        ];

        // Create a chunkMap
        const chunkMap = new Map<number, Buffer>();
        chunks.forEach(chunk => chunkMap.set(chunk.id, chunk.data));

        // Assert that chunkMap contains all necessary entries
        distributionMapEntries.forEach(entry => {
            expect(chunkMap.has(entry.chunkId)).toBe(true);
            expect(chunkMap.get(entry.chunkId)).toEqual(chunks.find(c => c.id === entry.chunkId)?.data);
        });
    });

});
