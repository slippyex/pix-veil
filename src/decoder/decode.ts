// src/decoder/decode.ts
import path from 'path';
import fs from 'fs';
import { readFileAsync, writeFileAsync, getPngFiles, ensureDirectory } from '../utils/fileUtils';
import { decompressData } from '../utils/compression';
import { decryptData } from '../utils/encryption';
import { extractChunksLSB } from '../utils/steganography';

interface DecodeOptions {
    inputImagesDir: string;
    outputFile: string;
    password: string;
}

interface DistributionInfo {
    chunks: {
        image: string; // Relative path or identifier
        chunkSize: number; // Size of the chunk in bytes
        tonalArea: 'dark' | 'midtone' | 'light';
    }[];
}

export const decode = async (options: DecodeOptions): Promise<void> => {
    const { inputImagesDir, outputFile, password } = options;

    try {
        // Read all PNG files
        const pngFiles = await getPngFiles(inputImagesDir);
        if (pngFiles.length === 0) {
            throw new Error('No PNG files found in the input images directory.');
        }

        // Extract distribution information from 'distribution_info.png'
        const distributionInfoImageName = 'distribution_info.png';
        const distributionInfoPath = path.join(inputImagesDir, distributionInfoImageName);
        if (!fs.existsSync(distributionInfoPath)) {
            throw new Error('Distribution information image (distribution_info.png) not found.');
        }

        // Estimated size for distribution info
        const estimatedInfoSize = 256; // bytes, matches the padding in encode.ts

        // Extract the distribution info chunk
        const extractedInfoChunks = await extractChunksLSB(
            distributionInfoPath,
            1,
            [estimatedInfoSize], // Fixed size for safety
            ['dark']
        );

        if (extractedInfoChunks.length === 0) {
            throw new Error('Failed to extract distribution information.');
        }

        const distributionInfoBuffer = extractedInfoChunks[0];
        const distributionInfoJson = distributionInfoBuffer.toString('utf-8').trim();

        // Log the extracted distribution info
        console.log('Extracted Distribution Info:', distributionInfoJson);

        // Handle possible padding or extra null characters
        const trimmedJson = distributionInfoJson.replace(/\0/g, '');

        let distributionInfo: DistributionInfo;
        try {
            distributionInfo = JSON.parse(trimmedJson);
        } catch (error) {
            throw new Error('Failed to parse distribution information JSON.');
        }

        // Reconstruct the encrypted data from chunks
        const encryptedBuffers: Buffer[] = [];

        for (const chunkInfo of distributionInfo.chunks) {
            const imagePath = path.join(inputImagesDir, chunkInfo.image);
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image ${chunkInfo.image} not found in the input images directory.`);
            }

            // Extract the specific chunk from the designated tonal area
            const extractedChunks = await extractChunksLSB(
                imagePath,
                1,
                [chunkInfo.chunkSize],
                [chunkInfo.tonalArea]
            );

            if (extractedChunks.length === 0) {
                throw new Error(`Failed to extract chunk from image ${chunkInfo.image}.`);
            }

            const chunkBuffer = extractedChunks[0];
            encryptedBuffers.push(chunkBuffer);
        }

        // Concatenate all encrypted chunks
        const encryptedData = Buffer.concat(encryptedBuffers);

        // Decrypt and decompress
        const decryptedData = decryptData(encryptedData, password);
        const decompressedData = await decompressData(decryptedData);

        // Write the output file
        await ensureDirectory(path.dirname(outputFile));
        await writeFileAsync(outputFile, decompressedData);

        console.log(`Decoded file saved to ${outputFile}`);

    } catch (error) {
        console.error('Error during decoding:', error);
        throw error; // Rethrow to propagate the error to the test
    }
};
