// src/encoder.ts

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

import sharp from 'sharp';
import { getCachedImageTones, injectDataIntoBuffer } from './utils/imageUtils';
import { Chunk, DistributionMapEntry, EncodeOptions } from './@types/types';
import { createDistributionMap } from './utils/mapUtils';
import { encrypt, generateChecksum } from './utils/cryptoUtils';

const brotliCompress = promisify(zlib.brotliCompress);

const COMPRESSION_LEVEL = 9;
const ADAPTIVE_FILTER = true;

// Define maximum and minimum number of chunks per PNG
const MAX_CHUNKS_PER_PNG = 16;
const MIN_CHUNKS_PER_PNG = 1;

// Define maximum and minimum chunk sizes
const MIN_CHUNK_SIZE = 16;
const MAX_CHUNK_SIZE = 4096;

// Define the name for the human-readable distribution map
const DISTRIBUTION_MAP_TEXT = 'distribution_map.txt';
const BITS_PER_CHANNEL_FOR_MAP = 2;

export async function encode({
    inputFile,
    inputPngFolder,
    outputFolder,
    password,
    verbose,
    debugVisual,
    logger
}: EncodeOptions) {
    try {
        if (verbose) logger.info('Starting encoding process...');

        // Step 1: Read and compress the input file
        if (verbose) logger.info('Reading and compressing the input file...');
        const fileData = fs.readFileSync(inputFile);
        const compressedData = await brotliCompress(fileData);

        // Step 2: Encrypt the compressed data
        if (verbose) logger.info('Encrypting the compressed data...');
        const encryptedData = encrypt(compressedData, password);

        // Generate checksum for data integrity
        const checksum = generateChecksum(encryptedData);
        if (verbose) logger.info('Checksum generated for data integrity.');

        // Step 3: Split into chunks
        if (verbose) logger.info('Splitting encrypted data into chunks...');
        const chunks: Chunk[] = [];
        let offset = 0;
        let chunkId = 0;

        while (offset < encryptedData.length) {
            const remaining = encryptedData.length - offset;
            const size = Math.min(
                MIN_CHUNK_SIZE * Math.ceil(Math.random() * (MAX_CHUNK_SIZE / MIN_CHUNK_SIZE)),
                remaining
            );
            const chunkData = encryptedData.subarray(offset, offset + size);
            chunks.push({ id: chunkId++, data: Buffer.from(chunkData) });
            offset += size;
        }

        if (verbose) logger.info(`Total chunks created: ${chunks.length}`);

        // Step 4: Analyze PNGs for capacity
        if (verbose) logger.info('Analyzing PNG images for capacity...');
        const pngFiles = fs.readdirSync(inputPngFolder).filter(file => file.endsWith('.png'));
        if (pngFiles.length === 0) throw new Error('No PNG files found in the input folder.');

        if (pngFiles.length < 2)
            throw new Error(
                'At least two PNG files are required (one for distribution map and at least one for data).'
            );

        // Assign the first PNG as the distribution map container
        const distributionMapPng = pngFiles[0];
        const dataPngFiles = pngFiles.slice(1); // Remaining PNGs for data

        // Step 5: Calculate capacity for each data PNG
        const pngCapacities = await Promise.all(
            dataPngFiles.map(async png => {
                const pngPath = path.join(inputPngFolder, png);
                const capacity = await getCachedImageTones(pngPath, logger); // Use cached tones
                // Using 2 bits per channel on all RGB channels
                const bitsPerChannel = 2;
                const totalEmbeddableBytes = Math.floor(
                    ((capacity.low + capacity.mid + capacity.high) * 3 * bitsPerChannel) / 8
                );
                if (verbose) logger.debug(`PNG "${png}" can embed up to ${totalEmbeddableBytes} bytes.`);
                return {
                    file: png,
                    capacity: totalEmbeddableBytes
                };
            })
        );

        // Step 6: Distribute chunks ensuring each PNG has at least one and up to 16 chunks
        if (verbose) logger.info('Distributing chunks across PNG images...');

        const distributionMapEntries: DistributionMapEntry[] = [];
        const usedPngs: { [key: string]: { usedCapacity: number; chunkCount: number; chunks: Chunk[] } } = {};

        // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
        for (const png of pngCapacities) {
            usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
        }

        // Shuffle the chunks to randomize distribution
        const shuffledChunks = shuffleArray(chunks);

        // Shuffle the PNGs to ensure random assignment
        const shuffledPngCapacities = shuffleArray(pngCapacities);

        // Assign chunks in a round-robin fashion to ensure balanced distribution
        let pngIndex = 0;
        while (shuffledChunks.length > 0) {
            const png = shuffledPngCapacities[pngIndex % shuffledPngCapacities.length];
            pngIndex++;

            // Check if PNG can receive more chunks
            if (usedPngs[png.file].chunkCount >= MAX_CHUNKS_PER_PNG) {
                continue; // Skip this PNG as it reached the maximum chunk limit
            }

            // Check if PNG has enough capacity for the next chunk
            const nextChunk = shuffledChunks[0];
            if (usedPngs[png.file].usedCapacity + nextChunk.data.length > png.capacity) {
                // Not enough capacity, skip to the next PNG
                continue;
            }

            // Assign the chunk to this PNG
            const chunk = shuffledChunks.shift()!;
            usedPngs[png.file].usedCapacity += chunk.data.length;
            usedPngs[png.file].chunkCount += 1;
            usedPngs[png.file].chunks.push(chunk);

            // Randomize the position within the image for this chunk
            const randomPosition = getRandomPosition(png.capacity, chunk.data.length);

            // Create distribution map entry
            distributionMapEntries.push({
                chunkId: chunk.id,
                pngFile: png.file,
                startPosition: randomPosition.start,
                endPosition: randomPosition.end,
                bitsPerChannel: 2, // Using 2 bits per channel as set earlier
                channelSequence: ['R', 'G', 'B']
            });

            if (verbose) {
                logger.info(
                    `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with 2 bits per channel. Position: ${randomPosition.start}-${randomPosition.end}`
                );
            }
        }

        // Ensure each PNG has at least one chunk
        for (const png of shuffledPngCapacities) {
            if (usedPngs[png.file].chunkCount < MIN_CHUNKS_PER_PNG) {
                if (shuffledChunks.length === 0) break; // No chunks left to assign

                const chunk = shuffledChunks.shift();
                if (!chunk) break; // No chunks left

                if (usedPngs[png.file].usedCapacity + chunk.data.length > png.capacity) {
                    logger.warn(`Unable to assign chunk ${chunk?.id} to "${png.file}" due to insufficient capacity.`);
                    continue;
                }

                usedPngs[png.file].usedCapacity += chunk.data.length;
                usedPngs[png.file].chunkCount += 1;
                usedPngs[png.file].chunks.push(chunk);

                // Randomize the position within the image for this chunk
                const randomPosition = getRandomPosition(png.capacity, chunk.data.length);

                // Create distribution map entry
                distributionMapEntries.push({
                    chunkId: chunk.id,
                    pngFile: png.file,
                    startPosition: randomPosition.start,
                    endPosition: randomPosition.end,
                    bitsPerChannel: 2,
                    channelSequence: ['R', 'G', 'B']
                });

                if (verbose) {
                    logger.info(
                        `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with 2 bits per channel. Position: ${randomPosition.start}-${randomPosition.end}`
                    );
                }
            }
        }

        // After distribution, check if all chunks have been assigned
        if (shuffledChunks.length > 0) {
            throw new Error('Not enough capacity to embed all chunks within the PNG images.');
        }

        if (verbose) logger.info('Chunks distributed successfully.');

        // Step 7: Inject chunks into data PNGs
        if (verbose) logger.info('Injecting chunks into PNG images...');

        // Ensure output folder exists
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
            if (verbose) logger.debug(`Created output folder "${outputFolder}".`);
        }

        // Group distribution map entries by PNG file
        const pngToChunksMap: { [key: string]: DistributionMapEntry[] } = {};
        distributionMapEntries.forEach(entry => {
            if (!pngToChunksMap[entry.pngFile]) {
                pngToChunksMap[entry.pngFile] = [];
            }
            pngToChunksMap[entry.pngFile].push(entry);
        });

        // Inject all chunks per PNG in a single operation
        const injectPromises = Object.entries(pngToChunksMap).map(async ([pngFile, entries]) => {
            const inputPngPath = path.join(inputPngFolder, pngFile);
            const outputPngPath = path.join(outputFolder, pngFile);

            // Load the PNG image once
            const image = sharp(inputPngPath).removeAlpha().toColourspace('srgb');
            const { data: imageData, info } = await image.raw().toBuffer({ resolveWithObject: true });
            const { channels, width, height } = info;

            // Iterate over each chunk assigned to this PNG
            for (const entry of entries) {
                const chunk = chunks.find(c => c.id === entry.chunkId);
                if (!chunk) {
                    throw new Error(`Chunk with ID ${entry.chunkId} not found.`);
                }

                // Inject data into the image buffer
                await injectDataIntoBuffer(
                    imageData,
                    chunk.data,
                    entry.bitsPerChannel,
                    entry.channelSequence,
                    entry.startPosition,
                    debugVisual,
                    logger,
                    width,
                    height,
                    channels
                );
            }

            // Save the modified image to the output folder
            const modifiedImage = sharp(imageData, {
                raw: {
                    width: width,
                    height: height,
                    channels: channels
                }
            })
                .toColourspace('srgb')
                .png({
                    compressionLevel: COMPRESSION_LEVEL,
                    adaptiveFiltering: ADAPTIVE_FILTER,
                    palette: false
                });

            const outputBuffer = await modifiedImage.toBuffer();
            fs.writeFileSync(outputPngPath, outputBuffer);
            if (verbose) logger.info(`Injected all assigned chunks into "${pngFile}" and saved to output folder.`);
        });

        await Promise.all(injectPromises);
        if (verbose) logger.info('All chunks injected successfully.');

        // Step 8: Create and inject distribution map
        if (verbose) logger.info('Creating and injecting the distribution map...');
        const serializedMap = createDistributionMap(distributionMapEntries, checksum);
        const mapSize = serializedMap.length;

        // Choose a random position in the distributionMapPng
        const distributionMapOutputPath = path.join(outputFolder, `${distributionMapPng}`);
        const mapImage = sharp(distributionMapOutputPath).removeAlpha().toColourspace('srgb');
        const { data: mapImageData, info: mapInfo } = await mapImage.raw().toBuffer({ resolveWithObject: true });
        const { channels: mapChannels, width: mapWidth, height: mapHeight } = mapInfo;

        // TODO: Calculate embeddable bits and then bytes
        const totalEmbeddableBits = 16384 * 3 * BITS_PER_CHANNEL_FOR_MAP;
        const mapCapacityBytes = Math.floor(totalEmbeddableBits / 8);

        console.log(`Total Embeddable Bytes for Distribution Map: ${mapCapacityBytes} bytes`);

        if (serializedMap.length > mapCapacityBytes) {
            throw new Error('Distribution map size exceeds the embedding capacity of the designated PNG.');
        }

        // Choose a random start position
        const startPosition = Math.floor(Math.random() * (mapCapacityBytes - mapSize));
        const endPosition = startPosition + mapSize;

        logger.debug(
            `Embedding distribution map at position ${startPosition} to ${endPosition} in "${distributionMapPng}".`
        );

        // Inject the distribution map into the image data
        await injectDataIntoBuffer(
            mapImageData,
            serializedMap,
            2, // bitsPerChannelForMap
            ['R', 'G', 'B'],
            startPosition,
            debugVisual,
            logger,
            mapWidth,
            mapHeight,
            mapChannels
        );

        // Save the modified distribution map PNG
        const modifiedMapImage = sharp(mapImageData, {
            raw: {
                width: mapWidth,
                height: mapHeight,
                channels: mapChannels
            }
        })
            .toColourspace('srgb')
            .png({
                compressionLevel: COMPRESSION_LEVEL,
                adaptiveFiltering: ADAPTIVE_FILTER,
                palette: false
            });

        const outputMapBuffer = await modifiedMapImage.toBuffer();
        fs.writeFileSync(distributionMapOutputPath, outputMapBuffer);

        if (verbose) logger.info(`Injected distribution map into "${distributionMapPng}" and saved to output folder.`);

        // Step 9: Dump the distribution map as a human-readable text file
        if (verbose) logger.info('Creating a human-readable distribution map text file...');
        const distributionMapTextPath = path.join(outputFolder, DISTRIBUTION_MAP_TEXT);
        const distributionMapText = generateDistributionMapText(distributionMapEntries, checksum);
        fs.writeFileSync(distributionMapTextPath, distributionMapText);
        if (verbose) logger.info(`Distribution map text file created at "${distributionMapTextPath}".`);

        logger.info('Encoding completed successfully.');
    } catch (error) {}
}

