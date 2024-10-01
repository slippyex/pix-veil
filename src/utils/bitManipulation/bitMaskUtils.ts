// src/utils/bitManipulation/bitmaskUtils.ts

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
 * Clears the bit at the specified bit index in the given bitmask.
 *
 * @param {Uint8Array} bitmask - The bitmask array where the bit will be cleared.
 * @param {number} bitIndex - The index of the bit to clear.
 *
 * @return {void}
 */
export function clearBit(bitmask: Uint8Array, bitIndex: number): void {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = bitIndex % 8;
    bitmask[byteIndex] &= ~(1 << bitPosition);
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

/**
 * Resets all bits in the given bitmask to 0.
 *
 * @param {Uint8Array} bitmask - The bitmask to be reset.
 * @return {void}
 */
export function resetBitmask(bitmask: Uint8Array): void {
    bitmask.fill(0);
}
