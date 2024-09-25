// tests/mapUtils.test.ts

import { DistributionMapEntry } from '../src/@types/types';
import { createDistributionMap, parseDistributionMap } from '../src/utils/mapUtils';

describe('Distribution Map Serialization', () => {
    it('should serialize and deserialize distribution map correctly', () => {
        const entries: DistributionMapEntry[] = [
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

        const serialized = createDistributionMap(entries, checksum);
        const deserialized = parseDistributionMap(serialized);

        expect(deserialized.entries).toStrictEqual(entries);
        expect(deserialized.checksum).toEqual(checksum);
    });
});
