// src/core/decoder/stateMachine.ts

import type { IChunk, IDecodeOptions, IDistributionMap } from '../../@types/index.ts';
import type { Buffer } from 'node:buffer';
import * as path from 'jsr:/@std/path';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { readAndProcessDistributionMap } from '../distributionMap/mapUtils.ts';
import { extractChunks } from './lib/extraction.ts';
import { assembleChunks } from '../chunking/assembleChunks.ts';
import { AbstractStateMachine } from '../../stateMachine/AbstractStateMachine.ts';
import { DecoderStates } from '../../stateMachine/definedStates.ts';
import { SupportedCryptoStrategies } from '../../utils/cryptography/cryptoStrategies.ts';

export class DecodeStateMachine extends AbstractStateMachine<DecoderStates, IDecodeOptions> {
    private distributionMap: IDistributionMap | null = null;
    private encryptedDataChunks: IChunk[] = [];
    private encryptedData: Buffer | null = null;
    private decryptedData: Buffer | null = null;
    private decompressedData: Buffer | null = null;

    constructor(options: IDecodeOptions) {
        super(DecoderStates.INIT, options);
        this.stateTransitions = [
            { state: DecoderStates.INIT, handler: this.init },
            { state: DecoderStates.READ_MAP, handler: this.readMap },
            { state: DecoderStates.EXTRACT_CHUNKS, handler: this.extractChunks },
            { state: DecoderStates.ASSEMBLE_DATA, handler: this.assembleData },
            { state: DecoderStates.VERIFY_DECRYPT, handler: this.verifyAndDecryptData },
            { state: DecoderStates.DECOMPRESS, handler: this.decompressData },
            { state: DecoderStates.WRITE_OUTPUT, handler: this.writeOutput },
        ];
    }

    protected getCompletionState(): DecoderStates {
        return DecoderStates.COMPLETED;
    }

    protected getErrorState(): DecoderStates {
        return DecoderStates.ERROR;
    }

    /**
     * Initializes the decoding process by accessing the logger and verbose options from this.options.
     *
     * @return {void}
     */
    private init(): void {
        const { logger, verbose } = this.options;
        if (verbose) logger.info('Initializing decoding process...');
    }

    /**
     * Reads and processes the distribution map from the specified input folder.
     * The distribution map is then stored in the `distributionMap` property of the instance.
     *
     * @return {Promise<void>} A promise that resolves once the map has been read and processed.
     */
    private async readMap(): Promise<void> {
        const { inputFolder, password, logger } = this.options;
        this.distributionMap = await readAndProcessDistributionMap(inputFolder, password, logger);
    }

    /**
     * Extracts encrypted data chunks from the input folder using the distribution map and logger.
     *
     * @return {Promise<void>} A promise that resolves when the extraction process is complete.
     */
    private async extractChunks(): Promise<void> {
        const { inputFolder, logger } = this.options;
        this.encryptedDataChunks = await extractChunks(this.distributionMap!, inputFolder, logger);
    }

    /**
     * Assembles encrypted data chunks into a single Uint8Array.
     * Utilizes the provided logger for logging operations if necessary.
     * Sets the assembled encrypted data to `this.encryptedData` property.
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
     * Verifies the data integrity and decrypts the encrypted data.
     * It uses the provided password and logger to perform the operations.
     *
     * @return {Promise<void>} A promise that resolves when the data has been verified and decrypted.
     */
    private async verifyAndDecryptData(): Promise<void> {
        const { password, logger } = this.options;
        await verifyDataIntegrity(this.encryptedData!, this.distributionMap!.checksum, logger);
        this.decryptedData = await decryptData(
            this.encryptedData!,
            password,
            logger,
            SupportedCryptoStrategies.AES256CBC,
        );
    }

    /**
     * Decompresses the encrypted data using the specified compression strategy.
     * Updates the decompressedData field with the resulting data.
     * Logs a message indicating the completion of the decompression process.
     * @return {void}
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
     * Writes the decompressed data to a specified output file.
     *
     * @return {Promise<void>} A promise that resolves when the file has been successfully written.
     */
    private async writeOutput(): Promise<void> {
        const { outputFolder, logger } = this.options;
        const outputFile = path.join(outputFolder, this.distributionMap!.originalFilename);
        await writeBufferToFile(outputFile, this.decompressedData!);
        logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    }
}
