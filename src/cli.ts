// src/cli.ts

import { encode } from './encoder/encode';
import { decode } from './decoder/decode';
import { program } from 'commander';
import path from 'path';

program
    .name('stego-cli')
    .description('A CLI tool for steganography using PNG images.')
    .version('1.0.0');

program
    .command('encode')
    .description('Encode a secret file into PNG images.')
    .requiredOption('-f, --file <path>', 'Path to the secret file to encode.')
    .requiredOption('-i, --images <directory>', 'Directory containing PNG images for encoding.')
    .requiredOption('-o, --output <directory>', 'Output directory for encoded images.')
    .requiredOption('-p, --password <password>', 'Password for encryption.')
    .action(async (options) => {
        const inputFile = path.resolve(options.file);
        const inputImagesDir = path.resolve(options.images);
        const outputDir = path.resolve(options.output);
        const password = options.password;

        try {
            await encode({ inputFile, inputImagesDir, outputDir, password });
            console.log('Encoding completed successfully.');
        } catch (error) {
            console.error('Encoding failed:', error);
        }
    });

program
    .command('decode')
    .description('Decode a secret file from PNG images.')
    .requiredOption('-i, --images <directory>', 'Directory containing encoded PNG images.')
    .requiredOption('-o, --output <path>', 'Output path for the decoded secret file.')
    .requiredOption('-p, --password <password>', 'Password for decryption.')
    .action(async (options) => {
        const inputImagesDir = path.resolve(options.images);
        const outputFile = path.resolve(options.output);
        const password = options.password;

        try {
            await decode({ inputImagesDir, outputFile, password });
            console.log('Decoding completed successfully.');
        } catch (error) {
            console.error('Decoding failed:', error);
        }
    });

program.parse(process.argv);
