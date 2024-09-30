// src/tests/imageHandling.test.ts

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { getCachedImageTones, processImageTones } from '../src/utils/imageProcessing/imageUtils.ts';
import sharp from 'sharp';

import fs from 'node:fs';
import { getLogger } from '../src/utils/logging/logUtils.ts';
import { Buffer } from 'node:buffer';
import * as path from 'jsr:@std/path';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const logger = getLogger('test');

describe('Image Utilities with Various Image Types', () => {
    it('should handle grayscale images correctly', async () => {
        // Create a grayscale image (1 channel)
        const grayscaleWidth = 8;
        const grayscaleHeight = 8;
        const grayscaleChannels = 1;
        const grayscaleBuffer = Buffer.alloc(grayscaleWidth * grayscaleHeight * grayscaleChannels, 128); // Medium gray

        const grayscaleImagePath = path.join(__dirname, 'test_output', 'grayscale_image.png');
        await sharp(grayscaleBuffer, {
            raw: {
                width: grayscaleWidth,
                height: grayscaleHeight,
                channels: grayscaleChannels,
            },
        })
            .png()
            .toFile(grayscaleImagePath);
        await processImageTones(path.dirname(grayscaleImagePath), logger);

        const capacity = getCachedImageTones(grayscaleImagePath, logger);
        expect(capacity).toEqual({
            low: 0,
            mid: grayscaleWidth * grayscaleHeight, // All pixels are mid-tone
            high: 0,
        });

        // Cleanup
        if (fs.existsSync(grayscaleImagePath)) {
            fs.unlinkSync(grayscaleImagePath);
        }
    });

    it('should handle images with alpha channels correctly', async () => {
        // Create an RGBA image (4 channels)
        const rgbaWidth = 8;
        const rgbaHeight = 8;
        const rgbaChannels = 4;
        const rgbaBuffer = Buffer.alloc(rgbaWidth * rgbaHeight * rgbaChannels, 255); // White with full alpha

        const rgbaImagePath = path.join(__dirname, 'test_output', 'rgba_image.png');
        await sharp(rgbaBuffer, {
            raw: {
                width: rgbaWidth,
                height: rgbaHeight,
                channels: rgbaChannels,
            },
        })
            .png()
            .toFile(rgbaImagePath);
        await processImageTones(path.dirname(rgbaImagePath), logger);
        const capacity = getCachedImageTones(rgbaImagePath, logger);
        expect(capacity).toEqual({
            low: 0,
            mid: 0,
            high: rgbaWidth * rgbaHeight,
        });

        // Cleanup
        if (fs.existsSync(rgbaImagePath)) {
            fs.unlinkSync(rgbaImagePath);
        }
    });
});
