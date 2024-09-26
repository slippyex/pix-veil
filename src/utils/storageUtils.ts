// src/utils/storageUtils.ts

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
