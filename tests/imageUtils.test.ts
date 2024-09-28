// src/tests/imageUtils.test.ts
import { describe, it, beforeAll, afterAll } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import sharp from 'sharp';

import fs from 'node:fs';

import {
    extractDataFromBuffer,
    getCachedImageTones,
    injectDataIntoBuffer,
    prewarmImageTonesCache
} from '../src/utils/image/imageUtils.ts';
import { ChannelSequence, ILogger } from '../src/@types/index.ts';
import { getLogger } from '../src/utils/misc/logUtils.ts';
import { Buffer } from 'node:buffer';

import * as path from 'jsr:@std/path';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const logger = getLogger('test');

describe('imageUtils Module', () => {
    let testImagePath: string;
    let width: number;
    let height: number;
    let channels: 1 | 2 | 3 | 4; // Corrected type
    let originalImageBuffer: Buffer;

    beforeAll(async () => {
        // Create a simple test image (e.g., 16x16 pixels, solid color)
        width = 16;
        height = 16;
        channels = 3; // RGB

        // Create a buffer filled with white pixels
        originalImageBuffer = Buffer.alloc(width * height * channels, 255); // Uniform fill with 255

        // Save the buffer to a temporary PNG file using sharp
        testImagePath = path.join(__dirname, 'test_output', 'test_image.png');
        await sharp(originalImageBuffer, {
            raw: {
                width,
                height,
                channels
            }
        })
            .png()
            .toFile(testImagePath);
    });

    afterAll(() => {
        // Cleanup: Delete the test image file
        if (fs.existsSync(testImagePath)) {
            fs.unlinkSync(testImagePath);
        }
    });

    describe('getCachedImageTones', () => {
        it('should analyze and cache image tones correctly', async () => {
            await prewarmImageTonesCache(path.dirname(testImagePath), logger);
            const capacity = getCachedImageTones(testImagePath, logger);

            expect(capacity).toEqual({
                low: 0, // White pixels have brightness 255, so low should be 0
                mid: 0, // Similarly, mid should be 0
                high: width * height // All pixels are high-tone
            });
        });

        it('should handle images with different tones', async () => {
            // Create a test image with varying brightness
            const gradientBuffer = Buffer.alloc(width * height * channels, 0); // Initialize with 0 (black)

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * channels;
                    const brightness = Math.floor((x / width) * 255);
                    gradientBuffer[idx] = brightness; // R
                    gradientBuffer[idx + 1] = brightness; // G
                    gradientBuffer[idx + 2] = brightness; // B
                }
            }

            const gradientImagePath = path.join(__dirname, 'test_output', 'gradient_image.png');
            await sharp(gradientBuffer, {
                raw: {
                    width,
                    height,
                    channels
                }
            })
                .png()
                .toFile(gradientImagePath);
            await prewarmImageTonesCache(path.dirname(gradientImagePath), logger);
            const capacity = getCachedImageTones(gradientImagePath, logger);

            // Calculate expected counts
            let expectedLow = 0;
            let expectedMid = 0;
            let expectedHigh = 0;

            for (let x = 0; x < width; x++) {
                const brightness = Math.floor((x / width) * 255);
                const pixelsInColumn = height;

                if (brightness < 85) {
                    expectedLow += pixelsInColumn;
                } else if (brightness < 170) {
                    expectedMid += pixelsInColumn;
                } else {
                    expectedHigh += pixelsInColumn;
                }
            }

            expect(capacity).toEqual({
                low: expectedLow,
                mid: expectedMid,
                high: expectedHigh
            });

            // Cleanup gradient image
            if (fs.existsSync(gradientImagePath)) {
                fs.unlinkSync(gradientImagePath);
            }
        });
    });

    describe('injectDataIntoBuffer and extractDataFromBuffer', () => {
        const dataToInject = Buffer.from('Hello, World!', 'utf-8');
        const bitsPerChannel = 1;
        const channelSequence: ChannelSequence[] = ['R', 'G', 'B'];
        const startBitPosition = 0;

        it('should inject and extract data correctly', async () => {
            // Load the original image buffer
            const image = sharp(testImagePath).removeAlpha().toColourspace('srgb');

            const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

            // Inject data into the buffer
            injectDataIntoBuffer(
                data,
                dataToInject,
                bitsPerChannel,
                channelSequence,
                startBitPosition,
                false, // debugVisual
                logger,
                info.width,
                info.height,
                info.channels as 1 | 2 | 3 | 4
            );

            // Create a new image buffer after injection
            const injectedImageBuffer = Buffer.from(data);

            // Extract data from the buffer
            const extractedData = extractDataFromBuffer(
                'test.png',
                injectedImageBuffer,
                bitsPerChannel,
                channelSequence,
                startBitPosition,
                dataToInject.length * 8,
                logger,
                info.channels as number // Pass channels
            );

            expect(extractedData.toString('utf-8')).toEqual(dataToInject.toString('utf-8'));
        });

        it('should throw an error when injecting data exceeds capacity', async () => {
            // Create a small image with limited capacity
            const smallWidth = 2;
            const smallHeight = 2;
            const smallChannels: 1 | 2 | 3 | 4 = 3;
            const smallBuffer = Buffer.alloc(smallWidth * smallHeight * smallChannels, 255); // Uniform fill with 255

            const smallImagePath = path.join(__dirname, 'test_output', 'small_image.png');
            await sharp(smallBuffer, {
                raw: {
                    width: smallWidth,
                    height: smallHeight,
                    channels: smallChannels
                }
            })
                .png()
                .toFile(smallImagePath);

            const data = Buffer.from('This data is too long for the small image', 'utf-8');

            // Load the small image buffer
            const image = sharp(smallImagePath).removeAlpha().toColourspace('srgb');

            const { data: smallData, info } = await image.raw().toBuffer({ resolveWithObject: true });

            expect(() =>
                injectDataIntoBuffer(
                    smallData,
                    data,
                    bitsPerChannel,
                    channelSequence,
                    startBitPosition,
                    false,
                    logger,
                    info.width,
                    info.height,
                    info.channels as 1 | 2 | 3 | 4
                )
            ).toThrow('Channel positions are out of bounds for data injection.');

            // Cleanup small image
            if (fs.existsSync(smallImagePath)) {
                fs.unlinkSync(smallImagePath);
            }
        });

        it('should handle different bitsPerChannel correctly', async () => {
            const data = Buffer.from([0b10101010, 0b11001100]); // Binary data

            const bitsPerChannelTest = 2;
            const channelSequenceTest: ChannelSequence[] = ['R', 'G'];

            // Load the original image buffer
            const image = sharp(testImagePath).removeAlpha().toColourspace('srgb');

            const { data: originalData, info } = await image.raw().toBuffer({ resolveWithObject: true });

            // Inject data
            injectDataIntoBuffer(
                originalData,
                data,
                bitsPerChannelTest,
                channelSequenceTest,
                startBitPosition,
                false,
                logger,
                info.width,
                info.height,
                info.channels as 1 | 2 | 3 | 4
            );

            // Extract data
            const extractedData = extractDataFromBuffer(
                'test.png',
                originalData,
                bitsPerChannelTest,
                channelSequenceTest,
                startBitPosition,
                data.length * 8,
                logger,
                info.channels as number // Pass channels
            );

            expect(extractedData).toEqual(data);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        let logger: ILogger;
        let testImagePath: string;
        let width: number;
        let height: number;
        let channels: 1 | 2 | 3 | 4; // Corrected type
        let originalImageBuffer: Buffer;

        beforeAll(async () => {
            // Initialize the mock logger
            logger = getLogger('test');

            // Create a simple test image (e.g., 16x16 pixels, solid color)
            width = 16;
            height = 16;
            channels = 3; // RGB

            // Create a buffer filled with white pixels
            originalImageBuffer = Buffer.alloc(width * height * channels, 255); // Uniform fill with 255

            // Save the buffer to a temporary PNG file using sharp
            testImagePath = path.join(__dirname, 'test_output', 'test_image_edge.png');
            await sharp(originalImageBuffer, {
                raw: {
                    width,
                    height,
                    channels
                }
            })
                .png()
                .toFile(testImagePath);
        });

        afterAll(() => {
            // Cleanup: Delete the test image file
            if (fs.existsSync(testImagePath)) {
                fs.unlinkSync(testImagePath);
            }
        });

        it('should throw an error for invalid bitsPerChannel', () => {
            const data = Buffer.from('Test Data', 'utf-8');

            // Invalid bitsPerChannel values
            expect(() =>
                injectDataIntoBuffer(
                    originalImageBuffer,
                    data,
                    0 as unknown as number, // Invalid bitsPerChannel
                    ['R', 'G', 'B'],
                    0,
                    false,
                    logger,
                    width,
                    height,
                    channels
                )
            ).toThrow('bitsPerChannel must be between 1 and 8.');

            expect(() =>
                injectDataIntoBuffer(
                    originalImageBuffer,
                    data,
                    9 as unknown as number, // Invalid bitsPerChannel
                    ['R', 'G', 'B'],
                    0,
                    false,
                    logger,
                    width,
                    height,
                    channels
                )
            ).toThrow('bitsPerChannel must be between 1 and 8.');
        });

        it('should throw an error for empty channelSequence', () => {
            const data = Buffer.from('Test Data', 'utf-8');

            expect(() =>
                injectDataIntoBuffer(
                    originalImageBuffer,
                    data,
                    1,
                    [], // Empty channelSequence
                    0,
                    false,
                    logger,
                    width,
                    height,
                    channels
                )
            ).toThrow('channelSequence cannot be empty.');
        });

        it('should throw an error for out-of-bounds startBitPosition', () => {
            const data = Buffer.from('Test Data', 'utf-8');

            const outOfBoundsStartBitPosition = Math.floor(width * height * channels); // For bitsPerChannel=1

            expect(() =>
                injectDataIntoBuffer(
                    originalImageBuffer,
                    data,
                    1,
                    ['R', 'G', 'B'],
                    outOfBoundsStartBitPosition, // Out of bounds
                    false,
                    logger,
                    width,
                    height,
                    channels
                )
            ).toThrow('Channel positions are out of bounds for data injection.');
        });

        it('should throw an error for invalid channel in channelSequence', () => {
            const data = Buffer.from('Test Data', 'utf-8');
            const invalidChannelSequence: ChannelSequence[] = ['R', 'G', 'X'] as unknown as ChannelSequence[]; // 'X' is invalid

            expect(() =>
                injectDataIntoBuffer(
                    originalImageBuffer,
                    data,
                    1,
                    invalidChannelSequence,
                    0,
                    false,
                    logger,
                    width,
                    height,
                    channels
                )
            ).toThrow('Invalid channel specified: X');
        });
    });
});
