// src/cli/index.ts

import { Command } from 'commander';
import path from 'node:path';
import { encode } from '../core/encoder/index.ts';
import { decode } from '../core/decoder/index.ts';
import { getLogger } from '../utils/logging/logUtils.ts';
import process from 'node:process';
import figlet from 'figlet';

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
    .requiredOption('-w, --password <password>', 'Password for encryption')
    .action(async (options) => {
        const debugVisual = program.opts().debugVisual || false;
        const verbose = program.opts().verbose || false;

        const inputFile = path.resolve(options.input);
        const inputPngFolder = path.resolve(options.pngFolder);
        const outputFolder = path.resolve(options.output);
        const password = options.password;

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
            });
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
    .requiredOption('-w, --password <password>', 'Password for decryption')
    .action(async (options) => {
        const verbose = program.opts().verbose || false;

        const inputFolder = path.resolve(options.input);
        const outputFolder = path.resolve(options.output);
        const password = options.password;

        const logger = getLogger('decoder', verbose);

        try {
            await decode({
                inputFolder,
                outputFolder,
                password,
                verbose,
                logger,
            });
        } catch (error) {
            logger.error(`Decoding failed: ${error}`);
            process.exit(1);
        }
    });

(() => {
    console.log(
        figlet.textSync("Pix-Veil", {
            font: "DOS Rebel",
            horizontalLayout: "default",
            verticalLayout: "default",
            width: 80,
            whitespaceBreak: true,
        })
    );
    program.parse(process.argv);
})();
