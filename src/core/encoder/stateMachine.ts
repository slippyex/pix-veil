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

export enum EncoderStates {
    INIT = 'INIT',
    READ_INPUT_FILE = 'READ_INPUT_FILE',
    COMPRESS_DATA = 'COMPRESS_DATA',
    ENCRYPT_DATA = 'ENCRYPT_DATA',
    GENERATE_CHECKSUM = 'GENERATE_CHECKSUM',
    SPLIT_DATA = 'SPLIT_DATA',
    ANALYZE_PNG_CAPACITIES = 'ANALYZE_PNG_CAPACITIES',
    DISTRIBUTE_CHUNKS = 'DISTRIBUTE_CHUNKS',
    INJECT_CHUNKS = 'INJECT_CHUNKS',
    CREATE_DISTRIBUTION_MAP = 'CREATE_DISTRIBUTION_MAP',
    INJECT_DISTRIBUTION_MAP = 'INJECT_DISTRIBUTION_MAP',
    WRITE_HUMAN_READABLE_MAP = 'WRITE_HUMAN_READABLE_MAP',
    VERIFY_ENCODING = 'VERIFY_ENCODING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

interface StateTransition {
    state: EncoderStates;
    handler: () => Promise<void> | void;
}

/**
 * EncodeStateMachine manages the encoding process through state transitions.
 */
export class EncodeStateMachine {
    private state: string = EncoderStates.INIT;
    private readonly options: IEncodeOptions;
    private readonly compressionStrategies: SupportedCompressionStrategies[];
    private currentCompressionIndex: number = 0;
    private originalFileData: Buffer = Buffer.alloc(0);
    private originalFilename: string = '';
    private compressedData: Buffer = Buffer.alloc(0);
    private encryptedData: Buffer = Buffer.alloc(0);
    private checksum: string = '';
    private chunks: IChunk[] = [];
    private pngCapacities: { pngCapacities: IFileCapacityInfo[]; distributionCarrier: IFileCapacityInfo } = {
        pngCapacities: [],
        distributionCarrier: { file: '', capacity: 0, tone: 'low' },
    };
    private distributionMapEntries: IDistributionMapEntry[] = [];
    private chunkMap: Map<number, Buffer> = new Map();
    private compressionStrategy: SupportedCompressionStrategies = SupportedCompressionStrategies.Brotli;
    private readonly stateTransitions: StateTransition[];
    private encryptedMapContent: Buffer = Buffer.alloc(0);

    constructor(options: IEncodeOptions) {
        this.options = options;
        this.compressionStrategies = [
            SupportedCompressionStrategies.Brotli,
            SupportedCompressionStrategies.GZip,
            SupportedCompressionStrategies.None,
        ];
        this.stateTransitions = [
            { state: EncoderStates.INIT, handler: this.init },
            { state: EncoderStates.READ_INPUT_FILE, handler: this.readInputFile },
            { state: EncoderStates.COMPRESS_DATA, handler: this.compressData },
            { state: EncoderStates.ENCRYPT_DATA, handler: this.encryptData },
            { state: EncoderStates.GENERATE_CHECKSUM, handler: this.generateChecksum },
            { state: EncoderStates.SPLIT_DATA, handler: this.splitData },
            { state: EncoderStates.ANALYZE_PNG_CAPACITIES, handler: this.analyzePngCapacities },
            { state: EncoderStates.DISTRIBUTE_CHUNKS, handler: this.distributeChunks },
            { state: EncoderStates.INJECT_CHUNKS, handler: this.injectChunks },
            { state: EncoderStates.CREATE_DISTRIBUTION_MAP, handler: this.createDistributionMap },
            { state: EncoderStates.INJECT_DISTRIBUTION_MAP, handler: this.injectDistributionMap },
            { state: EncoderStates.WRITE_HUMAN_READABLE_MAP, handler: this.writeHumanReadableMap },
            { state: EncoderStates.VERIFY_ENCODING, handler: this.verifyEncoding },
            { state: EncoderStates.COMPLETED, handler: this.complete },
        ];
    }

