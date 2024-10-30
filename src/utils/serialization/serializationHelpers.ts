/**
 * Serializes a 32-bit unsigned integer into a Uint8Array.
 *
 * @param {number} value - The 32-bit unsigned integer to serialize.
 * @returns {Uint8Array} A Uint8Array containing the serialized 32-bit unsigned integer.
 */
export function serializeUInt32(value: number): Uint8Array {
    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, value, false); // false for Big Endian
    return buffer;
}

/**
 * Deserializes a 32-bit unsigned integer from the given Uint8Array at the specified offset.
 *
 * @param {Uint8Array} buffer - The Uint8Array containing the serialized 32-bit unsigned integer.
 * @param {number} offset - The offset in the Uint8Array where the 32-bit unsigned integer starts.
 * @return {{ value: number, newOffset: number }} An object containing the deserialized 32-bit unsigned integer and the new offset.
 */
export function deserializeUInt32(buffer: Uint8Array, offset: number): { value: number; newOffset: number } {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const value = view.getUint32(offset, false); // false for Big Endian
    return { value, newOffset: offset + 4 };
}

/**
 * Serializes a 16-bit unsigned integer into a Uint8Array.
 *
 * @param {number} value - The 16-bit unsigned integer to serialize.
 * @returns {Uint8Array} The Uint8Array containing the serialized data.
 */
export function serializeUInt16(value: number): Uint8Array {
    const buffer = new Uint8Array(2);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, value, false); // false for Big Endian
    return buffer;
}

/**
 * Deserializes a 16-bit unsigned integer from the given Uint8Array starting at the specified offset.
 *
 * @param {Uint8Array} buffer - The Uint8Array containing the serialized 16-bit unsigned integer.
 * @param {number} offset - The offset in the Uint8Array to start reading from.
 * @return {{ value: number; newOffset: number }} An object containing the deserialized 16-bit unsigned integer and the updated offset.
 */
export function deserializeUInt16(buffer: Uint8Array, offset: number): { value: number; newOffset: number } {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const value = view.getUint16(offset, false); // false for Big Endian
    return { value, newOffset: offset + 2 };
}

/**
 * Serializes an unsigned 8-bit integer to a Uint8Array.
 *
 * @param {number} value - The value to serialize. Must be a number between 0 and 255.
 * @returns {Uint8Array} A Uint8Array containing the serialized 8-bit unsigned integer.
 */
export function serializeUInt8(value: number): Uint8Array {
    const buffer = new Uint8Array(1);
    buffer[0] = value;
    return buffer;
}

/**
 * Deserializes an unsigned 8-bit integer from the given Uint8Array starting at the specified offset.
 *
 * @param {Uint8Array} buffer - The Uint8Array from which to read the unsigned 8-bit integer.
 * @param {number} offset - The offset within the Uint8Array at which to start reading.
 * @return {{ value: number; newOffset: number }} An object containing the deserialized unsigned 8-bit integer and the offset after reading.
 */
export function deserializeUInt8(buffer: Uint8Array, offset: number): { value: number; newOffset: number } {
    const value = buffer[offset];
    return { value, newOffset: offset + 1 };
}
