// src/core/encoder/lib/capacityChecker.ts

import sharp from 'sharp';
import * as path from 'jsr:/@std/path';
import type { ILogger } from '../../../@types/index.ts';
import { readDirectory } from '../../../utils/storage/storageUtils.ts';
import { config } from '../../../config/index.ts';
import { toneCache } from '../../../utils/imageProcessing/imageHelper.ts';

/**
 * Interface representing the result of the capacity check.
 */
interface CapacityCheckResult {
    minimumPngsRequired: number;
    isSufficient: boolean;
    totalCapacity: number; // in bits
    requiredCapacity: number; // in bits
    additionalPngsNeeded?: number;
    chunksDistribution: Record<string, number>; // PNG filename to number of chunks
}

/**
 * Calculates the minimum number of PNG files required to meet or exceed the specified bit capacity.
 *
 * @param {number} requiredBits - The total number of bits required.
 * @param {Array<{file: string, capacity: number}>} pngCapacities - An array of objects each with a PNG file name and its bit capacity.
 * @return {number} The minimum number of PNG files needed to reach the required bit capacity.
 */
function calculateMinimumPngs(
    requiredBits: number,
    pngCapacities: Array<{ file: string; capacity: number }>,
): number {
    let cumulativeCapacity = 0;
    let pngCount = 0;

    for (const png of pngCapacities) {
        cumulativeCapacity += png.capacity;
        pngCount++;
        if (cumulativeCapacity >= requiredBits) {
            break;
        }
    }

    return pngCount;
}

/**
 * Analyzes the capacity of PNG files in a specified folder to determine if they have sufficient capacity
 * to embed the required number of bits from an input buffer.
 *
 * @param {Uint8Array} inputBuffer - The buffer containing the data to be embedded.
 * @param {string} inputPngFolder - The directory containing PNG files to be analyzed.
 * @param {ILogger} logger - Logger instance for logging information, warnings, and errors.
 * @return {Promise<CapacityCheckResult>} A promise that resolves to a CapacityCheckResult object
 * indicating the minimum number of PNGs required, their total capacity, the required capacity,
 * whether the available capacity is sufficient, and the distribution of chunks among the PNG files.
 */
