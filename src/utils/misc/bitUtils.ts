// src/utils/misc/bitUtils.ts

/**
 * Extracts a specific number of bits from a byte.
 * @param byte - The byte to extract bits from.
 * @param startBit - The starting bit position (0-7).
 * @param bitCount - Number of bits to extract.
 * @returns The extracted bits as a number.
 */
export function extractBits(byte: number, startBit: number, bitCount: number): number {
    const mask = (1 << bitCount) - 1;
    return (byte >> startBit) & mask;
}

/**
 * Inserts bits into a byte at a specific position.
 * @param byte - The original byte.
 * @param bits - The bits to insert.
 * @param startBit - The starting bit position (0-7).
 * @param bitCount - Number of bits to insert.
 * @returns The modified byte with bits inserted.
 */
export function insertBits(byte: number, bits: number, startBit: number, bitCount: number): number {
    const mask = ((1 << bitCount) - 1) << startBit;
    return (byte & ~mask) | ((bits << startBit) & mask);
}
