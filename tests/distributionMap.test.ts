// tests/distributionMap.test.ts
import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';

import { IDistributionMapEntry } from '../src/@types/index.ts';
import { createDistributionMap, parseDistributionMap } from '../src/modules/lib/distributionMap/mapUtils.ts';

describe('Distribution Map Serialization', () => {
    it('should serialize and deserialize distribution map correctly', () => {
        const originalFilename = 'file.ext';
        const entries: IDistributionMapEntry[] = [
            {
                chunkId: 1,
                pngFile: 'image1.png',
                startPosition: 0,
                endPosition: 100,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B']
            },
            {
                chunkId: 2,
                pngFile: 'image2.png',
                startPosition: 100,
                endPosition: 200,
                bitsPerChannel: 2,
                channelSequence: ['R', 'G', 'B']
            }
        ];
        const checksum = 'abcdef1234567890';

        const serialized = createDistributionMap(entries, originalFilename, checksum);
        const deserialized = parseDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
    });
});
