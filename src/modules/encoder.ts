// src/modules/encoder.ts

import path from 'node:path';
import _ from 'lodash';

import sharp from 'sharp';
import { getCachedImageTones, injectDataIntoBuffer } from '../utils/image/imageUtils.ts';
import { ChannelSequence, IChunk, IDistributionMapEntry, IEncodeOptions, ILogger, IUsedPng } from '../@types/index.ts';
import { createDistributionMap, generateDistributionMapText } from '../utils/distributionMap/mapUtils.ts';
import { encrypt, generateChecksum } from '../utils/misc/cryptoUtils.ts';
import { config } from '../config.ts';
import { getRandomPosition } from '../utils/image/imageHelper.ts';
import {
    ensureOutputDirectory,
    readBufferFromFile,
    readDirectory,
    writeBufferToFile
} from '../utils/misc/storageUtils.ts';
import { compressBuffer } from '../utils/misc/compressUtils.ts';
import { Buffer } from 'node:buffer';

/**
 * Encodes a file into PNG images using steganography.
 * @param options - Encoding options.
 */
export async function encode(options: IEncodeOptions) {
    const { inputFile, inputPngFolder, outputFolder, password, verbose, debugVisual, logger } = options;
    try {
        if (verbose) logger.info('Starting encoding process...');
        // Capture only the filename (no path) using path.basename
        const originalFilename = path.basename(inputFile); // This ensures only the file name without the path

        // Step 1: Read and compress the input file
        const compressedData = readAndCompressInputFile(inputFile, logger);

        // Step 2: Encrypt the compressed data and store encrypted data
        const { encryptedData, checksum } = encryptAndStoreData(compressedData, password, outputFolder, logger);

        // Step 3: Split encrypted data into chunks
        const chunks = splitDataIntoChunks(encryptedData, logger);

        // Step 4: Analyze PNG images for capacity
        const pngCapacities = await analyzePngCapacities(inputPngFolder, logger);

        // Step 5: Distribute chunks across PNG images and obtain chunk map
        const { distributionMapEntries, chunkMap } = await distributeChunksAcrossPngs(
            chunks,
            pngCapacities,
            inputPngFolder,
            logger
        );

        // Step 6: Inject chunks into PNG images
        await injectChunksIntoPngs(distributionMapEntries, chunkMap, inputPngFolder, outputFolder, debugVisual, logger);

        // Step 7: Create and store the distribution map
        await createAndStoreDistributionMap(
            distributionMapEntries,
            originalFilename,
            checksum,
            password,
            outputFolder,
            logger
        );

        // Step 8: Generate human-readable distribution map text file
        await createHumanReadableDistributionMap(
            distributionMapEntries,
            originalFilename,
            checksum,
            outputFolder,
            logger
        );

        logger.info('Encoding completed successfully.');
    } catch (error) {
        logger.error(`Encoding failed: ${error}`);
        throw error;
    }
}

/**
 * Reads and compresses the input file.
 * @param inputFile - Path to the input file.
 * @param logger - Logger instance for debugging.
 * @returns Compressed data as Buffer.
 */
function readAndCompressInputFile(inputFile: string, logger: ILogger): Buffer {
    if (logger.verbose) logger.info('Reading and compressing the input file...');
    const fileData = readBufferFromFile(inputFile);
    return compressBuffer(fileData);
}

/**
 * Encrypts the compressed data, generates checksum, and stores encrypted data.
 * @param compressedData - Compressed data buffer.
 * @param password - Password for encryption.
 * @param outputFolder - Path to the output folder.
 * @param logger - Logger instance for debugging.
 * @returns Object containing encrypted data and its checksum.
 */
function encryptAndStoreData(
    compressedData: Buffer,
    password: string,
    outputFolder: string,
    logger: ILogger
): { encryptedData: Buffer; checksum: string } {
    if (logger.verbose) logger.info('Encrypting the compressed data...');
    const encryptedData = encrypt(compressedData, password);
    const checksum = generateChecksum(encryptedData);
    if (logger.verbose) logger.info('Checksum generated for data integrity: ' + checksum);
    writeBufferToFile(path.join(outputFolder, 'packed.dat'), encryptedData);
    return { encryptedData, checksum };
}

/**
 * Splits encrypted data into chunks based on configuration.
 * @param encryptedData - Encrypted data buffer.
 * @param logger - Logger instance for debugging.
 * @returns Array of chunks.
 */
