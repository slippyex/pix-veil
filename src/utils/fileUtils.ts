// src/utils/fileUtils.ts
import fs from 'fs';
import path from 'path';

/**
 * Reads a file asynchronously and returns its content as a Buffer.
 * @param filePath Path to the file.
 */
export const readFileAsync = (filePath: string): Promise<Buffer> => {
    return fs.promises.readFile(filePath);
};

/**
 * Writes a Buffer to a file asynchronously.
 * @param filePath Path to the file.
 * @param data Data to write.
 */
export const writeFileAsync = (filePath: string, data: Buffer): Promise<void> => {
    return fs.promises.writeFile(filePath, data);
};

/**
 * Retrieves all PNG files from a directory recursively.
 * @param dir Directory path.
 * @returns Array of PNG file paths.
 */
export const getPngFiles = async (dir: string): Promise<string[]> => {
    let files: string[] = [];
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            const nestedFiles = await getPngFiles(fullPath);
            files = files.concat(nestedFiles);
        } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.png') {
            files.push(fullPath);
        }
    }
    return files;
};

/**
 * Ensures that a directory exists; creates it if it doesn't.
 * @param dirPath Path to the directory.
 */
export const ensureDirectory = async (dirPath: string): Promise<void> => {
    await fs.promises.mkdir(dirPath, { recursive: true });
};
