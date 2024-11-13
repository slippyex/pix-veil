// tests/bitManipulation.test.ts

import { expect } from 'jsr:@std/expect';

import { extractBits, insertBits, isBitSet, setBit } from '../src/utils/bitManipulation/bitUtils.ts';

Deno.test('Bit manipulation Utilities', async (t) => {
    await t.step('extractBits', async (t) => {
        await t.step('should extract correct bits', () => {
            const byte = 0b10101100; // 172
            expect(extractBits(byte, 0, 4)).toBe(0b1100); // 12
            expect(extractBits(byte, 4, 4)).toBe(0b1010); // 10
            expect(extractBits(byte, 2, 3)).toBe(0b011); // 3 (Corrected from 0b101)
        });
    });

    await t.step('insertBits', async (t) => {
        await t.step('should insert bits correctly', () => {
            const byte = 0b00000000;
            const bitsToInsert = 0b101;
            const result = insertBits(byte, bitsToInsert, 2, 3); // Insert 3 bits at position 2
            expect(result).toBe(0b0010100); // 20
        });

        await t.step('should overwrite existing bits', () => {
            const byte = 0b11111111;
            const bitsToInsert = 0b000;
            const result = insertBits(byte, bitsToInsert, 4, 3); // Insert 3 bits at position 4
            expect(result).toBe(0b10001111); // 143 (Corrected from 0b11100011)
        });

        await t.step('should handle inserting bits at the boundaries', () => {
            const byte = 0b00000000;
            const bitsToInsertStart = 0b11;
            const bitsToInsertEnd = 0b11;
            const resultStart = insertBits(byte, bitsToInsertStart, 0, 2);
            const resultEnd = insertBits(byte, bitsToInsertEnd, 6, 2);
            expect(resultStart).toBe(0b00000011); // 3
            expect(resultEnd).toBe(0b11000000); // 192
        });
    });
    await t.step('setBit and isBitSet', async (t) => {
        await t.step('should set and check bits correctly', () => {
            const bitmask = new Uint8Array(1); // 8 bits
            setBit(bitmask, 0); // Set first bit
            setBit(bitmask, 3); // Set fourth bit
            setBit(bitmask, 7); // Set eighth bit

            expect(isBitSet(bitmask, 0)).toBe(true);
            expect(isBitSet(bitmask, 1)).toBe(false);
            expect(isBitSet(bitmask, 3)).toBe(true);
            expect(isBitSet(bitmask, 7)).toBe(true);
        });

        await t.step('should handle multiple bytes', () => {
            const bitmask = new Uint8Array(2); // 16 bits
            setBit(bitmask, 8); // First bit of second byte
            setBit(bitmask, 15); // Last bit of second byte

            expect(isBitSet(bitmask, 0)).toBe(false);
            expect(isBitSet(bitmask, 8)).toBe(true);
            expect(isBitSet(bitmask, 15)).toBe(true);
        });

        await t.step('should return false for unset bits', () => {
            const bitmask = new Uint8Array(1);
            expect(isBitSet(bitmask, 4)).toBe(false);
        });
    });
});