/**
 * Shuffles an array using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = array.slice(); // Create a copy
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Generates a random start and end position within the image capacity for a chunk.
 * Ensures that the chunk does not exceed the image capacity.
 */
function getRandomPosition(imageCapacity: number, chunkSize: number): { start: number; end: number } {
    const maxStart = imageCapacity - chunkSize;
    if (maxStart <= 0) {
        return { start: 0, end: chunkSize };
    }
    const start = Math.floor(Math.random() * maxStart);
    const end = start + chunkSize;
    return { start, end };
}

/**
 * Generates a human-readable distribution map text.
 */
function generateDistributionMapText(entries: DistributionMapEntry[], checksum: string): string {
    let text = `Distribution Map - ${new Date().toISOString()}\n\n`;

    const pngMap: { [key: string]: DistributionMapEntry[] } = {};

    entries.forEach(entry => {
        if (!pngMap[entry.pngFile]) {
            pngMap[entry.pngFile] = [];
        }
        pngMap[entry.pngFile].push(entry);
    });

    for (const png in pngMap) {
        text += `PNG File: ${png}\n`;
        text += `Chunks Embedded: ${pngMap[png].length}\n`;
        text += `Details:\n`;
        pngMap[png].forEach(entry => {
            const length = entry.endPosition - entry.startPosition;
            text += `  - Chunk ID: ${entry.chunkId}, Position: ${entry.startPosition}-${entry.endPosition}, Length: ${length} bytes, Bits/Channel: ${entry.bitsPerChannel}, Channels: ${entry.channelSequence.join(', ')}\n`;
        });
        text += `\n`;
    }

    text += `Checksum: ${checksum}\n`;

    return text;
}