    /**
     * Runs the state machine by sequentially executing each state's handler.
     */
    async run(): Promise<void> {
        try {
            for (const transition of this.stateTransitions) {
                this.transitionTo(transition.state);
                await transition.handler.bind(this)();
            }
            this.transitionTo(EncoderStates.COMPLETED);
        } catch (error) {
            this.transitionTo(EncoderStates.ERROR, error as Error);
            this.handleError(error as Error);
        }
    }

    /**
     * Transitions the state machine to a new state.
     * @param nextState The state to transition to.
     * @param error Optional error triggering an error transition.
     */
    private transitionTo(nextState: EncoderStates, error?: Error): void {
        const { logger } = this.options;
        if (nextState === EncoderStates.ERROR && error) {
            logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = EncoderStates.ERROR;
        } else {
            logger.debug(`Transitioning from "${this.state}" to "${nextState}"`);
            this.state = nextState;
        }
    }

    /**
     * Handles errors by logging and throwing them.
     * @param error The error that occurred.
     */
    private handleError(error: Error): void {
        this.options.logger.error(`Encoding failed: ${error.message}`);
        throw error;
    }

    /**
     * Initializes the encoding process.
     */
    private async init(): Promise<void> {
        const { logger, verbose, inputPngFolder } = this.options;
        if (verbose) logger.info('Initializing encoding process...');
        await cacheImageTones(inputPngFolder, logger);
    }

