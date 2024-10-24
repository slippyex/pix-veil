// src/cli/index.ts
import { Command } from 'commander';
import * as path from 'jsr:/@std/path';
import { encode } from '../core/encoder/index.ts';
import { decode } from '../core/decoder/index.ts';
import { getLogger, NoopLogFacility } from '../utils/logging/logUtils.ts';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { config } from '../config/index.ts';
import { rainbow } from 'gradient-string';
import cliProgress from 'cli-progress';
import { DecoderStates, EncoderStates } from '../stateMachine/definedStates.ts';
import type { IProgressBar } from '../@types/index.ts';
import { findProjectRoot } from '../utils/storage/storageUtils.ts';

let progressBar: IProgressBar;

const { version, author } = getProjectDetails();

const program = new Command();
program
    .name('pix-veil')
    .description('A CLI tool for steganography in PNG images')
    .version(version);

program
    .command('encode')
    .description('Encode a file into PNG images')
    .requiredOption('-i, --input <file>', 'Input file to hide')
    .requiredOption('-p, --png-folder <folder>', 'Folder with input PNG files')
    .requiredOption('-o, --output <folder>', 'Output folder to store PNG files')
    .option('-l, --log', 'Enable logging')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-dv, --debug-visual', 'Enable debug visual blocks')
    .option('--max-chunks-per-png <number>', 'Maximum number of chunks per PNG (Default: 16)', parseInt)
    .option('--max-chunk-size <number>', 'Maximum size of each chunk in bytes (Default: 4096)', parseInt)
    .option('--min-chunk-size <number>', 'Minimum size of each chunk in bytes (minimum 16, Default: 16)', parseInt)
    .option('--no-verify', 'Skip verification step during encoding')
    .showHelpAfterError()
    .action(async (options) => {
        const debugVisual = options.debugVisual || false;
        const verbose = options.verbose || false;
        const isLogging = options.log || false;

        const inputFile = path.resolve(options.input);
        const inputPngFolder = path.resolve(options.pngFolder);
        const outputFolder = path.resolve(options.output);

        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'password',
                message: 'Enter password:',
                mask: '*',
                validate: (value) => {
                    if (value.length === 0) {
                        return 'Password cannot be empty';
                    }
                    return true;
                },
            },
            {
                type: 'password',
                name: 'confirmPassword',
                message: 'Confirm password:',
                mask: '*',
                validate: (value) => {
                    if (value.length === 0) {
                        return 'Password cannot be empty';
                    }
                    return true;
                },
            },
        ]);
        if (answers.password !== answers.confirmPassword) {
            console.error('Passwords do not match. Please try again.');
            Deno.exit(1);
        }

        const password = answers.password;

        // Retrieve and Validate Chunk Parameters
        const maxChunksPerPng = options.maxChunksPerPng !== undefined
            ? options.maxChunksPerPng
            : config.chunksDefinition.maxChunksPerPng;
        const maxChunkSize = options.maxChunkSize !== undefined
            ? options.maxChunkSize
            : config.chunksDefinition.maxChunkSize;
        const minChunkSize = options.minChunkSize !== undefined
            ? options.minChunkSize
            : config.chunksDefinition.minChunkSize;

        // Enforce minimum chunk size of 16 bytes
        if (minChunkSize < 16) {
            console.error('minChunkSize cannot be less than 16 bytes.');
            Deno.exit(1);
        }

        config.chunksDefinition = {
            ...config.chunksDefinition,
            maxChunksPerPng,
            maxChunkSize,
            minChunkSize,
        };

        const logger = getLogger('encoder', isLogging ? console : NoopLogFacility, verbose);
        if (!isLogging) {
            const steps = (Object.keys(EncoderStates).length - 1) +
                (options.verify ? Object.keys(DecoderStates).length - 1 : 0);
            progressBar = initializeProgressBar(steps);
        }
        try {
            await encode({
                inputFile,
                inputPngFolder,
                outputFolder,
                password,
                verbose,
                debugVisual,
                logger,
                verify: options.verify !== false,
                progressBar,
            });
            progressBar.stop();
            Deno.exit(0);
        } catch (error) {
            logger.error(`Encoding failed: ${error}`);
            Deno.exit(1);
        }
    });

program
    .command('decode')
    .description('Decode a file from PNG images')
    .requiredOption('-i, --input <folder>', 'Input folder with PNG files')
    .requiredOption('-o, --output <folder>', 'Output file path')
    .option('-l, --log', 'Enable logging')
    .option('-v, --verbose', 'Enable verbose logging')
    .showHelpAfterError()
    .action(async (options) => {
        const verbose = options.parent?.verbose || false;
        const isLogging = options.log || false;
        const inputFolder = path.resolve(options.input);
        const outputFolder = path.resolve(options.output);

        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'password',
                message: 'Enter password:',
                mask: '*',
                validate: (value) => {
                    if (value.length === 0) {
                        return 'Password cannot be empty';
                    }
                    return true;
                },
            },
        ]);

        const password = answers.password;
        const logger = getLogger('decoder', console, verbose);
        if (!isLogging) {
            progressBar = initializeProgressBar(Object.keys(DecoderStates).length - 1);
        }
        try {
            await decode({
                inputFolder,
                outputFolder,
                password,
                verbose,
                logger,
                progressBar,
            });
            Deno.exit(0);
        } catch (error) {
            logger.error(`Decoding failed: ${error}`);
            Deno.exit(1);
        }
    });

if (import.meta.main) {
    console.clear();
    console.log(rainbow.multiline(
        figlet.textSync('Pix-Veil', {
            font: 'Roman',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            width: 80,
            whitespaceBreak: true,
        }),
    ));
    console.log(
        rainbow(`A steganography tool to hide secret data into existing png files. v${version} (c) 2024, ${author}\n`),
    );
    await program.parseAsync(['deno', 'src/cli/index.ts', ...Deno.args]);
}

/**
 * Initializes a CLI progress bar with a specified number of steps.
 * The progress bar displays the percentage completed, the current
 * step of the total steps, and a custom state message.
 *
 * @param {number} steps - The total number of steps for the progress bar.
 *
 * @return {Object} The initialized progress bar instance.
 */
function initializeProgressBar(steps: number): IProgressBar {
    const progressBar = new cliProgress.Bar({
        format: 'Processing |{bar}| {percentage}% || {value}/{total} state: {state}',
        hideCursor: true,
    }, cliProgress.Presets.shades_grey);
    progressBar.start(steps, 0, { state: 'START' });
    return progressBar;
}

/**
 * Retrieves the version of the project from the deno.json file.
 *
 * @return {string} The version of the project specified in the deno.json file.
 */
function getProjectDetails(): { version: string; author: string } {
    const root = findProjectRoot('./') as string;
    return JSON.parse(Deno.readTextFileSync(path.join(root, 'deno.json'))) as { version: string; author: string };
}
