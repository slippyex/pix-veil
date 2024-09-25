// src/__tests__/imageUtils.test.ts

import sharp from 'sharp';

import fs from 'fs';
import path from 'path';
import { Logger } from '../src/utils/Logger';
import {
    extractDataFromBuffer,
    getCachedImageTones,
    getPixelIndex,
    injectDataIntoBuffer
} from '../src/utils/imageUtils';
import { ChannelSequence } from '../src/@types/types';

describe('imageUtils Module', () => {
    let logger: Logger;
    let testImagePath: string;
    let width: number;
    let height: number;
    let channels: 1 | 2 | 3 | 4; // Corrected type
    let originalImageBuffer: Buffer;

    beforeAll(async () => {
        // Initialize the mock logger
        logger = new Logger();

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
            const capacity = await getCachedImageTones(testImagePath, logger);

            expect(capacity).toEqual({
                low: 0, // White pixels have brightness 255, so low should be 0
                mid: 0, // Similarly, mid should be 0
                high: width * height // All pixels are high-tone
            });

            // Ensure caching works by calling again and checking logs
            const capacityCached = await getCachedImageTones(testImagePath, logger);
            expect(capacityCached).toEqual(capacity);
            expect(logger.debugMessages).toContain(`Retrieved cached tones for "${testImagePath}".`);
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

            const capacity = await getCachedImageTones(gradientImagePath, logger);

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
            await injectDataIntoBuffer(
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
            const extractedData = await extractDataFromBuffer(
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

            await expect(
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
            ).rejects.toThrow('Not enough space to inject all data.');

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
            await injectDataIntoBuffer(
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
            const extractedData = await extractDataFromBuffer(
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

        it('should add debug visual blocks when debugVisual is true', async () => {
            // Load the original image buffer
            const image = sharp(testImagePath).removeAlpha().toColourspace('srgb');

            const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

            // Inject data with debugVisual enabled
            await injectDataIntoBuffer(
                data,
                dataToInject,
                bitsPerChannel,
                channelSequence,
                startBitPosition,
                true, // debugVisual
                logger,
                info.width,
                info.height,
                info.channels as 1 | 2 | 3 | 4
            );

            // Create a new image buffer after injection
            const injectedImageBuffer = Buffer.from(data);

            // Verify that debug blocks are added
            // Red block at start, Blue block at end
            const blockSize = 8;

            // Calculate expected start and end positions
            const bitsUsed = Math.ceil((dataToInject.length * 8) / bitsPerChannel) * bitsPerChannel;
            const endBitPosition = startBitPosition + bitsUsed;

            const startPos = getPixelIndex(width, startBitPosition, bitsPerChannel, channelSequence);
            const endPos = getPixelIndex(width, endBitPosition, bitsPerChannel, channelSequence);

            // Check Red Block at start
            for (let y = startPos.y; y < Math.min(startPos.y + blockSize, height); y++) {
                for (let x = startPos.x; x < Math.min(startPos.x + blockSize, width); x++) {
                    const idx = (y * width + x) * channels;
                    expect(injectedImageBuffer[idx]).toBe(255); // R
                    expect(injectedImageBuffer[idx + 1]).toBe(0); // G
                    expect(injectedImageBuffer[idx + 2]).toBe(0); // B
                    if (channels === 4) {
                        expect(injectedImageBuffer[idx + 3]).toBe(255); // A
                    }
                }
            }

            // Check Blue Block at end
            for (let y = endPos.y; y < Math.min(endPos.y + blockSize, height); y++) {
                for (let x = endPos.x; x < Math.min(endPos.x + blockSize, width); x++) {
                    const idx = (y * width + x) * channels;
                    expect(injectedImageBuffer[idx]).toBe(0); // R
                    expect(injectedImageBuffer[idx + 1]).toBe(0); // G
                    expect(injectedImageBuffer[idx + 2]).toBe(255); // B
                    if (channels === 4) {
                        expect(injectedImageBuffer[idx + 3]).toBe(255); // A
                    }
                }
            }
        });
    });

    describe('Edge Cases and Error Handling', () => {
        let logger: Logger;
        let testImagePath: string;
        let width: number;
        let height: number;
        let channels: 1 | 2 | 3 | 4; // Corrected type
        let originalImageBuffer: Buffer;

        beforeAll(async () => {
            // Initialize the mock logger
            logger = new Logger();

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

        it('should throw an error for invalid bitsPerChannel', async () => {
            const data = Buffer.from('Test Data', 'utf-8');

            // Invalid bitsPerChannel values
            await expect(
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
            ).rejects.toThrow('bitsPerChannel must be between 1 and 8.');

            await expect(
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
            ).rejects.toThrow('bitsPerChannel must be between 1 and 8.');
        });

        it('should throw an error for empty channelSequence', async () => {
            const data = Buffer.from('Test Data', 'utf-8');

            await expect(
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
            ).rejects.toThrow('channelSequence cannot be empty.');
        });

        it('should throw an error for out-of-bounds startBitPosition', async () => {
            const data = Buffer.from('Test Data', 'utf-8');

            const outOfBoundsStartBitPosition = Math.floor(width * height * channels); // For bitsPerChannel=1

            await expect(
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
            ).rejects.toThrow('startBitPosition is out of bounds.');
        });

        it('should throw an error for invalid channel in channelSequence', async () => {
            const data = Buffer.from('Test Data', 'utf-8');
            const invalidChannelSequence: ChannelSequence[] = ['R', 'G', 'X'] as unknown as ChannelSequence[]; // 'X' is invalid

            await expect(
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
            ).rejects.toThrow('Invalid channel specified: X');
        });
    });
});
