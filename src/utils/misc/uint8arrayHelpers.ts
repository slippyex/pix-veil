export const compareUint8ArraysLex = (arr1: Uint8Array, arr2: Uint8Array): number => {
    const len = arr1.length < arr2.length ? arr1.length : arr2.length; // Minimum length

    for (let i = 0; i < len; i++) {
        const diff = arr1[i] - arr2[i];
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }

    // If all compared elements are equal, compare lengths
    return arr1.length === arr2.length ? 0 : (arr1.length > arr2.length ? 1 : -1);
};

export const compareUint8ArraysQuick = (arr1: Uint8Array, arr2: Uint8Array) =>
    arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);

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
