import { afterAll, beforeAll, describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { findProjectRoot, isCompressed } from '../src/utils/storage/storageUtils.ts';
import path from 'node:path';
import fs from 'node:fs';

describe('Utility Functions', () => {
    describe('isCompressed', () => {
        it('should return true for compressed file extensions', () => {
            const compressedFiles = [
                'archive.zip',
                'backup.tar',
                'image.gz',
                'document.rar',
                'package.7z',
                'data.bz2',
                'bundle.xz',
                'archive.tgz',
                'snapshot.zst',
                'file.lz',
                'log.lz4',
                'setup.cab',
            ];

            compressedFiles.forEach((filename) => {
                expect(isCompressed(filename)).toBe(true);
            });
        });

        it('should return false for uncompressed file extensions', () => {
            const uncompressedFiles = [
                'document.txt',
                'image.png',
                'video.mp4',
                'audio.mp3',
                'script.js',
                'style.css',
                'data.json',
            ];

            uncompressedFiles.forEach((filename) => {
                expect(isCompressed(filename)).toBe(false);
            });
        });

        it('should handle files without extensions', () => {
            expect(isCompressed('README')).toBe(false);
            expect(isCompressed('.gitignore')).toBe(false);
        });
    });

    describe('findProjectRoot', () => {
        const tempFolder = path.join(Deno.cwd(), 'temp_project_root');
        const markerFiles = ['deno.json', 'package.json', '.git'];

        beforeAll(() => {
            // Setup: Create a temporary project structure
            fs.mkdirSync(tempFolder, { recursive: true });
            markerFiles.forEach((file) => {
                fs.writeFileSync(path.join(tempFolder, file), '{}');
            });
            fs.mkdirSync(path.join(tempFolder, 'src'), { recursive: true });
        });

        afterAll(() => {
            // Cleanup: Remove the temporary project structure
            fs.rmSync(tempFolder, { recursive: true, force: true });
        });

        it('should find the project root based on marker files', () => {
            const startPath = path.join(tempFolder, 'src');
            const foundRoot = findProjectRoot(startPath, markerFiles);
            expect(foundRoot).toBe(tempFolder);
        });

        it('should return null if no marker file is found', () => {
            const nonProjectPath = path.join(Deno.cwd(), 'non_project');
            fs.mkdirSync(nonProjectPath, { recursive: true });

            const foundRoot = findProjectRoot(nonProjectPath, ['blerch']);
            expect(foundRoot).toBeNull();

            fs.rmSync(nonProjectPath, { recursive: true, force: true });
        });

        it('should prioritize the nearest marker file in the hierarchy', () => {
            const nestedPath = path.join(tempFolder, 'src', 'lib', 'utils');
            fs.mkdirSync(nestedPath, { recursive: true });

            // Add a marker file in a subdirectory
            fs.writeFileSync(path.join(tempFolder, 'src', 'lib', 'utils', 'package.json'), '{}');

            const foundRoot = findProjectRoot(nestedPath, ['package.json']);
            expect(foundRoot).toBe(path.join(tempFolder, 'src', 'lib', 'utils'));
        });
    });
});
