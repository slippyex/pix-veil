// src/utils/misc/storageUtils.ts

import fs from 'fs';

/**
 * Ensures that the output directory exists; if not, creates it.
 * @param outputFolder - Path to the output directory.
 */
export function ensureOutputDirectory(outputFolder: string): void {
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }
}

/**
 * Writes a buffer to a specified file path.
 * @param filePath - The path to the file.
 * @param data - The data buffer to write.
 */
export function writeBufferToFile(filePath: string, data: Buffer): void {
    fs.writeFileSync(filePath, data);
}

/**
 * Reads a buffer from a specified file path.
 * @param filePath - The path to the file.
 * @returns The data buffer read from the file.
 */
export function readBufferFromFile(filePath: string): Buffer {
    return fs.readFileSync(filePath);
}

/**
 * Reads the contents of a directory synchronously.
 *
 * @param filePath - The path to the directory to read.
 * @return An array of strings representing the files and directories within the specified directory.
 */
export function readDirectory(filePath: string): string[] {
    return fs.readdirSync(filePath);
}

/**
 * Checks if the specified file path exists in the file system.
 *
 * @param filePath - The path of the file to check.
 * @return {boolean} True if the file path exists, false otherwise.
 */
export function filePathExists(filePath: string) {
    return fs.existsSync(filePath);
}
