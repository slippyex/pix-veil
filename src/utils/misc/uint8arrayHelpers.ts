// src/utils/misc/uint8arrayHelpers.ts

/**
 * Compares two Uint8Array objects lexicographically.
 *
 * @param {Uint8Array} arr1 - The first Uint8Array to compare.
 * @param {Uint8Array} arr2 - The second Uint8Array to compare.
 * @return {number} - Returns 0 if the arrays are equal, -1 if arr1 is lexicographically smaller than arr2, and 1 if arr1 is lexicographically greater than arr2.
 */
export function compareUint8ArraysLex(arr1: Uint8Array, arr2: Uint8Array): number {
    const len = arr1.length < arr2.length ? arr1.length : arr2.length; // Minimum length

    for (let i = 0; i < len; i++) {
        const diff = arr1[i] - arr2[i];
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }

    // If all compared elements are equal, compare lengths
    return arr1.length === arr2.length ? 0 : (arr1.length > arr2.length ? 1 : -1);
}

/**
 * Compares two Uint8Array objects for equality.
 *
 * This function returns true if both arrays have the same length and identical elements at each index.
 *
 * @param {Uint8Array} arr1 - The first array to compare.
 * @param {Uint8Array} arr2 - The second array to compare.
 * @return {boolean} - Returns true if the arrays are equal, otherwise false.
 */
export function compareUint8ArraysQuick(arr1: Uint8Array, arr2: Uint8Array): boolean {
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

/**
 * Concatenates multiple Uint8Array objects into a single Uint8Array.
 *
 * @param {Uint8Array[]} arrays - An array of Uint8Array objects to concatenate.
 * @return {Uint8Array} A new Uint8Array containing all the elements from the input arrays, in order.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    // Calculate the total length of all arrays
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);

    // Create a new Uint8Array to hold the concatenated result
    const result = new Uint8Array(totalLength);

    // Copy each array into the result array at the correct offset
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }

    return result;
}
