// src/utils/storage/storageUtils.ts

import { dirname, extname, join } from 'jsr:@std/path';
import { Buffer } from 'node:buffer';

/**
 * Converts a Buffer to Uint8Array.
 *
 * @param {Buffer} buffer - The Buffer to convert.
 * @returns {Uint8Array} - The resulting Uint8Array.
 */
export function bufferToUint8Array(buffer: Buffer): Uint8Array {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Converts a Uint8Array to Buffer.
 *
 * @param {Uint8Array} uint8Array - The Uint8Array to convert.
 * @returns {Buffer} - The resulting Buffer.
 */
export function uint8ArrayToBuffer(uint8Array: Uint8Array): Buffer {
    return Buffer.from(uint8Array);
}

/**
 * Ensures that the specified output directory exists. If the directory
 * does not exist, it creates the directory and any necessary subdirectories.
 *
 * @param {string} outputFolder - The path of the output directory to ensure.
 * @return {void}
 */
export function ensureOutputDirectory(outputFolder: string): void {
    Deno.mkdirSync(outputFolder, { recursive: true });
}

/**
 * Writes a buffer to a file at the specified path.
 *
 * @param {string} filePath - The path of the file where the data will be written.
 * @param {Buffer | Uint8Array} data - The buffer containing data to write to the file.
 *
 * @return {void}
 */
export function writeBufferToFile(filePath: string, data: Buffer): void {
    Deno.writeFileSync(filePath, bufferToUint8Array(data));
}

/**
 * Reads the entire contents of a file into a buffer.
 *
 * @param {string} filePath - The file path of the file to be read.
 * @returns {Buffer | Uint8Array} - The contents of the file as a Buffer or Uint8Array.
 */
export function readBufferFromFile(filePath: string): Buffer {
    const data = Deno.readFileSync(filePath);
    return uint8ArrayToBuffer(data);
}

/**
 * Reads the contents of a directory synchronously.
 *
 * @param {string} dirPath - The path of the directory to read.
 * @return {string[]} - An array of filenames in the directory.
 */
export function readDirectory(dirPath: string): string[] {
    const entries = Deno.readDirSync(dirPath);
    const names: string[] = [];
    for (const entry of entries) {
        names.push(entry.name);
    }
    return names;
}

/**
 * Checks if a file or directory exists at the given file path.
 *
 * @param {string} filePath - The path to the file or directory.
 * @return {boolean} Returns true if the file or directory exists, otherwise false.
 */
export function filePathExists(filePath: string): boolean {
    try {
        Deno.statSync(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error; // Re-throw if it's a different error
    }
}

/**
 * Traverses up the directory hierarchy to find the project root based on marker files.
 *
 * @param {string} startPath - The directory to start searching from.
 * @param {string[]} markerFiles - An array of filenames that signify the project root.
 * @return {string | null} - The path to the project root or null if not found.
 */
export function findProjectRoot(
    startPath: string,
    markerFiles: string[] = ['deno.json', 'deno.jsonc', '.git'],
): string | null {
    let currentPath = startPath;
    while (true) {
        for (const marker of markerFiles) {
            const markerPath = join(currentPath, marker);
            if (filePathExists(markerPath)) {
                return currentPath;
            }
        }
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            return null; // Reached filesystem root without finding a marker
        }
        currentPath = parentPath;
    }
}

/**
 * Checks if the given filename has an extension that indicates it is a compressed file.
 *
 * @param {string} filename - The name of the file to check.
 * @return {boolean} Returns true if the filename has a compressed file extension, otherwise false.
 */
export function isCompressed(filename: string): boolean {
    // Define common compressed file extensions
    const compressedExtensions = [
        '.zip',
        '.tar',
        '.gz',
        '.rar',
        '.7z',
        '.bz2',
        '.xz',
        '.tgz',
        '.zst',
        '.lz',
        '.lz4',
        '.cab',
    ];

    // Extract the file extension from the filename
    const fileExtension = getFileExtension(filename);

    // Check if the file extension is in the list of compressed formats
    return compressedExtensions.includes(fileExtension.toLowerCase());
}

/**
 * Extracts and returns the file extension from a given filename.
 *
 * @param {string} filename - The name of the file from which to extract the extension.
 * @return {string} The extension of the file, including the dot (e.g., ".txt").
 * If no extension is found, an empty string is returned.
 */
function getFileExtension(filename: string): string {
    return extname(filename);
}
