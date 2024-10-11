// src/core/decoder/stateMachine.ts

import type { IChunk, IDecodeOptions, IDistributionMap } from '../../@types/index.ts';
import type { Buffer } from 'node:buffer';
import * as path from 'jsr:@std/path';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { readAndProcessDistributionMap } from '../distributionMap/mapUtils.ts';
import { extractChunks } from '../lib/extraction.ts';
import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { assembleChunks } from '../lib/assembleChunks.ts';

type StateHandler = () => Promise<void> | void;

interface StateTransition {
    state: string;
    handler: StateHandler;
}

/**
 * DecodeStateMachine is responsible for managing the decoding process through a series of state transitions.
 * It sequentially performs tasks such as reading a distribution map, extracting encrypted data chunks,
 * assembling the data, verifying and decrypting the data, decompressing, and ultimately writing the output.
 */
export class DecodeStateMachine {
    private state: string = 'INIT';
    private readonly options: IDecodeOptions;
    private distributionMap: IDistributionMap | null = null;
    private encryptedDataChunks: IChunk[] = [];
    private encryptedData: Buffer | null = null;
    private decryptedData: Buffer | null = null;
    private decompressedData: Buffer | null = null;

    private readonly stateTransitions: StateTransition[];

    constructor(
        options: IDecodeOptions,
    ) {
        this.options = options;
        this.stateTransitions = [
            { state: 'INIT', handler: this.init },
            { state: 'READ_MAP', handler: this.readMap },
            { state: 'EXTRACT_CHUNKS', handler: this.extractChunks },
            { state: 'ASSEMBLE_DATA', handler: this.assembleData },
            { state: 'VERIFY_DECRYPT', handler: this.verifyAndDecryptData },
            { state: 'DECOMPRESS', handler: this.decompressData },
            { state: 'WRITE_OUTPUT', handler: this.writeOutput },
        ];
    }

    /**
     * Executes a series of state transitions by iterating through the stateTransitions array.
     * Each transition consists of changing the state and awaiting the associated handler.
     * If any handler throws an error, the state transitions to 'ERROR' and the error is handled.
     * If all transitions complete successfully, the state transitions to 'COMPLETED'.
     *
     * @return A promise that resolves when all state transitions and their handlers have completed.
     */
    async run(): Promise<void> {
        try {
            for (const transition of this.stateTransitions) {
                this.transitionTo(transition.state);
                await transition.handler();
            }
            this.transitionTo('COMPLETED');
        } catch (error) {
            this.transitionTo('ERROR', error as Error);
            this.handleError(error as Error);
        }
    }

    /**
     * Initializes the decoding process.
     * This method retrieves the logger and verbosity settings from the options object.
     * If verbosity is enabled, it logs an informational message indicating the start of the initialization.
     *
     * @return {void}
     */
    private init(): void {
        const { logger, verbose } = this.options;
        if (verbose) logger.info('Initializing decoding process...');
    }

    /**
     * Asynchronously reads and processes a distribution map using the provided input folder,
     * password, and logger from the options object. The processed distribution map is then
     * stored in the instance variable `distributionMap`.
     *
     * @return {Promise<void>} A promise that resolves when the distribution map has been successfully read and processed.
     */
    private async readMap(): Promise<void> {
        const { inputFolder, password, logger } = this.options;
        this.distributionMap = await readAndProcessDistributionMap(
            inputFolder,
            password,
            logger,
        );
    }

    /**
     * Extracts chunks of data asynchronously and assigns the encrypted data chunks.
     *
     * @return {Promise<void>} A promise that resolves to void when the chunk extraction is complete.
     */
    private async extractChunks(): Promise<void> {
        const { inputFolder, logger } = this.options;
        this.encryptedDataChunks = await extractChunks(this.distributionMap!, inputFolder, logger);
    }

    /**
     * Assembles encrypted data chunks into a single encrypted data array.
     * Utilizes the `assembleChunks` function and a logger obtained from options.
     *
     * @return {void}
     */
    private assembleData(): void {
        const { logger } = this.options;
        this.encryptedData = assembleChunks(this.encryptedDataChunks, logger).subarray(
            0,
            this.distributionMap!.encryptedDataLength,
        );
    }

    /**
     * Verifies the integrity of the encrypted data using a checksum and decrypts it.
     * Utilizes the provided logger for logging the process and the password for decryption.
     *
     * @return A promise that resolves when the data has been successfully verified and decrypted.
     */
    private async verifyAndDecryptData(): Promise<void> {
        const { password, logger } = this.options;
        await verifyDataIntegrity(this.encryptedData!, this.distributionMap!.checksum, logger);
        this.decryptedData = await decryptData(this.encryptedData!, password, logger);
    }

    /**
     * Decompresses the data stored in the decryptedData property using the specified compression strategy.
     * Updates the decompressedData property with the decompressed result.
     * Logs a message indicating successful decompression.
     *
     * @return {void} No value is returned.
     */
    private decompressData(): void {
        const { logger } = this.options;
        this.decompressedData = decompressBuffer(
            this.decryptedData!,
            this.distributionMap!.compressionStrategy,
        );
        logger.info('Data decompressed successfully.');
    }

    /**
     * Writes the decompressed data to a file specified by the output folder and filename.
     * It combines the output folder path with the original filename of the distribution map.
     * Upon successful write, it logs a message indicating the completion and the path to the output file.
     *
     * @return {Promise<void>} A promise that resolves when the write operation is complete.
     */
    private async writeOutput(): Promise<void> {
        const { outputFolder, logger } = this.options;
        const outputFile = path.join(outputFolder, this.distributionMap!.originalFilename);
        await writeBufferToFile(outputFile, this.decompressedData!);
        logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    }

    /**
     * Handles the transition from the current state to the next state.
     *
     * @param {string} nextState - The state to transition to.
     * @param {Error} [error] - An optional error that triggers transition to the 'ERROR' state.
     * @return {void}
     */
    private transitionTo(nextState: string, error?: Error): void {
        const { logger } = this.options;
        if (error) {
            logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = 'ERROR';
        } else {
            logger.debug(`Transitioning from "${this.state}" to "${nextState}"`);
            this.state = nextState;
        }
    }

    /**
     * Handles errors that occur during the decoding process.
     *
     * @param {Error} error - The error object that contains information about the error.
     * @return {void}
     */
    private handleError(error: Error): void {
        this.options.logger.error(`Decoding failed: ${error.message}`);
        throw error;
    }
}
