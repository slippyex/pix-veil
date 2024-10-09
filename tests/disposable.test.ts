import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import path from 'node:path';

describe.ignore('playground', () => {
    it('should test things', () => {
        const filePath = path.join('test', 'testfile.png');

        const ext = path.extname(filePath);
        const file = path.basename(filePath);
        const fileBase = file.substring(0, file.lastIndexOf('.'));
        expect(ext).toBe('.png');
        expect(file).toBe('testfile.png');
        expect(fileBase).toBe('testfile');
    });
});
