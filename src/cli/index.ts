// src/cli/index.ts

import { Command } from 'commander';
import path from 'node:path';
import { encode } from '../core/encoder/index.ts';
import { decode } from '../core/decoder/index.ts';
import { getLogger } from '../utils/logging/logUtils.ts';
import process from 'node:process';
import figlet from 'figlet';
import inquirer from 'inquirer';

const program = new Command();

program
    .name('pix-veil')
    .description('A CLI tool for steganography in PNG images')
    .version('1.3.0')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-dv, --debug-visual', 'Enable debug visual blocks');

program
    .command('encode')
    .description('Encode a file into PNG images')
    .requiredOption('-i, --input <file>', 'Input file to hide')
    .requiredOption('-p, --png-folder <folder>', 'Folder with input PNG files')
    .requiredOption('-o, --output <folder>', 'Output folder to store PNG files')
    .requiredOption('-w, --password', 'Prompt for password')
    .option('--no-verify', 'Skip verification step during encoding') // Added flag
    .showHelpAfterError()
    .action(async (options) => {
        const debugVisual = program.opts().debugVisual || false;
        const verbose = program.opts().verbose || false;

        const inputFile = path.resolve(options.input);
        const inputPngFolder = path.resolve(options.pngFolder);
        const outputFolder = path.resolve(options.output);

        let password: string;
        if (options.password) {
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
                process.exit(1);
            }

            password = answers.password;
        } else {
            console.error('Password is required');
            process.exit(1);
        }

        const logger = getLogger('encoder', verbose);

        try {
            await encode({
                inputFile,
                inputPngFolder,
                outputFolder,
                password,
                verbose,
                debugVisual,
                logger,
                verify: options.verify !== false, // Pass the verify flag
            });
            process.exit(0);
        } catch (error) {
            logger.error(`Encoding failed: ${error}`);
            process.exit(1);
        }
    });

program
    .command('decode')
    .description('Decode a file from PNG images')
    .requiredOption('-i, --input <folder>', 'Input folder with PNG files')
    .requiredOption('-o, --output <folder>', 'Output file path')
    .requiredOption('-w, --password', 'Prompt for password')
    .showHelpAfterError()
    .action(async (options) => {
        const verbose = program.opts().verbose || false;

        const inputFolder = path.resolve(options.input);
        const outputFolder = path.resolve(options.output);

        let password: string;
        if (options.password) {
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

            password = answers.password;
        } else {
            console.error('Password is required');
            process.exit(1);
        }

        const logger = getLogger('decoder', verbose);

        try {
            await decode({
                inputFolder,
                outputFolder,
                password,
                verbose,
                logger,
            });
            process.exit(0);
        } catch (error) {
            logger.error(`Decoding failed: ${error}`);
            process.exit(1);
        }
    });

if (import.meta.main) {
    console.clear();
    console.log(
        figlet.textSync('Pix-Veil', {
            font: 'DOS Rebel',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            width: 80,
            whitespaceBreak: true,
        }),
    );
    console.log(`A tiny steganography tool to hide secret data into existing png files. (c) 2024, slippyex\n`);
    program.parse(process.argv);
}
