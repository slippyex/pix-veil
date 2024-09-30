// src/utils/storage/storageUtils.ts

import { Buffer } from 'node:buffer';
import fs from 'node:fs';

/**
 * Ensures that the specified output directory exists. If the directory
 * does not exist, it creates the directory and any necessary subdirectories.
 *
 * @param {string} outputFolder - The path of the output directory to ensure.
 * @return {void}
 */
export function ensureOutputDirectory(outputFolder: string): void {
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }
}

/**
 * Writes a buffer to a file at the specified path.
 *
 * @param {string} filePath - The path of the file where the data will be written.
 * @param {Buffer} data - The buffer containing data to write to the file.
 *
 * @return {void}
 */
export function writeBufferToFile(filePath: string, data: Buffer): void {
    fs.writeFileSync(filePath, data);
}

/**
 * Reads the entire contents of a file into a buffer.
 *
 * @param {string} filePath - The file path of the file to be read.
 * @returns {Buffer} - The contents of the file as a buffer.
 */
export function readBufferFromFile(filePath: string): Buffer {
    return fs.readFileSync(filePath);
}

/**
 * Reads the contents of a directory synchronously.
 *
 * @param {string} filePath - The path of the directory to read.
 * @return {string[]} - An array of filenames in the directory.
 */
export function readDirectory(filePath: string): string[] {
    return fs.readdirSync(filePath);
}

/**
 * Checks if a file or directory exists at the given file path.
 *
 * @param {string} filePath - The path to the file or directory.
 * @return {boolean} Returns true if the file or directory exists, otherwise false.
 */
export function filePathExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}
