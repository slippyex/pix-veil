// src/core/decoder/stateMachine.ts

import type { IChunk, IDecodeOptions, IDistributionMap } from '../../@types/index.ts';
import * as path from 'jsr:@std/path';
import { Buffer } from 'node:buffer';
import { writeBufferToFile } from '../../utils/storage/storageUtils.ts';
import { readAndProcessDistributionMap } from '../distributionMap/mapUtils.ts';
import { assembleChunks, extractChunks } from '../lib/extraction.ts';
import { decryptData, verifyDataIntegrity } from '../../utils/cryptography/crypto.ts';
import { decompressBuffer } from '../../utils/compression/compression.ts';
import { SupportedCompressionStrategies } from '../../@types/index.ts';

type StateHandler = () => Promise<void> | void;

interface StateTransition {
    state: string;
    handler: StateHandler;
}

export class DecodeStateMachine {
    private state: string = 'INIT';
    private readonly options: IDecodeOptions;
    private distributionMap: IDistributionMap = {
        entries: [],
        compressionStrategy: SupportedCompressionStrategies.Brotli,
        checksum: '',
        originalFilename: '',
        encryptedDataLength: 0,
    };
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
     * Executes the decoding process in a state-driven flow.
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

    private init(): void {
        const { logger, verbose } = this.options;
        if (verbose) logger.info('Initializing decoding process...');
    }

    private async readMap(): Promise<void> {
        const { inputFolder, password, logger } = this.options;
        this.distributionMap = await readAndProcessDistributionMap(
            inputFolder,
            password,
            logger,
        );
    }

    private async extractChunks(): Promise<void> {
        const { inputFolder, logger } = this.options;
        this.encryptedDataChunks = await extractChunks(this.distributionMap, inputFolder, logger);
    }

    private assembleData(): void {
        const { logger } = this.options;
        this.encryptedData = assembleChunks(this.encryptedDataChunks, logger).subarray(
            0,
            this.distributionMap.encryptedDataLength,
        );
    }

    private async verifyAndDecryptData(): Promise<void> {
        const { password, logger } = this.options;
        await verifyDataIntegrity(this.encryptedData!, this.distributionMap.checksum, logger);
        this.decryptedData = await decryptData(this.encryptedData!, password, logger);
    }

    private decompressData(): void {
        const { logger } = this.options;
        if (this.distributionMap.compressionStrategy !== SupportedCompressionStrategies.None) {
            this.decompressedData = decompressBuffer(
                this.decryptedData!,
                this.distributionMap.compressionStrategy,
            );
            logger.info('Data decompressed successfully.');
        } else {
            this.decompressedData = this.decryptedData!;
            logger.info('No compression applied. Using decrypted data as-is.');
        }
    }

    private async writeOutput(): Promise<void> {
        const { outputFolder, logger } = this.options;
        const outputFile = path.join(outputFolder, this.distributionMap.originalFilename);
        await writeBufferToFile(outputFile, this.decompressedData!);
        logger.info(`Decoding completed successfully. Output file saved at "${outputFile}".`);
    }

    private transitionTo(nextState: string, error?: Error): void {
        if (error) {
            this.options.logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = 'ERROR';
        } else {
            this.options.logger.debug(`Transitioning from "${this.state}" to "${nextState}"`);
            this.state = nextState;
        }
    }

    private handleError(error: Error): void {
        this.options.logger.error(`Decoding failed: ${error.message}`);
        throw error;
    }
}
