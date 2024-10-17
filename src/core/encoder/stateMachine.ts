// src/core/encoder/stateMachine.ts

import type { IChunk, IDistributionMapEntry, IEncodeOptions, IFileCapacityInfo } from '../../@types/index.ts';
import { compressBuffer } from '../../utils/compression/compression.ts';
import { encryptData, generateChecksum } from '../../utils/cryptography/crypto.ts';
import { splitDataIntoChunks } from '../chunking/splitChunks.ts';
import { analyzePngCapacities } from './lib/analyzeCapacities.ts';
import { createChunkDistributionInformation } from '../chunking/distributeChunks.ts';
import { injectChunksIntoPngs, injectDistributionMapIntoCarrierPng } from './lib/injection.ts';
import { createHumanReadableDistributionMap } from '../../utils/debug/debugHelper.ts';
import { decode } from '../decoder/index.ts';
import { ensureOutputDirectory, isCompressed, readBufferFromFile } from '../../utils/storage/storageUtils.ts';
import { SupportedCompressionStrategies } from '../../utils/compression/compressionStrategies.ts';
import * as path from 'jsr:/@std/path';
import { Buffer } from 'node:buffer';
import { prepareDistributionMapForInjection } from '../distributionMap/mapUtils.ts';
import { cacheImageTones } from '../../utils/imageProcessing/imageHelper.ts';
import { AbstractStateMachine } from '../../stateMachine/AbstractStateMachine.ts';
import { EncoderStates } from '../../stateMachine/definedStates.ts';
import { checkPngCapacity } from './lib/capacityChecker.ts';

export class EncodeStateMachine extends AbstractStateMachine<EncoderStates, IEncodeOptions> {
    private originalFileData: Buffer | null = null;
    private originalFilename: string | null = null;
    private compressedData: Buffer | null = null;
    private encryptedData: Buffer | null = null;
    private checksum: string | null = null;
    private chunks: IChunk[] = [];
    private pngCapacities: IFileCapacityInfo[] = [];
    private distributionCarrier: IFileCapacityInfo | null = null;
    private distributionMapEntries: IDistributionMapEntry[] = [];
    private chunkMap: Map<number, Buffer> = new Map();
    private encryptedMapContent: Buffer | null = null;
    private currentCompressionIndex: number = 0;
    private compressionStrategies: SupportedCompressionStrategies[];

    constructor(options: IEncodeOptions) {
        super(EncoderStates.INIT, options);
        this.compressionStrategies = [
            SupportedCompressionStrategies.Brotli,
            SupportedCompressionStrategies.GZip,
            SupportedCompressionStrategies.None,
        ];

        this.stateTransitions = [
            { state: EncoderStates.INIT, handler: this.init },
            { state: EncoderStates.OPTIMIZE_COMPRESSION_STRATEGY, handler: this.optimizeCompressionStrategy },
            { state: EncoderStates.READ_INPUT_FILE, handler: this.readInputFile },
            { state: EncoderStates.COMPRESS_DATA, handler: this.compressData },
            { state: EncoderStates.ENCRYPT_DATA, handler: this.encryptData },
            { state: EncoderStates.GENERATE_CHECKSUM, handler: this.generateChecksum },
            { state: EncoderStates.CHECK_INPUT_PNG_CAPACITY, handler: this.checkInputPngCapacity },
            { state: EncoderStates.SPLIT_DATA, handler: this.splitData },
            { state: EncoderStates.ANALYZE_PNG_CAPACITIES, handler: this.analyzePngCapacities },
            { state: EncoderStates.DISTRIBUTE_CHUNKS, handler: this.distributeChunks },
            { state: EncoderStates.INJECT_CHUNKS, handler: this.injectChunks },
            { state: EncoderStates.CREATE_DISTRIBUTION_MAP, handler: this.createDistributionMap },
            { state: EncoderStates.INJECT_DISTRIBUTION_MAP, handler: this.injectDistributionMap },
            { state: EncoderStates.WRITE_HUMAN_READABLE_MAP, handler: this.writeHumanReadableMap },
            { state: EncoderStates.VERIFY_ENCODING, handler: this.verifyEncoding },
        ];
    }

