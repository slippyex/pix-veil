// src/encoder/encode.ts
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { readFileAsync, writeFileAsync, getPngFiles, ensureDirectory } from '../utils/fileUtils';
import { compressData } from '../utils/compression';
import { encryptData } from '../utils/encryption';
import { embedChunksLSB } from '../utils/steganography';

interface EncodeOptions {
    inputFile: string;
    inputImagesDir: string;
    outputDir: string;
    password: string;
}

interface DistributionInfo {
    chunks: {
        image: string; // Relative path or identifier
        chunkSize: number; // Size of the chunk in bytes
        tonalArea: 'dark' | 'midtone' | 'light';
    }[];
}

export const encode = async (options: EncodeOptions): Promise<void> => {
    const { inputFile, inputImagesDir, outputDir, password } = options;

    try {
        // Read and process the input file
        const fileData = await readFileAsync(inputFile);
        const compressedData = await compressData(fileData);
        const encryptedBuffer = encryptData(compressedData, password); // Returns a Buffer

        // Read input images
        const pngFiles = await getPngFiles(inputImagesDir);
        if (pngFiles.length === 0) {
            throw new Error('No PNG files found in the input images directory.');
        }

        // Determine chunk size and number of chunks per image
        const CHUNK_SIZE = 1024; // bytes per chunk
        const tonalAreas: ('dark' | 'midtone' | 'light')[] = ['dark', 'midtone', 'light']; // Cycling through tonal areas

        // Split encrypted data into chunks
        const totalChunks = Math.ceil(encryptedBuffer.length / CHUNK_SIZE);
        const chunks: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = start + CHUNK_SIZE;
            chunks.push(encryptedBuffer.slice(start, end));
        }

        // Distribute chunks across images
        const distribution: DistributionInfo = { chunks: [] };
        chunks.forEach((chunk, index) => {
            const imageIndex = index % pngFiles.length;
            const imagePath = pngFiles[imageIndex];
            const tonalArea = tonalAreas[index % tonalAreas.length];
            distribution.chunks.push({
                image: path.basename(imagePath),
                chunkSize: chunk.length,
                tonalArea,
            });
        });

        // Group chunks by image
        const chunksByImage: { [image: string]: { chunk: Buffer; tonalArea: 'dark' | 'midtone' | 'light' }[] } = {};
        distribution.chunks.forEach(({ image, chunkSize, tonalArea }, index) => {
            if (!chunksByImage[image]) {
                chunksByImage[image] = [];
            }
            chunksByImage[image].push({ chunk: chunks[index], tonalArea });
        });

        // Create output directory
        await ensureDirectory(outputDir);

        // Embed chunks into corresponding images
        for (const [imageName, chunksData] of Object.entries(chunksByImage)) {
            const imgPath = path.join(inputImagesDir, imageName);
            const outputImagePath = path.join(outputDir, imageName);

            console.log(`Embedding data into ${imageName} (${chunksData.length} chunks)...`);

            // Read image data
            const image = sharp(imgPath);
            const { data: imgData, info } = await image.raw().toBuffer({ resolveWithObject: true });

            // Prepare data chunks and their tonal areas
            const dataChunks = chunksData.map(cd => cd.chunk);
            const tonalAreaList = chunksData.map(cd => cd.tonalArea);

            // Embed chunks
            const embeddedRawData = await embedChunksLSB(imgPath, dataChunks, tonalAreaList);

            // Re-encode the modified raw data back to PNG
            const modifiedImage = sharp(embeddedRawData, {
                raw: {
                    width: info.width,
                    height: info.height,
                    channels: info.channels,
                },
            });

            await modifiedImage.png().toFile(outputImagePath);

            console.log(`Saved encoded image to ${outputImagePath}`);

            // Validate PNG integrity
            try {
                await sharp(outputImagePath).metadata();
                console.log(`Validated PNG integrity for ${outputImagePath}`);
            } catch (error) {
                throw new Error(`Encoded PNG image ${outputImagePath} is corrupted.`);
            }
        }

        // Save distribution information in a separate image
        const distributionInfo: DistributionInfo = {
            chunks: distribution.chunks,
        };
        const infoJson = JSON.stringify(distributionInfo, null, 2);
        const infoBuffer = Buffer.from(infoJson, 'utf-8');

        // Pad the infoBuffer to 256 bytes if necessary
        const paddedInfoBuffer = Buffer.alloc(256, 0); // 256 bytes, padded with null bytes
        infoBuffer.copy(paddedInfoBuffer, 0, 0, Math.min(infoBuffer.length, 256));

        const infoImageName = 'distribution_info.png';
        const infoImagePath = path.join(outputDir, infoImageName);

        console.log(`Embedding distribution information into ${infoImageName}...`);

        // Embed the distribution info into the first image's 'dark' tonal area
        const firstImagePath = pngFiles[0];
        const embeddedInfoRawData = await embedChunksLSB(
            firstImagePath,
            [paddedInfoBuffer],
            ['dark']
        );

        // Read the original first image's info
        const firstImage = sharp(firstImagePath);
        const { data: firstImgData, info: firstInfo } = await firstImage.raw().toBuffer({ resolveWithObject: true });

        // Re-encode the modified distribution info raw data back to PNG
        const modifiedInfoImage = sharp(embeddedInfoRawData, {
            raw: {
                width: firstInfo.width,
                height: firstInfo.height,
                channels: firstInfo.channels,
            },
        });

        await modifiedInfoImage.png().toFile(infoImagePath);

        console.log(`Saved distribution information to ${infoImagePath}`);

        // Validate PNG integrity of distribution_info.png
        try {
            await sharp(infoImagePath).metadata();
            console.log(`Validated PNG integrity for ${infoImagePath}`);
        } catch (error) {
            throw new Error(`Encoded PNG image ${infoImagePath} is corrupted.`);
        }

    } catch (error) {
        console.error('Error during encoding:', error);
        throw error; // Rethrow to propagate the error to the test
    }
};
