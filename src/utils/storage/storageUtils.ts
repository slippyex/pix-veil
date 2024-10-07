// src/utils/storage/storageUtils.ts

import { Buffer } from 'node:buffer';
import fs, { exists, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

/**
 * Traverses up the directory hierarchy to find the project root based on marker files.
 *
 * @param {string} startPath - The directory to start searching from.
 * @param {string[]} markerFiles - An array of filenames that signify the project root.
 * @return {Promise<string | null>} - The path to the project root or null if not found.
 */
export function findProjectRoot(
    startPath: string,
    markerFiles: string[] = ['deno.json', 'deno.jsonc', '.git'],
): string | null {
    let currentPath = startPath;
    while (true) {
        for (const marker of markerFiles) {
            const markerPath = join(currentPath, marker);
            if (existsSync(markerPath)) {
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
        '.tar.gz',
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
    // Find the last occurrence of '.' to get the extension
    const lastDotIndex = filename.lastIndexOf('.');

    // If there's no dot, return an empty string (no extension)
    if (lastDotIndex === -1) {
        return '';
    }

    // Return the file extension, including the dot
    return filename.substring(lastDotIndex);
}