function splitDataIntoChunks(encryptedData: Buffer, logger: ILogger): IChunk[] {
    if (logger.verbose) logger.info('Splitting encrypted data into chunks...');
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

    if (logger.verbose) logger.info(`Total chunks created: ${chunks.length}`);
    return chunks;
}

/**
 * Analyzes PNG images for their embedding capacity.
 * @param inputPngFolder - Path to the folder containing PNG images.
 * @param logger - Logger instance for debugging.
 * @returns Array of PNG capacities.
 */
async function analyzePngCapacities(
    inputPngFolder: string,
    logger: ILogger
): Promise<{ file: string; capacity: number }[]> {
    if (logger.verbose) logger.info('Analyzing PNG images for capacity...');
    const pngFiles = readDirectory(inputPngFolder).filter(file => file.endsWith('.png'));
    if (pngFiles.length === 0) throw new Error('No PNG files found in the input folder.');

    if (pngFiles.length < 2)
        throw new Error('At least two PNG files are required (one for distribution map and at least one for data).');

    return await Promise.all(
        pngFiles.map(async png => {
            const pngPath = path.join(inputPngFolder, png);
            const capacity = await getCachedImageTones(pngPath, logger); // Use cached tones
            // Using 2 bits per channel on all RGB channels
            const bitsPerChannel = config.bitsPerChannelForDistributionMap;
            const channelsPerPixel = 3; // R, G, B
            const totalEmbeddableChannels = (capacity.low + capacity.mid + capacity.high) * channelsPerPixel;
            const channelsNeededPerByte = Math.ceil(8 / bitsPerChannel); // Number of channels needed to embed one byte
            const totalEmbeddableBytes = Math.floor(totalEmbeddableChannels / channelsNeededPerByte);
            if (logger.verbose) logger.debug(`PNG "${png}" can embed up to ${totalEmbeddableBytes} bytes.`);
            return {
                file: png,
                capacity: totalEmbeddableBytes
            };
        })
    );
}

/**
 * Distributes chunks across PNG images and creates a mapping of chunkId to chunk data.
 * @param chunks - Array of chunks to distribute.
 * @param pngCapacities - Array of PNG capacities.
 * @param inputPngFolder - Path to the folder containing PNG images.
 * @param logger - Logger instance for debugging.
 * @returns Object containing distribution map entries and a chunk map.
 */