    /**
     * Reads the input file into a buffer.
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
     * Compresses the data using the current compression strategy.
     */
    private async compressData(): Promise<void> {
        const { logger } = this.options;
        const strategy = this.compressionStrategies[this.currentCompressionIndex];
        logger.info(`Compressing data using ${strategy}...`);

        try {
            if (!isCompressed(this.originalFilename)) {
                this.compressedData = compressBuffer(this.originalFileData, strategy);
                logger.debug(`Data compressed using ${strategy}.`);
            } else {
                this.compressedData = this.originalFileData;
                logger.debug(`Data compression skipped.`);
            }
            this.transitionTo(EncoderStates.ENCRYPT_DATA);
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
     * Encrypts the compressed data.
     */
    private async encryptData(): Promise<void> {
        const { logger, password } = this.options;
        logger.info('Encrypting data...');
        try {
            this.encryptedData = await encryptData(this.compressedData, password, logger);
            logger.debug('Data encrypted successfully.');
            this.transitionTo(EncoderStates.GENERATE_CHECKSUM);
        } catch (error) {
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Generates a checksum for the encrypted data.
     */
    private async generateChecksum(): Promise<void> {
        const { logger } = this.options;
        logger.info('Generating checksum...');
        try {
            const checksum = await generateChecksum(this.encryptedData);
            this.checksum = checksum;
            logger.debug(`Checksum generated: ${checksum}`);
            this.transitionTo(EncoderStates.SPLIT_DATA);
        } catch (error) {
            throw new Error(`Checksum generation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Splits the encrypted data into chunks.
     */
    private splitData(): void {
        const { logger } = this.options;
        logger.info('Splitting data into chunks...');
        try {
            const chunks = splitDataIntoChunks(this.encryptedData, logger);
            this.chunks = chunks;
            logger.debug(`Data split into ${chunks.length} chunks.`);
            this.transitionTo(EncoderStates.ANALYZE_PNG_CAPACITIES);
        } catch (error) {
            throw new Error(`Data splitting failed: ${(error as Error).message}`);
        }
    }

    /**
     * Analyzes PNG capacities for data embedding.
     */
    private analyzePngCapacities(): void {
        const { logger, inputPngFolder } = this.options;
        logger.info('Analyzing PNG capacities...');
        try {
            this.pngCapacities = analyzePngCapacities(inputPngFolder, logger);
            logger.debug(`PNG capacities analyzed.`);
            this.transitionTo(EncoderStates.DISTRIBUTE_CHUNKS);
        } catch (error) {
            throw new Error(`PNG capacity analysis failed: ${(error as Error).message}`);
        }
    }

    /**
     * Distributes chunks across PNG images.
     */
    private async distributeChunks(): Promise<void> {
        const { logger, inputPngFolder } = this.options;
        logger.info('Distributing chunks across PNG images...');
        try {
            const { distributionMapEntries, chunkMap } = await createChunkDistributionInformation(
                this.chunks,
                this.pngCapacities.pngCapacities,
                inputPngFolder,
                logger,
            );
            this.distributionMapEntries = distributionMapEntries;
            this.chunkMap = chunkMap;
            logger.debug(`Chunks distributed across PNG images.`);
            this.transitionTo(EncoderStates.INJECT_CHUNKS);
        } catch (error) {
            throw new Error(`Chunk distribution failed: ${(error as Error).message}`);
        }
    }

    /**
     * Injects chunks into PNG images.
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
            this.transitionTo(EncoderStates.CREATE_DISTRIBUTION_MAP);
        } catch (error) {
            throw new Error(`Chunk injection failed: ${(error as Error).message}`);
        }
    }

    private async createDistributionMap(): Promise<void> {
        const { logger, password } = this.options;
        try {
            await prepareDistributionMapForInjection(
                this.distributionMapEntries,
                this.compressionStrategy,
                this.originalFilename,
                this.checksum,
                password,
                this.encryptedData.length,
                logger,
            );
            logger.debug(`Distribution map created.`);
            this.transitionTo(EncoderStates.INJECT_DISTRIBUTION_MAP);
        } catch (error) {
            throw new Error(`Distribution map creation failed: ${(error as Error).message}`);
        }
    }
    /**
     * Injects the distribution map into a carrier PNG image.
     */
    private async injectDistributionMap(): Promise<void> {
        const { logger, inputPngFolder, outputFolder } = this.options;
        logger.info('Injecting distribution map into carrier PNG...');
        try {
            await injectDistributionMapIntoCarrierPng(
                inputPngFolder,
                outputFolder,
                this.pngCapacities.distributionCarrier!,
                this.encryptedMapContent!,
                logger,
            );
            logger.debug(`Distribution map injected into carrier PNG.`);
            this.transitionTo(EncoderStates.WRITE_HUMAN_READABLE_MAP);
        } catch (error) {
            throw new Error(`Distribution map injection failed: ${(error as Error).message}`);
        }
    }

    /**
     * Writes a human-readable distribution map file.
     */
    private async writeHumanReadableMap(): Promise<void> {
        const { logger, outputFolder } = this.options;
        logger.info('Creating human-readable distribution map...');
        try {
            await createHumanReadableDistributionMap(
                this.distributionMapEntries!,
                this.pngCapacities.distributionCarrier!.file,
                this.originalFilename!,
                this.checksum!,
                outputFolder,
                this.compressionStrategy,
                logger,
            );
            logger.debug(`Human-readable distribution map created.`);
            this.transitionTo(EncoderStates.VERIFY_ENCODING);
        } catch (error) {
            throw new Error(`Human-readable distribution map creation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Verifies the encoding by decoding and comparing data.
     */
    private async verifyEncoding(): Promise<void> {
        const { logger, verify, password, outputFolder, verbose } = this.options;
        if (!verify) {
            logger.info('Verification step skipped.');
            this.transitionTo(EncoderStates.COMPLETED);
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
            });
            const decodedFilePath = path.join(tempDecodedFolder, path.basename(this.options.inputFile));
            const decodedBuffer = await readBufferFromFile(decodedFilePath);
            if (decodedBuffer.subarray(0, this.originalFileData!.length).equals(this.originalFileData)) {
                logger.success('Verification successful: Decoded data matches original data.');
            } else {
                throw new Error('Verification failed: Decoded data does not match original data.');
            }
            this.transitionTo(EncoderStates.COMPLETED);
        } catch (error) {
            throw new Error(`Verification step failed: ${(error as Error).message}`);
        } finally {
            // Optional: Clean up temporary folder
            // fs.rmSync(tempDecodedFolder, { recursive: true, force: true });
        }
    }

    /**
     * Finalizes the encoding process.
     */
    private complete(): void {
        const { logger } = this.options;
        logger.info('Encoding process completed successfully.');
    }
}