    protected getCompletionState(): EncoderStates {
        return EncoderStates.COMPLETED;
    }

    protected getErrorState(): EncoderStates {
        return EncoderStates.ERROR;
    }

    /**
     * Initializes the encoding process by setting up necessary configurations and caching image tones.
     *
     * @return {Promise<void>} A promise that resolves when the initialization is complete.
     */
    private async init(): Promise<void> {
        const { logger, verbose, inputPngFolder } = this.options;
        if (verbose) logger.info('Initializing encoding process...');
        await cacheImageTones(inputPngFolder, logger);
    }

    /**
     * Optimizes the compression strategy based on the input file type.
     *
     * For audio and video files (.mp3, .ogg, .mp4, .avi), it sets the compression strategies
     * to include GZip, Brotli, and None. For files that are already compressed, it limits
     * the compression strategy to None.
     *
     * @return {void}
     */
    private optimizeCompressionStrategy(): void {
        const { inputFile } = this.options;
        if (['.mp3', '.ogg', '.mp4', '.avi'].includes(path.extname(inputFile))) {
            this.compressionStrategies = [
                SupportedCompressionStrategies.GZip,
                SupportedCompressionStrategies.Brotli,
                SupportedCompressionStrategies.None,
            ];
        } else if (isCompressed(inputFile)) {
            this.compressionStrategies = [
                SupportedCompressionStrategies.None,
            ];
        }
    }
    /**
     * Reads the specified input file and stores its data and filename.
     * Logs debug messages regarding the process of reading the file.
     *
     * @return {Promise<void>} A promise that resolves when the file has been successfully read.
     */
    private async readInputFile(): Promise<void> {
        const { inputFile, logger } = this.options;
        logger.debug(`Reading input file: ${inputFile}`);
        try {
            this.originalFileData = await readBufferFromFile(inputFile);
            this.originalFilename = path.basename(inputFile);
            logger.debug(`Input file "${inputFile}" read successfully.`);
        } catch (error) {
            throw new Error(`Failed to read input file: ${(error as Error).message}`);
        }
    }

    /**
     * Compresses data using the specified compression strategies. If the data is already compressed,
     * it skips the compression step. Logs the progress and retries with alternative strategies
     * upon failure.
     *
     * @return {Promise<void>} A promise that resolves when the compression process is complete.
     */
    private async compressData(): Promise<void> {
        const { logger } = this.options;
        const strategy = this.compressionStrategies[this.currentCompressionIndex];
        logger.info(`Compressing data using ${strategy}...`);

        try {
            if (!isCompressed(this.originalFilename!)) {
                this.compressedData = compressBuffer(this.originalFileData!, strategy);
                logger.debug(`Data compressed using ${strategy}.`);
            } else {
                this.compressedData = this.originalFileData;
                logger.debug(`Data compression skipped.`);
            }
        } catch (error) {
            logger.warn(`Compression with ${strategy} failed: ${(error as Error).message}`);
            this.currentCompressionIndex += 1;
            if (this.currentCompressionIndex < this.compressionStrategies.length) {
                const nextStrategy = this.compressionStrategies[this.currentCompressionIndex];
                logger.info(`Retrying compression with next strategy: ${nextStrategy}`);
                this.transitionTo(EncoderStates.COMPRESS_DATA);
                await this.compressData();
            } else {
                throw new Error('All compression strategies failed.');
            }
        }
    }