async function distributeChunksAcrossPngs(
    chunks: IChunk[],
    pngCapacities: { file: string; capacity: number }[],
    inputPngFolder: string,
    logger: ILogger
): Promise<{ distributionMapEntries: IDistributionMapEntry[]; chunkMap: Map<number, Buffer> }> {
    if (logger.verbose) logger.info('Distributing chunks across PNG images...');

    const distributionMapEntries: IDistributionMapEntry[] = [];
    const usedPngs: Record<string, IUsedPng> = {};

    // Initialize usedPngs with usedCapacity, chunkCount, and chunks array
    for (const png of pngCapacities) {
        usedPngs[png.file] = { usedCapacity: 0, chunkCount: 0, chunks: [] };
    }

    // Initialize usedPositions to track channel usage per PNG
    const usedPositions: Record<string, boolean[]> = {};
    for (const png of pngCapacities) {
        const pngPath = path.join(inputPngFolder, png.file);
        const capacity = await getCachedImageTones(pngPath, logger);
        const totalChannels = (capacity.low + capacity.mid + capacity.high) * 3; // R, G, B
        usedPositions[png.file] = new Array(totalChannels).fill(false);
    }

    // Shuffle the chunks to randomize distribution
    const shuffledChunks = _.shuffle(chunks);
    // Shuffle the PNGs to ensure random assignment
    const shuffledPngCapacities = _.shuffle(pngCapacities);

    // Create a Map to store chunkId to chunk data
    const chunkMap = new Map<number, Buffer>();

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

        const channelSequence = _.shuffle(['R', 'G', 'B']) as ChannelSequence[];

        // Find a non-overlapping position
        let randomPosition;
        try {
            randomPosition = getRandomPosition(
                (await getCachedImageTones(path.join(inputPngFolder, png.file), logger)).low +
                    (await getCachedImageTones(path.join(inputPngFolder, png.file), logger)).mid +
                    (await getCachedImageTones(path.join(inputPngFolder, png.file), logger)).high,
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

        // Add to chunkMap
        chunkMap.set(chunk.id, chunk.data);

        // Create distribution map entry
        distributionMapEntries.push({
            chunkId: chunk.id,
            pngFile: png.file,
            startPosition: start, // Now in channels
            endPosition: end, // Now in channels
            bitsPerChannel: bitsPerChannel,
            channelSequence
        });

        if (logger.verbose) {
            logger.info(
                `Assigned chunk ${chunk.id} (Length: ${chunk.data.length} bytes) to "${png.file}" with ${bitsPerChannel} bits per channel. Position: ${start}-${end}`
            );
        }
    }

    // After distribution, check if all chunks have been assigned
    if (shuffledChunks.length > 0) {
        throw new Error('Not enough capacity to embed all chunks within the PNG images.');
    }

    if (logger.verbose) logger.info('Chunks distributed successfully.');
    return { distributionMapEntries, chunkMap };
}

/**
 * Injects chunks into their respective PNG images.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param chunkMap - Map of chunkId to chunk data.
 * @param inputPngFolder - Path to the folder containing input PNG images.
 * @param outputFolder - Path to the output folder for modified PNG images.
 * @param debugVisual - Whether to add debug visual blocks.
 * @param logger - Logger instance for debugging.
 */
async function injectChunksIntoPngs(
    distributionMapEntries: IDistributionMapEntry[],
    chunkMap: Map<number, Buffer>,
    inputPngFolder: string,
    outputFolder: string,
    debugVisual: boolean,
    logger: ILogger
): Promise<void> {
    if (logger.verbose) logger.info('Injecting chunks into PNG images...');

    // Ensure output folder exists
    ensureOutputDirectory(outputFolder);
    if (logger.verbose) logger.debug(`Ensured output folder "${outputFolder}".`);

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
            const chunkData = chunkMap.get(entry.chunkId);
            if (!chunkData) {
                throw new Error(`Chunk data for chunkId ${entry.chunkId} not found.`);
            }

            // Inject data into the image buffer
            await injectDataIntoBuffer(
                imageData,
                chunkData,
                entry.bitsPerChannel,
                entry.channelSequence,
                entry.startPosition,
                debugVisual,
                logger,
                width,
                height,
                imageChannels,
                entry.endPosition
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
        writeBufferToFile(outputPngPath, outputBuffer);
        if (logger.verbose) logger.info(`Injected all assigned chunks into "${pngFile}" and saved to output folder.`);
    });

    await Promise.all(injectPromises);
    if (logger.verbose) logger.info('All chunks injected successfully.');
}

/**
 * Creates and stores the distribution map.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param inputFile - Original input file name
 * @param checksum - Checksum of the encrypted data.
 * @param password - Password used for encryption.
 * @param outputFolder - Path to the output folder.
 * @param logger - Logger instance for debugging.
 */
async function createAndStoreDistributionMap(
    distributionMapEntries: IDistributionMapEntry[],
    inputFile: string,
    checksum: string,
    password: string,
    outputFolder: string,
    logger: ILogger
): Promise<void> {
    if (logger.verbose) logger.info('Creating and injecting the distribution map...');
    const serializedMap = createDistributionMap(distributionMapEntries, inputFile, checksum);
    const distributionMapCompressed = compressBuffer(serializedMap);
    const encryptedMap = encrypt(distributionMapCompressed, password);
    const distributionMapOutputPath = path.join(outputFolder, config.distributionMapFile + '.db');
    writeBufferToFile(distributionMapOutputPath, encryptedMap);
    if (logger.verbose) logger.info(`Distribution map encrypted and saved at "${distributionMapOutputPath}".`);
}

/**
 * Creates a human-readable distribution map text file.
 * @param distributionMapEntries - Array of distribution map entries.
 * @param originalFilename - Original Filename
 * @param checksum - Checksum of the encrypted data.
 * @param outputFolder - Path to the output folder.
 * @param logger - Logger instance for debugging.
 */
async function createHumanReadableDistributionMap(
    distributionMapEntries: IDistributionMapEntry[],
    originalFilename: string,
    checksum: string,
    outputFolder: string,
    logger: ILogger
): Promise<void> {
    if (logger.verbose) logger.info('Creating a human-readable distribution map text file...');
    const distributionMapTextPath = path.join(outputFolder, config.distributionMapFile + '.txt');
    const distributionMapText = generateDistributionMapText(distributionMapEntries, originalFilename, checksum);
    writeBufferToFile(distributionMapTextPath, Buffer.from(distributionMapText, 'utf-8'));
    if (logger.verbose) logger.info(`Distribution map text file created at "${distributionMapTextPath}".`);
}
