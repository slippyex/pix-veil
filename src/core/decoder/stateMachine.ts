// src/core/decoder/stateMachine.ts

import { type IChunk, IDecodeOptions, IDistributionMap, SupportedCompressionStrategies } from '../../@types/index.ts';
import * as path from 'jsr:@std/path';
import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { assembleChunks, extractChunks } from '../lib/extraction.ts';
import { readAndProcessDistributionMap } from '../distributionMap/mapUtils.ts';
import { Buffer } from 'node:buffer';

/**
 * Enum representing the possible states in the decoding process.
 */
enum DecodeState {
    INIT = 'INIT',
    READ_MAP = 'READ_MAP',
    EXTRACT_CHUNKS = 'EXTRACT_CHUNKS',
    ASSEMBLE_DATA = 'ASSEMBLE_DATA',
    VERIFY_DECRYPT = 'VERIFY_DECRYPT',
    DECOMPRESS = 'DECOMPRESS',
    WRITE_OUTPUT = 'WRITE_OUTPUT',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

/**
 * The DecodeStateMachine class handles the process of decoding encrypted and compressed data.
 * This state machine transitions through multiple states to initialize, read the distribution map,
 * extract chunks, assemble data, verify and decrypt data, decompress data, and finally write the output.
 *
 * @class
 */
export class DecodeStateMachine {
    private state: DecodeState;
    private readonly options: IDecodeOptions;
    private distributionMap: IDistributionMap = {
        entries: [],
        compressionStrategy: SupportedCompressionStrategies.Brotli,
        checksum: '',
        originalFilename: '',
        encryptedDataLength: 0,
    };
    private encryptedDataChunks: IChunk[] = [];
    private encryptedData: Buffer = Buffer.alloc(0);
    private decryptedData: Uint8Array = new Uint8Array();
    private decompressedData: Uint8Array = new Uint8Array();

    constructor(options: IDecodeOptions) {
        this.state = DecodeState.INIT;
        this.options = options;
    }

    /**
     * Executes a loop that processes data through various decoding stages.
     * The method transitions through states such as initialization, reading a map, extracting chunks,
     * assembling data, verifying and decrypting data, decompressing data, writing the output, and handling errors.
     * The loop continues until the state is marked as completed.
     *
     * @return {Promise<void>} A promise that resolves when the decoding process has completed
     */
    async run(): Promise<void> {
        while (this.state !== DecodeState.COMPLETED) {
            switch (this.state) {
                case DecodeState.INIT:
                    this.init();
                    break;
                case DecodeState.READ_MAP:
                    await this.readMap();
                    break;
                case DecodeState.EXTRACT_CHUNKS:
                    await this.extractChunks();
                    break;
                case DecodeState.ASSEMBLE_DATA:
                    this.assembleData();
                    break;
                case DecodeState.VERIFY_DECRYPT:
                    await this.verifyAndDecryptData();
                    break;
                case DecodeState.DECOMPRESS:
                    this.decompressData();
                    break;
                case DecodeState.WRITE_OUTPUT:
                    await this.writeOutput();
                    break;
                case DecodeState.ERROR:
                    // Error handling state
                    this.handleError();
                    break;
            }
        }
    }

    /**
     * Initializes the decoding process. This method sets up necessary
     * configurations and transitions the decoder to the initial state.
     *
     * @return {void} This method does not return a value.
     */
    private init(): void {
        const { logger, verbose } = this.options;
        if (verbose) logger.info('Initializing decoding process...');
        this.transitionTo(DecodeState.READ_MAP);
    }

