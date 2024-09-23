// tests/encoder.test.ts
import { encode } from '../src/encoder/encode';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { decode } from "../src/decoder/decode";

describe('En-/Decoder tests', () => {
    const testDir = path.join(__dirname, 'test_env');
    const inputFile = path.join(testDir, 'secret.txt');
    const inputImagesDir = path.join(__dirname, 'fixed_images');
    const outputDir = path.join(testDir, 'output_images');
    const password = 'testpassword';

    const decodedDir = path.join(testDir, 'decoded_files');
    const outputFile = path.join(decodedDir, 'secret_decoded.txt');

    beforeAll(async () => {
        try {
            // Setup test environment
            await fs.promises.mkdir(testDir, { recursive: true });
            await fs.promises.mkdir(outputDir, { recursive: true });
            await fs.promises.mkdir(decodedDir, { recursive: true });

            // Create a dummy secret file
            await fs.promises.writeFile(inputFile, 'This is a secret message.');
        } catch (error) {
            console.error('Error during test setup:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // Clean up test environment
        // Uncomment the following line to enable cleanup after tests
        // await fs.promises.rm(testDir, { recursive: true, force: true });
    });

    it('should encode a file into images', async () => {
        try {
            console.log('Starting encoding test...');
            await encode({ inputFile, inputImagesDir, outputDir, password });
            console.log('Encoding test completed.');

            // Check if output directory exists and has files
            expect(fs.existsSync(outputDir)).toBe(true);
            const outputFiles = await fs.promises.readdir(outputDir);
            expect(outputFiles.length).toBeGreaterThan(0);

            // Check if distribution_info.png exists
            expect(outputFiles).toContain('distribution_info.png');

            // Validate that output images are valid PNGs
            for (const file of outputFiles) {
                const filePath = path.join(outputDir, file);
                if (path.extname(filePath).toLowerCase() === '.png') {
                    await expect(fs.promises.access(filePath, fs.constants.R_OK)).resolves.toBeUndefined();
                    // Attempt to read metadata to ensure it's a valid PNG
                    await expect(sharp(filePath).metadata()).resolves.toBeTruthy();
                }
            }
        } catch (error) {
            console.error('Encoder test failed:', error);
            throw error;
        }
    });

    it('should decode a file from images', async () => {
        try {
            console.log('Starting decoding test...');
            await decode({ inputImagesDir: outputDir, outputFile, password });
            console.log('Decoding test completed.');

            // Check if output file exists
            expect(fs.existsSync(outputFile)).toBe(true);

            // Read the decoded content
            const decodedContent = await fs.promises.readFile(outputFile, 'utf-8');
            expect(decodedContent).toBe('This is a secret message.');
        } catch (error) {
            console.error('Decoder test failed:', error);
            throw error;
        }
    });
});
