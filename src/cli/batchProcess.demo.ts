// src/cli/batchProcess.demo.ts

import { encode } from '../core/encoder/index.ts';
import { decode } from '../core/decoder/index.ts';
import { getLogger } from '../utils/logging/logUtils.ts';
import fs from 'node:fs/promises';
import * as path from 'jsr:@std/path';
import process from 'node:process';

import cliProgress from 'cli-progress';
import figlet from "figlet";
import {ILogger} from "../@types/index.ts";

/**
 * Interface representing a report entry for each file processed.
 */
interface ReportEntry {
    file: string;
    status: 'success' | 'failed';
    reason?: string;
}

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

/**
 * Executes a batch processing workflow for encoding and decoding files,
 * handling failures, and recording processing results in a report.
 *
 * @return {Promise<void>} Resolves when the batch processing is complete.
 */
async function batchProcess(): Promise<void> {
    const logger = getLogger('testbatch', false);
    // Configuration Constants
    const inputDir = path.resolve(__dirname, '../../tests/test_input/files'); // Directory containing files to process
    const inputPngFolder = path.resolve(__dirname, '../../tests/test_input/images'); // Directory containing PNG images

    const decodedFolder = path.resolve(__dirname, '../../tests/test_output/decoded'); // Output directory for decoded files
    const failedFolder = path.resolve(__dirname, '../../tests/test_input/failed'); // Directory to store failed files
    const successFolder = path.resolve(__dirname, '../../tests/test_input/success'); // Directory to store succeeded files
    const reportPath = path.resolve(__dirname, '../../tests/test_input/failedReport.json'); // Path for the report file

    // Initialize Logger


    // Prompt for Password Securely
    const password = 'testpassword'

    // Ensure Output Directories Exist
    await ensureDirectory(decodedFolder);
    await ensureDirectory(failedFolder);
    await ensureDirectory(successFolder);

    // Read All Files from Input Directory
    let files: string[] = [];
    try {
        files = await fs.readdir(inputDir);
        console.log(`Found ${files.length} files in input directory.`);
    } catch (err) {
        console.error(`Failed to read input directory "${inputDir}": ${(err as Error).message}`);
        process.exit(1);
    }

    if (files.length === 0) {
        console.warn('No files found to process. Exiting.');
        process.exit(0);
    }

    // Initialize Report
    const report: ReportEntry[] = [];

    // Initialize Progress Bar
    const progressBar = new cliProgress.SingleBar({
        format: 'Processing |{bar}| {percentage}% || {value}/{total} Files',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    progressBar.start(files.length, 0);

    // Process Each File Sequentially
    for (const file of files) {
        const encodedFolder = path.join(path.resolve(__dirname, '../../tests/test_output/encoded'), file); // Output directory for encoded PNGs
        await ensureDirectory(encodedFolder);

        const filePath = path.join(inputDir, file);
        const decodedFilePath = path.join(decodedFolder, file);

        try {
            // Encode the File
            await encode({
                inputFile: filePath,
                inputPngFolder,
                outputFolder: encodedFolder,
                password,
                verbose: true,
                debugVisual: false,
                logger
            });

            // Decode the File
            await decode({
                inputFolder: encodedFolder,
                outputFolder: decodedFolder,
                password,
                verbose: false,
                logger,
            });

            // Compare Original and Decoded Files
            const originalBuffer = await fs.readFile(filePath);
            const decodedBuffer = await fs.readFile(decodedFilePath);

            if (originalBuffer.equals(decodedBuffer)) {
                const fileName = path.basename(filePath);
                const destination = path.join(successFolder, fileName);
                await fs.rename(filePath, destination);
            } else {
                const reason = 'Decoded file does not match the original.';
                await handleFailure(filePath, failedFolder);
                report.push({ file, status: 'failed', reason });
            }
        } catch (error) {
            const reason = (error as Error).message;
            await handleFailure(filePath, failedFolder);
            report.push({ file, status: 'failed', reason });
        }

        // Clean Output Folders After Each Iteration
        try {
//            await cleanDirectory(encodedFolder, logger);
            await cleanDirectory(decodedFolder);
        } catch (cleanupError) {
            logger.error(`Failed to clean output folders after processing "${file}": ${(cleanupError as Error).message}`);
        }

        // Update Progress Bar
        progressBar.increment();
        await writeReport(reportPath, report, logger);
    }

    // Stop Progress Bar
    progressBar.stop();

    await writeReport(reportPath, report, logger);
}

/**
 * Writes a report to a specified file path in JSON format.
 *
 * @param {string} reportPath - The file path where the report will be saved.
 * @param {ReportEntry[]} report - The array of report entries to be written to the file.
 * @param {ILogger} logger - The logger instance used to log success or error messages.
 *
 * @return {Promise<void>} A promise that resolves when the report is successfully written.
 */
async function writeReport(reportPath: string, report: ReportEntry[], logger: ILogger): Promise<void> {
    // Save Report
    try {
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    //    logger.success(`Report saved at "${reportPath}".`);
    } catch (err) {
        logger.error(`Failed to write report: ${(err as Error).message}`);
    }
}

/**
 * Ensures that a directory exists at the specified path. If the directory does
 * not exist, it is created along with any necessary parent directories.
 *
 * @param {string} dirPath - The path to the directory that needs to be ensured.
 * @return {Promise<void>} A promise that resolves when the directory has been ensured.
 */
async function ensureDirectory(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (_err) {
        process.exit(1);
    }
}

/**
 * Handles the failure of file processing by moving the file to a specified failed directory.
 *
 * @param {string} filePath - The path of the file that failed to process.
 * @param {string} failedDir - The directory where the failed file should be moved.
 * @return {Promise<void>} A promise that resolves when the file has been moved to the failed directory, or logs an error if the operation fails.
 */
async function handleFailure(filePath: string, failedDir: string): Promise<void> {
    try {
        const fileName = path.basename(filePath);
        const destination = path.join(failedDir, fileName);
        await fs.rename(filePath, destination);
        //await fs.copyFile(filePath, destination);
    } catch (_err) {
        console.error(`Failed to move file "${filePath}" to failed directory: ${(_err as Error).message}`);
    }
}

/**
 * Recursively deletes all files and subdirectories within the given directory.
 *
 * @param {string} dirPath - The path of the directory to clean.
 * @return {Promise<void>} A promise that resolves when the directory has been cleaned.
 */
async function cleanDirectory(dirPath: string): Promise<void> {
    try {
        const files = await fs.readdir(dirPath);
        const deletePromises = files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const stat = await fs.lstat(filePath);

            if (stat.isDirectory()) {
                await cleanDirectory(filePath); // Recursively clean subdirectories
                await fs.rmdir(filePath);
            } else {
                await fs.unlink(filePath);
            }
        });

        await Promise.all(deletePromises);
    } catch (err) {
        console.error(`Failed to clean directory "${dirPath}": ${(err as Error).message}`);
        throw err; // Rethrow to allow handling in the caller
    }
}

if (import.meta.main) {
    (async () => {
        console.clear();
        try {
            await batchProcess();
        } catch (err) {
            console.error(`Unhandled error in batchProcess: ${(err as Error).message}`);
            process.exit(1);
        }
    })();
}
