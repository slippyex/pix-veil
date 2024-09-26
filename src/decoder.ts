// src/decoder.ts

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

import zlib from 'zlib';
import { IDecodeOptions, IDistributionMap, ILogger } from './@types/';
import { decrypt, verifyChecksum } from './utils/cryptoUtils';
import { Logger } from './utils/Logger';
import { MAGIC_BYTE } from './constants';
import { extractDataFromBuffer } from './utils/image/imageUtils';
import { deserializeDistributionMap } from './utils/distributionMap/mapHelpers';

const brotliDecompress = promisify(zlib.brotliDecompress);
const bitsPerChannelForMap = 2;

export async function decode({ inputFolder, outputFile, password, verbose, debugVisual, logger }: IDecodeOptions) {
    try {
        if (verbose) logger.info('Starting decoding process...');

        // Step 1: Locate the distribution map PNG
        if (verbose) logger.info('Locating distribution map PNG...');
        const distributionMapPng = findDistributionMapPng(inputFolder);
        const distributionMapPngPath = path.join(inputFolder, distributionMapPng);

        // Step 2: Read the distribution map from the PNG
        if (verbose) logger.info('Extracting distribution map from PNG...');
        const distributionMap = await extractDistributionMap(distributionMapPngPath, logger);

        // Step 3: Extract data chunks based on the distribution map
        if (verbose) logger.info('Extracting data chunks from PNG images...');
        const encryptedData = await extractChunks(distributionMap, inputFolder, logger);

        // Step 4: Decrypt the encrypted data
        if (verbose) logger.info('Decrypting the encrypted data...');
        const decryptedData = decrypt(encryptedData, password);

        // Step 5: Verify checksum
        if (verbose) logger.info('Verifying data integrity...');
        verifyChecksum(decryptedData, distributionMap.checksum);

        // Step 5: Decompress Data
        if (verbose) logger.info('Decompressing data...');
        const decompressedData = await brotliDecompress(decryptedData);

        // Step 7: Write the output file
        if (verbose) logger.info('Writing the output file...');
        fs.writeFileSync(outputFile, decompressedData);
        if (verbose) logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    } catch (error: any) {
        logger.error(`Decoding failed: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Finds the PNG file designated to carry the distribution map.
 * Assuming it's the first `.bak.png` file.
 */
function findDistributionMapPng(inputFolder: string): string {
    const pngFiles = fs.readdirSync(inputFolder).filter(file => file.endsWith('.bak.png'));
    if (pngFiles.length === 0) throw new Error('No distribution map PNG found in the input folder.');
    return pngFiles[0]; // Assuming the first `.bak.png` is the distribution map carrier
}

/**
 * Extracts the distribution map from the specified PNG.
 * @param pngPath - Path to the distribution map PNG.
 * @param logger - Logger instance for debugging.
 * @returns Parsed DistributionMap object.
 */
async function extractDistributionMap(pngPath: string, logger: Logger): Promise<IDistributionMap> {
    const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
    const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Convert image data to buffer of bits
    // Since we are using 2 bits per channel, and data is byte-aligned, we can process accordingly

    // Start searching for the Magic Byte sequence
    const magicBuffer = MAGIC_BYTE; // Must match MAGIC_BYTE
    const magicLength = magicBuffer.length;

    // Convert the image data to bits
    const totalBytes = imageData.length;
    const bitsPerChannel = bitsPerChannelForMap; // 2 bits per channel

    // Search for the Magic Byte in the bitstream
    let magicFound = false;
    let magicStartBit = 0;

    for (let bit = 0; bit <= totalBytes * 8 - magicLength * 8; bit += bitsPerChannel) {
        // Extract bits corresponding to the Magic Byte
        let extractedMagic = Buffer.alloc(magicLength);
        for (let i = 0; i < magicLength; i++) {
            let byteIndex = bit + i * 8;
            if (byteIndex + 8 > totalBytes * 8) break;

            let byte = 0;
            for (let b = 0; b < 8; b++) {
                const currentBit = (imageData[Math.floor(byteIndex / 8)] >> (7 - (byteIndex % 8))) & 1;
                byte = (byte << 1) | currentBit;
                byteIndex++;
            }
            extractedMagic[i] = byte;
        }

        if (extractedMagic.equals(magicBuffer)) {
            magicFound = true;
            magicStartBit = bit;
            break;
        }
    }

    if (!magicFound) {
        throw new Error('Magic bytes not found in the distribution map PNG.');
    }

    logger.debug(`Magic bytes found at bit position ${magicStartBit}.`);

    // Read the Size Field (next 4 bytes after Magic Byte)
    const sizeBitsStart = magicStartBit + magicLength * 8;
    const sizeBits = 32; // 4 bytes * 8 bits
    const sizeBytes = await extractDataFromBuffer(
        imageData,
        bitsPerChannel,
        ['R', 'G', 'B'],
        sizeBitsStart,
        sizeBits,
        logger,
        info.channels
    );
    const size = sizeBytes.readUInt32BE(0);

    logger.debug(`Distribution map size: ${size} bytes.`);

    // Read the Content based on Size
    const contentBitsStart = sizeBitsStart + sizeBits;
    const contentBits = size * 8;
    const contentBytes = await extractDataFromBuffer(
        imageData,
        bitsPerChannel,
        ['R', 'G', 'B'],
        contentBitsStart,
        contentBits,
        logger,
        info.channels
    );

    // Deserialize the distribution map
    return deserializeDistributionMap(Buffer.concat([magicBuffer, sizeBytes, contentBytes]));
}

/**
 * Extracts data chunks based on the distribution map.
 * @param distributionMap - Parsed distribution map containing chunk locations.
 * @param inputFolder - Path to the folder containing PNG files.
 * @param logger - Logger instance for debugging.
 * @returns Buffer containing the reassembled encrypted data.
 */
async function extractChunks(distributionMap: IDistributionMap, inputFolder: string, logger: Logger): Promise<Buffer> {
    let encryptedDataArray: Buffer[] = [];

    for (const entry of distributionMap.entries) {
        const pngPath = path.join(inputFolder, entry.pngFile);
        logger.debug(`Extracting chunk ${entry.chunkId} from "${entry.pngFile}".`);

        // Load the PNG image
        const image = sharp(pngPath).removeAlpha().toColourspace('srgb');
        const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });
        const { channels, width, height } = info;

        // Calculate bit position based on startPosition
        const bitsPerChannel = entry.bitsPerChannel;
        const channelSequence = entry.channelSequence;
        const startBitPosition = entry.startPosition * bitsPerChannel * channels; // Adjusted

        // Calculate the number of bits to extract
        const chunkSize = entry.endPosition - entry.startPosition;
        const chunkBits = chunkSize * 8;

        // Extract data
        const chunkBuffer = await extractDataFromBuffer(
            imageData,
            bitsPerChannel,
            channelSequence,
            startBitPosition,
            chunkBits,
            logger,
            info.channels
        );

        encryptedDataArray.push(chunkBuffer);
    }

    // Concatenate all chunks to form the encrypted data
    return Buffer.concat(encryptedDataArray);
}
