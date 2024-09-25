// test/codec.test.ts

import { encode } from '../src/encoder';
import { decode } from '../src/decoder';
import fs from 'fs';
import path from 'path';
import { Logger } from '../src/utils/Logger';

jest.setTimeout(5 * 30 * 1000);

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
        //    fs.rmSync(encodedFolder, { recursive: true, force: true });
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
            debugVisual: true,
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
            verbose: true,
            debugVisual: true,
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
                debugVisual: false,
                logger
            })
        ).rejects.toThrow();

        // Ensure the wrong decoded file was not created
        expect(fs.existsSync(wrongDecodedFile)).toBe(false);
    });

    it('should detect tampered data using checksum', async () => {
        const files = fs.readdirSync(encodedFolder);
        const firstPng = files.find(file => file.endsWith('.png'));

        if (!firstPng) {
            throw new Error('No PNG files found in the encoded folder');
        }

        const tamperedPng = path.join(encodedFolder, firstPng);
        const data = fs.readFileSync(tamperedPng);
        // Flip a bit in the PNG data, avoiding the debug blocks
        const tamperedData = Buffer.from(data);
        // Example: Flip a bit in the middle of the image data
        if (tamperedData.length > 100) {
            tamperedData[100] = tamperedData[100] ^ 0x01; // Flip the least significant bit
        }
        fs.writeFileSync(tamperedPng, tamperedData);

        const tamperedDecodedFile = path.join(decodedFolder, 'secret_decoded_tampered.pdf');
        const logger = new Logger(false);
        await expect(
            decode({
                inputFolder: encodedFolder,
                outputFile: tamperedDecodedFile,
                password,
                verbose: false,
                debugVisual: false,
                logger
            })
        ).rejects.toThrow('Data integrity check failed');

        // Ensure the tampered decoded file was not created
        expect(fs.existsSync(tamperedDecodedFile)).toBe(false);
    });
});
