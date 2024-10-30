export const compareUint8Arrays = (arr1: Uint8Array, arr2: Uint8Array) =>
    arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
