// src/utils/misc/helpers.ts

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    // Calculate total length
    const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);

    // Allocate a new Uint8Array
    const result = new Uint8Array(totalLength);

    // Set each array into the result
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }

    return result;
}