    /**
     * Reads and processes the distribution map from the specified input folder using the provided password and logger.
     * Sets the distribution map to the processed result and transitions to the EXTRACT_CHUNKS state on success.
     * If an error occurs, transitions to the ERROR state with the encountered error.
     *
     * @return {Promise<void>} A promise that resolves when the distribution map is successfully read and processed.
     */
    private async readMap(): Promise<void> {
        const { inputFolder, password, logger } = this.options;
        try {
            this.distributionMap = await readAndProcessDistributionMap(inputFolder, password, logger);
            this.transitionTo(DecodeState.EXTRACT_CHUNKS);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Extracts data chunks from the given distribution map and input folder and transitions the state to ASSEMBLE_DATA.
     * If an error occurs during extraction, transitions the state to ERROR with the error.
     *
     * @return {Promise<void>} A promise that resolves when the extraction is complete or rejects if an error occurs.
     */
    private async extractChunks(): Promise<void> {
        const { inputFolder, logger } = this.options;
        try {
            this.encryptedDataChunks = await extractChunks(this.distributionMap, inputFolder, logger);
            this.transitionTo(DecodeState.ASSEMBLE_DATA);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Assembles data chunks into a complete encrypted data array based on the provided options.
     *
     * This method utilizes the `assembleChunks` function to merge encrypted data chunks.
     * It adjusts the size of the assembled data to match the expected length from the distribution map.
     * If successful, the state transitions to VERIFY_DECRYPT; otherwise, it transitions to ERROR.
     *
     * @return {void} No return value.
     */
    private assembleData(): void {
        const { logger } = this.options;
        try {
            this.encryptedData = assembleChunks(this.encryptedDataChunks, logger);
            this.encryptedData = this.encryptedData.subarray(0, this.distributionMap.encryptedDataLength);
            this.transitionTo(DecodeState.VERIFY_DECRYPT);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Verifies the integrity of the encrypted data using the provided checksum and
     * then decrypts the data using the provided password. If the data integrity
     * check fails or decryption throws an error, the method transitions to an
     * error state. Upon successful decryption, it transitions to the decompression state.
     *
     * @return {Promise<void>} A promise that resolves when the data has been
     *                         verified and decrypted, or rejects if an error occurs.
     */
    private async verifyAndDecryptData(): Promise<void> {
        const { password, logger } = this.options;
        try {
            await verifyDataIntegrity(this.encryptedData, this.distributionMap.checksum, logger);
            this.decryptedData = await decryptData(this.encryptedData, password, logger);
            this.transitionTo(DecodeState.DECOMPRESS);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Decompresses the decrypted data using the specified compression strategy.
     * If no compression strategy is specified, the decrypted data is used as is.
     * Transitions to the WRITE_OUTPUT state upon success, or to the ERROR state upon failure.
     *
     * @return {void}
     */
    private decompressData(): void {
        const { logger } = this.options;
        try {
            if (this.distributionMap.compressionStrategy !== SupportedCompressionStrategies.None) {
                this.decompressedData = decompressBuffer(this.decryptedData, this.distributionMap.compressionStrategy);
                logger.info('Data decompressed successfully.');
            } else {
                this.decompressedData = this.decryptedData;
            }
            this.transitionTo(DecodeState.WRITE_OUTPUT);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Asynchronously writes the decompressed data to a file in the specified output folder.
     *
     * Constructs the output file path using the `outputFolder` and original filename.
     * Writes the decompressed data buffer to this file. Logs a success message upon
     * completion and transitions to the `COMPLETED` state. If an error occurs, transitions
     * to the `ERROR` state with the associated error.
     *
     * @return {Promise<void>} A promise that resolves when the operation completes.
     */
    private async writeOutput(): Promise<void> {
        const { outputFolder, logger } = this.options;
        try {
            const outputFile = path.join(outputFolder, this.distributionMap.originalFilename);
            await writeBufferToFile(outputFile, this.decompressedData);
            logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
            this.transitionTo(DecodeState.COMPLETED);
        } catch (error) {
            this.transitionTo(DecodeState.ERROR, error as Error);
        }
    }

    /**
     * Transitions the current state to the specified next state or to an error state if an error is provided.
     *
     * @param {DecodeState} nextState - The state to transition to.
     * @param {Error} [error] - An optional error that, if provided, will cause the state to transition to ERROR.
     * @return {void}
     */
    private transitionTo(nextState: DecodeState, error?: Error): void {
        if (error) {
            this.options.logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = DecodeState.ERROR;
        } else {
            this.state = nextState;
        }
    }

    /**
     * Handles errors during the decoding process.
     * Logs an error message and throws a new error.
     *
     * @returns {void}
     */
    private handleError(): void {
        this.options.logger.error('Decoding failed. Please check the logs for details.');
        throw new Error('Decoding process encountered an error.');
    }
}
