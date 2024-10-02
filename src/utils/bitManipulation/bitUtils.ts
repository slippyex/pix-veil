// src/utils/bitManipulation/bitUtils.ts

/**
 * Extracts a specific number of bits from a given byte, starting from a specified bit position.
 *
 * @param {number} byte - The byte from which bits are to be extracted.
 * @param {number} startBit - The starting bit position for extraction.
 * @param {number} bitCount - The number of bits to be extracted.
 * @return {number} - The extracted bits as a number.
 */
export function extractBits(byte: number, startBit: number, bitCount: number): number {
    const mask = (1 << bitCount) - 1;
    return (byte >> startBit) & mask;
}

/**
 * Inserts a specified number of bits into a given byte at a specified starting position.
 *
 * @param {number} byte - The original byte where bits will be inserted.
 * @param {number} bits - The bits to insert into the original byte.
 * @param {number} startBit - The starting position (0-indexed) within the byte to insert the bits.
 * @param {number} bitCount - The number of bits to insert.
 * @return {number} - The byte resulting from inserting the specified bits at the given position.
 */
export function insertBits(byte: number, bits: number, startBit: number, bitCount: number): number {
    const mask = ((1 << bitCount) - 1) << startBit;
    return (byte & ~mask) | ((bits << startBit) & mask);
}

/**
 * Sets the specified bit in the bitmask.
 *
 * @param {Uint8Array} bitmask - The bitmask to modify.
 * @param {number} bitIndex - The index of the bit to set.
 * @return {void}
 */
export function setBit(bitmask: Uint8Array, bitIndex: number): void {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = bitIndex % 8;
    bitmask[byteIndex] |= 1 << bitPosition;
}

/**
 * Checks if a specific bit is set in a given bitmask.
 *
 * @param {Uint8Array} bitmask - The bitmask to check.
 * @param {number} bitIndex - The index of the bit to check.
 * @return {boolean} True if the bit at the given index is set, otherwise false.
 */
export function isBitSet(bitmask: Uint8Array, bitIndex: number): boolean {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = bitIndex % 8;
    return (bitmask[byteIndex] & (1 << bitPosition)) !== 0;
}