    /**
     * Encrypts the compressed data using the provided password and logger.
     *
     * This method attempts to encrypt the compressed data stored in the instance
     * using the provided password. It logs the progress of the operation and any
     * errors encountered.
     *
     * @return {Promise<void>} A promise that resolves when the data encryption is complete.
     * @throws {Error} If the encryption process fails.
     */
    private async encryptData(): Promise<void> {
        const { logger, password } = this.options;
        logger.info('Encrypting data...');
        try {
            this.encryptedData = await encryptData(this.compressedData!, password, logger);
            logger.debug('Data encrypted successfully.');
        } catch (error) {
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Asynchronously checks the capacity of input PNG files to see if they can hold the encrypted data.
     *
     * This method uses the `checkPngCapacity` function with the encrypted data, input PNG folder,
     * and the logger from the provided options. If the capacity is insufficient, it throws an error,
     * specifying the number of additional PNG files needed.
     *
     * @return {Promise<void>} A promise that resolves if the capacity is sufficient; otherwise, it throws an error.
     */
    private async checkInputPngCapacity(): Promise<void> {
        const { logger } = this.options;
        const capacityInfo = await checkPngCapacity(
            this.encryptedData!,
            this.options.inputPngFolder,
            logger,
        );
        if (!capacityInfo.isSufficient) {
            throw new Error(
                `capacity for given input file is not sufficient (${capacityInfo.additionalPngsNeeded} additional input pngs required)`,
            );
        }
    }
    /**
     * Asynchronously generates a checksum for encrypted data and stores it.
     * Logs the progress of checksum generation.
     *
     * @return {Promise<void>} A promise that resolves when the checksum generation is complete.
     */
    private async generateChecksum(): Promise<void> {
        const { logger } = this.options;
        logger.info('Generating checksum...');
        try {
            const checksum = await generateChecksum(this.encryptedData!);
            this.checksum = checksum;
            logger.debug(`Checksum generated: ${checksum}`);
        } catch (error) {
            throw new Error(`Checksum generation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Splits the encrypted data into chunks and assigns the resulting chunks
     * to the `chunks` property. This method logs the progress and any errors
     * encountered during the data splitting process.
     *
     * @return {void} This method does not return a value.
     */
    private splitData(): void {
        const { logger } = this.options;
        logger.info('Splitting data into chunks...');
        try {
            const chunks = splitDataIntoChunks(this.encryptedData!, logger);
            this.chunks = chunks;
            logger.debug(`Data split into ${chunks.length} chunks.`);
        } catch (error) {
            throw new Error(`Data splitting failed: ${(error as Error).message}`);
        }
    }

    /**
     * Analyzes the capacities of PNG files in the specified input folder.
     * This method logs the start and end of the analysis process,
     * updates the pngCapacities and distributionCarrier properties,
     * and throws an error if the analysis fails.
     *
     * @return {void} No return value.
     */
    private analyzePngCapacities(): void {
        const { logger, inputPngFolder } = this.options;
        logger.info('Analyzing PNG capacities...');
        try {
            const capacities = analyzePngCapacities(inputPngFolder, logger);
            this.pngCapacities = capacities.pngCapacities;
            this.distributionCarrier = capacities.distributionCarrier;
            logger.debug(`PNG capacities analyzed.`);
        } catch (error) {
            throw new Error(`PNG capacity analysis failed: ${(error as Error).message}`);
        }
    }

    /**
     * Distributes chunks across PNG images based on the provided capacities and input folder.
     *
     * This method utilizes the `createChunkDistributionInformation` function to distribute
     * the chunks and updates the instance properties `distributionMapEntries` and `chunkMap`
     * accordingly.
     *
     * @return {Promise<void>} A promise that resolves when the chunks have been successfully distributed
     *                         or rejects with an error message if the distribution fails.
     */
    private async distributeChunks(): Promise<void> {
        const { logger, inputPngFolder } = this.options;
        logger.info('Distributing chunks across PNG images...');
        try {
            const { distributionMapEntries, chunkMap } = await createChunkDistributionInformation(
                this.chunks,
                this.pngCapacities,
                inputPngFolder,
                logger,
            );
            this.distributionMapEntries = distributionMapEntries;
            this.chunkMap = chunkMap;
            logger.debug(`Chunks distributed across PNG images.`);
        } catch (error) {
            throw new Error(`Chunk distribution failed: ${(error as Error).message}`);
        }
    }

    /**
     * Injects predefined chunks into PNG images located in the specified input folder.
     * The method processes the images asynchronously and stores the output images in the given output folder.
     * Logs information and debug messages during the injection process.
     *
     * @return {Promise<void>} A promise that resolves when the chunk injection process completes.
     * @throws {Error} If the chunk injection process fails, an error is thrown with a descriptive message.
     */
    private async injectChunks(): Promise<void> {
        const { logger, inputPngFolder, outputFolder, debugVisual } = this.options;
        logger.info('Injecting chunks into PNG images...');
        try {
            await injectChunksIntoPngs(
                this.distributionMapEntries,
                this.chunkMap,
                inputPngFolder,
                outputFolder,
                debugVisual,
                logger,
            );
            logger.debug(`Chunks injected into PNG images.`);
        } catch (error) {
            throw new Error(`Chunk injection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Creates an encrypted distribution map by preparing it for injection
     * with the given compression strategy, checksum, and original filename.
     *
     * @return {Promise<void>} A promise that resolves when the distribution map has been successfully created.
     */
    private async createDistributionMap(): Promise<void> {
        const { logger, password } = this.options;
        try {
            this.encryptedMapContent = await prepareDistributionMapForInjection(
                this.distributionMapEntries,
                this.compressionStrategies[this.currentCompressionIndex],
                this.originalFilename!,
                this.checksum!,
                password,
                this.encryptedData!.length,
                logger,
            );
            logger.debug(`Distribution map created.`);
        } catch (error) {
            throw new Error(`Distribution map creation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Injects the distribution map into the carrier PNG file.
     * This method uses the provided configuration options to locate the input PNG folder and the output folder.
     * It then calls the helper function `injectDistributionMapIntoCarrierPng` to perform the injection process.
     * It logs the progress and any potential errors encountered during the execution.
     *
     * @return {Promise<void>} A promise that resolves when the injection process is complete.
     */
    private async injectDistributionMap(): Promise<void> {
        const { logger, inputPngFolder, outputFolder } = this.options;
        logger.info('Injecting distribution map into carrier PNG...');
        try {
            await injectDistributionMapIntoCarrierPng(
                inputPngFolder,
                outputFolder,
                this.distributionCarrier!,
                this.encryptedMapContent!,
                logger,
            );
            logger.debug(`Distribution map injected into carrier PNG.`);
        } catch (error) {
            throw new Error(`Distribution map injection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Creates a human-readable distribution map with the provided distribution entries and metadata.
     * This method logs the process and handles potential errors by throwing an error with a detailed message.
     *
     * @return {Promise<void>} A promise that resolves when the human-readable distribution map is successfully created.
     */
    private async writeHumanReadableMap(): Promise<void> {
        const { logger, outputFolder } = this.options;
        logger.info('Creating human-readable distribution map...');
        try {
            await createHumanReadableDistributionMap(
                this.distributionMapEntries!,
                this.distributionCarrier!.file,
                this.originalFilename!,
                this.checksum!,
                outputFolder,
                this.compressionStrategies[this.currentCompressionIndex],
                logger,
            );
            logger.debug(`Human-readable distribution map created.`);
        } catch (error) {
            throw new Error(`Human-readable distribution map creation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Verifies the encoding process by decoding the output and comparing it to the original data.
     * If the verification option is disabled, it skips the verification step.
     *
     * @return {Promise<void>} A promise that resolves when the verification is complete.
     * @throws Will throw an error if the verification process fails or if the decoded data does not match the original data.
     */
    private async verifyEncoding(): Promise<void> {
        const { logger, verify, password, outputFolder, verbose, progressBar } = this.options;
        if (!verify) {
            logger.info('Verification step skipped.');
            return;
        }
        logger.info('Starting verification step...');
        const tempDecodedFolder = path.join(outputFolder, 'temp_decoded');
        try {
            ensureOutputDirectory(tempDecodedFolder);
            await decode({
                inputFolder: outputFolder,
                outputFolder: tempDecodedFolder,
                password,
                verbose,
                logger,
                progressBar,
            });
            const decodedFilePath = path.join(tempDecodedFolder, path.basename(this.options.inputFile));
            const decodedBuffer = await readBufferFromFile(decodedFilePath);
            if (decodedBuffer.subarray(0, this.originalFileData!.length).equals(this.originalFileData!)) {
                logger.success('Verification successful: Decoded data matches original data.');
            } else {
                throw new Error('Verification failed: Decoded data does not match original data.');
            }
        } catch (error) {
            throw new Error(`Verification step failed: ${(error as Error).message}`);
        }
    }
}
