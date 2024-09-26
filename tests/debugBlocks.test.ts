// src/tests/debugBlocks.test.ts

import { addDebugBlocks } from '../src/utils/image/debug';
import { Logger } from '../src/utils/Logger';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import {ChannelSequence} from "../src/@types";
import {getPixelIndex} from "../src/utils/image/imageHelper";

describe('Debug Visual Blocks', () => {
    const width = 16;
    const height = 16;
    const channels = 3;
    const imageBuffer = Buffer.alloc(width * height * channels, 255); // White image
    const imagePath = path.join(__dirname, 'test_output', 'debug_test_image.png');

    beforeAll(async () => {
        await sharp(imageBuffer, {
            raw: {
                width,
                height,
                channels
            }
        })
            .png()
            .toFile(imagePath);
    });

    afterAll(() => {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    });

    it('should add red and blue blocks at specified positions', async () => {
        const logger = new Logger(false);
        const image = sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
        const { data, info } = await image;

        const startBitPosition = 0;
        const endBitPosition = 100;
        const bitsPerChannel = 2;
        const channelSequence = ['R', 'G', 'B'] as ChannelSequence[];

        addDebugBlocks(
            data,
            width,
            height,
            channels,
            startBitPosition,
            endBitPosition,
            bitsPerChannel,
            channelSequence,
            logger
        );

        // Save the modified image for manual inspection if needed
        const modifiedImagePath = path.join(__dirname, 'test_output', 'debug_test_image_modified.png');
        await sharp(data, {
            raw: {
                width,
                height,
                channels
            }
        })
            .png()
            .toFile(modifiedImagePath);

        // Verify red block at start position
        const startPos = getPixelIndex(width, startBitPosition, bitsPerChannel, channelSequence);
        for (let y = startPos.y; y < Math.min(startPos.y + 8, height); y++) {
            for (let x = startPos.x; x < Math.min(startPos.x + 8, width); x++) {
                const idx = (y * width + x) * channels;
                expect(data[idx]).toBe(255); // R
                expect(data[idx + 1]).toBe(0); // G
                expect(data[idx + 2]).toBe(0); // B
            }
        }

        // Verify blue block at end position
        const endPos = getPixelIndex(width, endBitPosition, bitsPerChannel, channelSequence);
        for (let y = endPos.y; y < Math.min(endPos.y + 8, height); y++) {
            for (let x = endPos.x; x < Math.min(endPos.x + 8, width); x++) {
                const idx = (y * width + x) * channels;
                expect(data[idx]).toBe(0); // R
                expect(data[idx + 1]).toBe(0); // G
                expect(data[idx + 2]).toBe(255); // B
            }
        }

        // Cleanup modified image
        if (fs.existsSync(modifiedImagePath)) {
            fs.unlinkSync(modifiedImagePath);
        }
    });
});
