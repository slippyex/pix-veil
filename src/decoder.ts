// src/decoder.ts

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

import zlib from 'zlib';
import { IDecodeOptions, IDistributionMap, ILogger } from './@types/';
import { decrypt, verifyChecksum } from './utils/cryptoUtils';
import { Logger } from './utils/Logger';
import {config} from './constants';
import { extractDataFromBuffer } from './utils/image/imageUtils';
import { deserializeDistributionMap } from './utils/distributionMap/mapHelpers';

const brotliDecompress = promisify(zlib.brotliDecompress);

export async function decode({ inputFolder, outputFile, password, verbose, logger }: IDecodeOptions) {
    try {
        if (verbose) logger.info('Starting decoding process...');

        // Step 1: read, decrypt and decompress distribution map
        const distributionMapPath = path.join(inputFolder, config.distributionMapFile + '.db');
        const rawDistributionMap = decrypt(fs.readFileSync(distributionMapPath), password);
        const distributionMap = deserializeDistributionMap(await brotliDecompress(rawDistributionMap));

        // Step 2: Extract data chunks based on the distribution map
        if (verbose) logger.info('Extracting data chunks from PNG images...');
        const encryptedData = await extractChunks(distributionMap, inputFolder, logger);

        // Step 3: Decrypt the encrypted data
        if (verbose) logger.info('Decrypting the encrypted data...');
        const decryptedData = decrypt(encryptedData, password);

        // Step 4: Verify checksum
        if (verbose) logger.info('Verifying data integrity...');
        verifyChecksum(decryptedData, distributionMap.checksum);

        // Step 5: Decompress Data
        if (verbose) logger.info('Decompressing data...');
        const decompressedData = await brotliDecompress(decryptedData);

        // Step 6: Write the output file
        if (verbose) logger.info('Writing the output file...');
        fs.writeFileSync(outputFile, decompressedData);
        if (verbose) logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    } catch (error) {
        logger.error(`Decoding failed: ${error}`);
        throw error
    }
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

        // Calculate bit position based on startPosition
        const bitsPerChannel = entry.bitsPerChannel;
        const channelSequence = entry.channelSequence;
        const startBitPosition = entry.startPosition * bitsPerChannel * info.channels;

        // Calculate the number of bits to extract
        const chunkSize = entry.endPosition - entry.startPosition;
        const chunkBits = chunkSize * 8;

        // Extract data
        const chunkBuffer = await extractDataFromBuffer(
            entry.pngFile,
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