export async function checkPngCapacity(
    inputBuffer: Uint8Array,
    inputPngFolder: string,
    logger: ILogger,
): Promise<CapacityCheckResult> {
    logger.info('Starting PNG capacity check...');

    // Step 1: Read Configuration Settings
    const {
        minChunksPerPng,
        maxChunksPerPng,
        minChunkSize,
        maxChunkSize,
    } = config.chunksDefinition;
    const bitsPerChannelForDistributionMap = config.bitsPerChannelForDistributionMap;
    const toneWeighting = config.toneWeighting;

    logger.debug(
        `Configuration - Min Chunks/Png: ${minChunksPerPng}, Max Chunks/Png: ${maxChunksPerPng}, Min Chunk Size: ${minChunkSize}, Max Chunk Size: ${maxChunkSize}, Bits/Channel: ${bitsPerChannelForDistributionMap}`,
    );
    logger.debug(`Tone Weighting - Low: ${toneWeighting.low}, Mid: ${toneWeighting.mid}, High: ${toneWeighting.high}`);

    // Step 2: Calculate Required Bits
    const requiredBits = inputBuffer.length * 8; // Convert bytes to bits
    logger.info(`Total bits required for embedding: ${requiredBits} bits`);

    // Step 3: Analyze PNG capacities
    logger.info('Analyzing PNG capacities...');
    const pngFiles = readDirectory(inputPngFolder).filter((file) => file.toLowerCase().endsWith('.png'));
    if (pngFiles.length === 0) {
        throw new Error('No PNG files found in the specified folder.');
    }

    const pngCapacities: Array<{ file: string; capacity: number }> = [];

    for (const png of pngFiles) {
        const pngPath = path.join(inputPngFolder, png);
        try {
            const image = sharp(pngPath).removeAlpha();
            const metadata = await image.metadata();
            const channels = metadata.channels || 3;

            const { width, height } = metadata;
            if (!width || !height) {
                logger.warn(`Unable to determine dimensions for "${png}". Skipping.`);
                continue;
            }

            // Base capacity calculation
            const baseCapacity = width * height * channels * bitsPerChannelForDistributionMap;

            // Retrieve tonal capacities from toneCache
            const toneData = toneCache[pngPath];
            if (!toneData) {
                logger.warn(`No tone data found for "${png}". Skipping.`);
                continue;
            }

            // Calculate weighted capacity based on tones
            // Assuming that low-toned areas allow for more data embedding
            const weightedCapacity = toneData.low * toneWeighting.low +
                toneData.mid * toneWeighting.mid +
                toneData.high * toneWeighting.high;

            // Ensure that the effective capacity does not exceed the base capacity
            const effectiveCapacity = Math.min(weightedCapacity, baseCapacity);

            // Calculate per PNG capacity based on chunk constraints
            // Each chunk requires at least minChunkSize and at most maxChunkSize
            const minBitsPerPng = minChunksPerPng * minChunkSize * 8 * bitsPerChannelForDistributionMap;
            const maxBitsPerPng = maxChunksPerPng * maxChunkSize * 8 * bitsPerChannelForDistributionMap;

            // The actual capacity is the minimum of the calculated effective capacity and maxBitsPerPng
            const finalCapacity = Math.min(effectiveCapacity, maxBitsPerPng);

            // Ensure that the PNG can accommodate at least the minimum required bits per PNG
            if (finalCapacity < minBitsPerPng) {
                logger.warn(
                    `PNG "${png}" cannot accommodate the minimum required bits per PNG (${minBitsPerPng} bits). Skipping.`,
                );
                continue;
            }

            pngCapacities.push({ file: png, capacity: finalCapacity });
            logger.debug(`PNG "${png}": Effective Capacity = ${finalCapacity} bits`);
        } catch (error) {
            logger.warn(`Failed to process "${png}": ${(error as Error).message}`);
        }
    }

    if (pngCapacities.length === 0) {
        throw new Error('No valid PNG files with sufficient capacities found.');
    }

    // Step 4: Sort PNGs by capacity descending
    pngCapacities.sort((a, b) => b.capacity - a.capacity);

    // Step 5: Determine the minimum number of PNGs required
    const minimumPngsRequired = calculateMinimumPngs(requiredBits, pngCapacities);

    // Step 6: Check if the total available capacity is sufficient
    const totalAvailableCapacity = pngCapacities.slice(0, minimumPngsRequired).reduce(
        (sum, png) => sum + png.capacity,
        0,
    );
    const isSufficient = totalAvailableCapacity >= requiredBits;

    // Step 7: Calculate additional PNGs needed if insufficient
    let additionalPngsNeeded: number | undefined = undefined;
    if (!isSufficient) {
        const remainingBits = requiredBits - totalAvailableCapacity;
        // Calculate how many more PNGs are needed based on maxBitsPerPng
        additionalPngsNeeded = Math.ceil(remainingBits / Math.min(...pngCapacities.map((png) => png.capacity)));
    }

    // Step 8: Compile the result
    const chunksDistribution: Record<string, number> = {};
    let bitsAccumulated = 0;
    let pngsUsed = 0;

    for (const png of pngCapacities) {
        if (bitsAccumulated >= requiredBits) break;
        pngsUsed++;
        const bitsNeeded = requiredBits - bitsAccumulated;
        const bitsToUse = Math.min(bitsNeeded, png.capacity);
        const chunksForPng = Math.ceil(bitsToUse / (maxChunkSize * 8 * bitsPerChannelForDistributionMap));

        // Ensure that chunksForPng does not exceed maxChunksPerPng and is at least minChunksPerPng
        const finalChunks = Math.min(Math.max(chunksForPng, minChunksPerPng), maxChunksPerPng);

        chunksDistribution[png.file] = finalChunks;
        bitsAccumulated += finalChunks * minChunkSize * 8 * bitsPerChannelForDistributionMap;
    }

    const result: CapacityCheckResult = {
        minimumPngsRequired: pngsUsed,
        isSufficient,
        totalCapacity: totalAvailableCapacity,
        requiredCapacity: requiredBits,
        chunksDistribution,
    };

    if (!isSufficient && additionalPngsNeeded !== undefined) {
        result.additionalPngsNeeded = additionalPngsNeeded;
    }

    // Log the result
    logger.debug(`Minimum PNGs required: ${result.minimumPngsRequired}`);
    logger.debug(`Total available capacity (first ${result.minimumPngsRequired} PNGs): ${result.totalCapacity} bits`);
    logger.debug(`Required capacity: ${result.requiredCapacity} bits`);
    if (isSufficient) {
        logger.success('Sufficient PNG capacity available for encoding.');
    } else {
        logger.error(`Insufficient PNG capacity. Additional ${result.additionalPngsNeeded} PNG(s) needed.`);
    }

    // Optionally, log chunks distribution
    for (const [png, chunks] of Object.entries(result.chunksDistribution)) {
        logger.debug(`PNG "${png}" will embed ${chunks} chunk(s).`);
    }

    return result;
}
