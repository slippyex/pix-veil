import { expect } from 'jsr:@std/expect';

import { findProjectRoot, isCompressed } from '../src/utils/storage/storageUtils.ts';
import * as path from 'jsr:@std/path';

const markerFiles = ['deno.json', 'package.json', '.git'];

Deno.test('should return true for compressed file extensions', () => {
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

Deno.test('should return false for uncompressed file extensions', () => {
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

Deno.test('should handle files without extensions', () => {
    expect(isCompressed('README')).toBe(false);
    expect(isCompressed('.gitignore')).toBe(false);
});


Deno.test('should find the project root based on marker files', () => {
    const tempFolder = Deno.makeTempDirSync();
    const startPath = path.join(tempFolder, 'src');
    Deno.mkdirSync(startPath, { recursive: true });
    Deno.writeTextFileSync(path.join(tempFolder, 'package.json'), '{}');
    const foundRoot = findProjectRoot(startPath, markerFiles);
    expect(foundRoot).toBe(tempFolder);
});

Deno.test('should return null if no marker file is found', () => {
    const nonProjectPath = Deno.makeTempDirSync();

    const foundRoot = findProjectRoot(nonProjectPath, ['blerch']);
    expect(foundRoot).toBeNull();
});

Deno.test('should prioritize the nearest marker file in the hierarchy', () => {
    const tempFolder = Deno.makeTempDirSync();
    const nestedPath = path.join(tempFolder, 'src', 'lib', 'utils');
    Deno.mkdirSync(nestedPath, { recursive: true });

    // Add a marker file in a subdirectory
    Deno.writeTextFileSync(path.join(tempFolder, 'src', 'lib', 'utils', 'package.json'), '{}');

    const foundRoot = findProjectRoot(nestedPath, ['package.json']);
    expect(foundRoot).toBe(path.join(tempFolder, 'src', 'lib', 'utils'));
});
