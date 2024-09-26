// src/encoder.ts

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import _ from 'lodash';

import sharp from 'sharp';
import { getCachedImageTones, injectDataIntoBuffer } from './utils/image/imageUtils';
import { IChunk, IDistributionMapEntry, IEncodeOptions, IUsedPng } from './@types/';
import { createDistributionMap, generateDistributionMapText } from './utils/distributionMap/mapUtils';
import { encrypt, generateChecksum } from './utils/cryptoUtils';
import { config } from './constants';
import { getRandomPosition } from './utils/image/imageHelper';

const brotliCompress = promisify(zlib.brotliCompress);

export async function encode({
    inputFile,
    inputPngFolder,
    outputFolder,
    password,
    verbose,
    debugVisual,
    logger
}: IEncodeOptions) {
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
        if (verbose) logger.info('Checksum generated for data integrity: ' + checksum);

        fs.writeFileSync(path.join(outputFolder, 'packed.dat'), encryptedData);

        // Step 3: Split into chunks
        if (verbose) logger.info('Splitting encrypted data into chunks...');
        const chunks: IChunk[] = [];
        let offset = 0;
        let chunkId = 0;

        while (offset < encryptedData.length) {
            const remaining = encryptedData.length - offset;
            const size = Math.min(
                config.chunksDefinition.minChunkSize *
                    Math.ceil(
                        Math.random() * (config.chunksDefinition.maxChunkSize / config.chunksDefinition.minChunkSize)
                    ),
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
                const bitsPerChannel = config.bitsPerChannelForDistributionMap;
                const channelsPerPixel = 3; // R, G, B
                const totalEmbeddableChannels = (capacity.low + capacity.mid + capacity.high) * channelsPerPixel;
                const channelsNeededPerByte = Math.ceil(8 / bitsPerChannel); // Number of channels needed to embed one byte
                const totalEmbeddableBytes = Math.floor(totalEmbeddableChannels / channelsNeededPerByte);
                if (verbose) logger.debug(`PNG "${png}" can embed up to ${totalEmbeddableBytes} bytes.`);
                return {
                    file: png,
                    capacity: totalEmbeddableBytes
                };
            })
        );

        // Step 6: Distribute chunks ensuring each PNG has at least one and up to 16 chunks
        if (verbose) logger.info('Distributing chunks across PNG images...');

        const distributionMapEntries: IDistributionMapEntry[] = [];
        const usedPngs: Record<string, IUsedPng> = {};

        // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
        for (const png of pngCapacities) {
            usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
        }

        // Initialize usedPositions to track channel usage per PNG
        const usedPositions: Record<string, boolean[]> = {};
        for (const png of pngCapacities) {
            const capacity = await getCachedImageTones(path.join(inputPngFolder, png.file), logger);
            const totalChannels = (capacity.low + capacity.mid + capacity.high) * 3; // R, G, B
            usedPositions[png.file] = new Array(totalChannels).fill(false);
        }

        // Shuffle the chunks to randomize distribution
        const shuffledChunks = _.shuffle(chunks);

        // Shuffle the PNGs to ensure random assignment
        const shuffledPngCapacities = _.shuffle(pngCapacities);

        // Assign chunks in a round-robin fashion to ensure balanced distribution
        let pngIndex = 0;
        while (shuffledChunks.length > 0) {
            const png = shuffledPngCapacities[pngIndex % shuffledPngCapacities.length];
            pngIndex++;

            // Check if PNG can receive more chunks
            if (usedPngs[png.file].chunkCount >= config.chunksDefinition.maxChunksPerPng) {
                continue; // Skip this PNG as it reached the maximum chunk limit
            }

            // Check if PNG has enough capacity for the next chunk
            const nextChunk = shuffledChunks[0];
            if (usedPngs[png.file].usedCapacity + nextChunk.data.length > png.capacity) {
                // Not enough capacity, skip to the next PNG
                continue;
            }

            // Calculate channels needed for this chunk
            const bitsPerChannel = config.bitsPerChannelForDistributionMap;
            const channelsNeeded = Math.ceil((nextChunk.data.length * 8) / bitsPerChannel);

            // Get total embeddable channels from capacity
            const capacity = await getCachedImageTones(path.join(inputPngFolder, png.file), logger);
            const totalChannels = (capacity.low + capacity.mid + capacity.high) * 3; // 3 channels: R, G, B

            // Find a non-overlapping position
            let randomPosition;
            try {
                randomPosition = getRandomPosition(
                    totalChannels,
                    nextChunk.data.length,
                    bitsPerChannel,
                    usedPositions[png.file]
                );
            } catch (error) {
                logger.warn(
                    `Unable to find non-overlapping position for chunk ${nextChunk.id} in "${png.file}". Skipping this PNG.`
                );
                continue; // Skip this PNG for this chunk
            }

            const { start, end } = randomPosition;

            // Assign the chunk to this PNG
            const chunk = shuffledChunks.shift()!;
            usedPngs[png.file].usedCapacity += chunk.data.length;
            usedPngs[png.file].chunkCount += 1;
            usedPngs[png.file].chunks.push(chunk);

            // Create distribution map entry
            distributionMapEntries.push({
                chunkId: chunk.id,
                pngFile: png.file,
                startPosition: start, // Now in channels
                endPosition: end, // Now in channels
                bitsPerChannel: bitsPerChannel,
                channelSequence: ['R', 'G', 'B']
            });

            if (verbose) {
                logger.info(
                    `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with ${bitsPerChannel} bits per channel. Position: ${start}-${end}`
                );
            }
        }

        // Ensure each PNG has at least one chunk
        for (const png of shuffledPngCapacities) {
            if (usedPngs[png.file].chunkCount < config.chunksDefinition.minChunksPerPng) {
                if (shuffledChunks.length === 0) break; // No chunks left to assign

                const chunk = shuffledChunks.shift();
                if (!chunk) break; // No chunks left

                if (usedPngs[png.file].usedCapacity + chunk.data.length > png.capacity) {
                    logger.warn(`Unable to assign chunk ${chunk?.id} to "${png.file}" due to insufficient capacity.`);
                    continue;
                }

                // Calculate channels needed for this chunk
                const bitsPerChannel = config.bitsPerChannelForDistributionMap;
                const channelsNeeded = Math.ceil((chunk.data.length * 8) / bitsPerChannel);

                // Find a non-overlapping position
                let randomPosition;
                try {
                    randomPosition = getRandomPosition(
                        (usedPngs[png.file].usedCapacity + chunk.data.length) * 3,
                        chunk.data.length,
                        bitsPerChannel,
                        usedPositions[png.file]
                    );
                } catch (error) {
                    logger.warn(
                        `Unable to find non-overlapping position for chunk ${chunk.id} in "${png.file}". Skipping assignment.`
                    );
                    continue; // Skip this PNG for this chunk
                }

                const { start, end } = randomPosition;

                usedPngs[png.file].usedCapacity += chunk.data.length;
                usedPngs[png.file].chunkCount += 1;
                usedPngs[png.file].chunks.push(chunk);

                // Create distribution map entry
                distributionMapEntries.push({
                    chunkId: chunk.id,
                    pngFile: png.file,
                    startPosition: start, // Now in channels
                    endPosition: end, // Now in channels
                    bitsPerChannel: 2, // As per the original code
                    channelSequence: ['R', 'G', 'B']
                });

                if (verbose) {
                    logger.info(
                        `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with 2 bits per channel. Position: ${start}-${end}`
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
        const pngToChunksMap: Record<string, IDistributionMapEntry[]> = {};
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
            const { channels: imageChannels, width, height } = info;

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
                    imageChannels
                );
            }

            // Save the modified image to the output folder
            const modifiedImage = sharp(imageData, {
                raw: {
                    width: width,
                    height: height,
                    channels: imageChannels
                }
            })
                .toColourspace('srgb')
                .png({
                    compressionLevel: config.imageCompression.compressionLevel,
                    adaptiveFiltering: config.imageCompression.adaptiveFiltering,
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
        const distributionMapCompressed = await brotliCompress(serializedMap);
        const encryptedMap = encrypt(distributionMapCompressed, password);
        const distributionMapOutputPath = path.join(outputFolder, config.distributionMapFile + '.db');
        fs.writeFileSync(distributionMapOutputPath, encryptedMap);

        // Step 9: Dump the distribution map as a human-readable text file
        if (verbose) logger.info('Creating a human-readable distribution map text file...');
        const distributionMapTextPath = path.join(outputFolder, config.distributionMapFile + '.txt');
        const distributionMapText = generateDistributionMapText(distributionMapEntries, checksum);
        fs.writeFileSync(distributionMapTextPath, distributionMapText);
        if (verbose) logger.info(`Distribution map text file created at "${distributionMapTextPath}".`);

        logger.info('Encoding completed successfully.');
    } catch (error) {
        logger.error(`Encoding failed: ${error}`);
        throw error;
    }
}
