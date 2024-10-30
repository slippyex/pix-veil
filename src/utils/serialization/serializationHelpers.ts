// src/utils/serialization/serializationHelpers.ts

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

/**
 * Serializes a hexadecimal checksum string into a buffer that includes
 * a 2-byte length prefix indicating the length of the checksum.
 *
 * @param {string} checksum - The hexadecimal checksum string to serialize.
 * @returns {Uint8Array} A buffer containing the length-prefixed checksum.
 */
export function serializeChecksum(checksum: string): Uint8Array {
    // Convert the checksum string (in hex) to a Uint8Array
    const checksumBuffer = new Uint8Array(checksum.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

    // Create a 2-byte buffer for the length
    const lengthBuffer = new Uint8Array(2);
    const lengthView = new DataView(lengthBuffer.buffer);
    lengthView.setUint16(0, checksumBuffer.length, false); // false for Big Endian

    // Concatenate the length buffer and checksum buffer
    const result = new Uint8Array(2 + checksumBuffer.length);
    result.set(lengthBuffer, 0);
    result.set(checksumBuffer, 2);

    return result;
}

/**
 * Deserializes a checksum from a given buffer starting at a specified offset.
 *
 * @param {Uint8Array} buffer - The buffer containing the serialized checksum.
 * @param {number} offset - The position in the buffer to start reading from.
 * @return {Object} The deserialized checksum as a hex string and the new offset after reading.
 * @return {string} return.checksum - The deserialized checksum in hex format.
 * @return {number} return.newOffset - The new offset position after reading the checksum.
 */
export function deserializeChecksum(buffer: Uint8Array, offset: number): { checksum: string; newOffset: number } {
    // Read the length as a 16-bit unsigned integer (Big Endian)
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const length = view.getUint16(offset, false); // false for Big Endian
    offset += 2;

    // Extract the checksum and convert it to a hex string
    const checksumArray = buffer.subarray(offset, offset + length);
    const checksum = Array.from(checksumArray).map((byte) => byte.toString(16).padStart(2, '0')).join('');

    return { checksum, newOffset: offset + length };
}

/**
 * Serializes a given string into a Uint8Array.
 *
 * @param {string} str - The string to be serialized.
 * @returns {Uint8Array} The Uint8Array representing the serialized string.
 */
export function serializeString(str: string): Uint8Array {
    // Encode the string into a Uint8Array
    const stringBuffer = new TextEncoder().encode(str);

    // Create a 2-byte buffer for the length
    const lengthBuffer = new Uint8Array(2);
    const lengthView = new DataView(lengthBuffer.buffer);
    lengthView.setUint16(0, stringBuffer.length, false); // Big Endian

    // Concatenate lengthBuffer and stringBuffer
    const result = new Uint8Array(2 + stringBuffer.length);
    result.set(lengthBuffer, 0);
    result.set(stringBuffer, 2);

    return result;
}

/**
 * Deserializes a string from the given Uint8Array starting at the specified offset.
 *
 * @param {Uint8Array} buffer - The buffer from which the string will be deserialized.
 * @param {number} offset - The offset within the buffer at which to start deserialization.
 * @return {{ value: string, newOffset: number }} An object containing the deserialized string and the new offset.
 */
export function deserializeString(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
    // Read the length of the string (2 bytes, Big Endian)
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const length = view.getUint16(offset, false); // Big Endian
    offset += 2;

    // Ensure the offset + length is within bounds
    if (offset + length > buffer.length) {
        throw new RangeError(
            `The value of "offset" (${offset + length}) is out of range. It must be >= 0 and <= ${buffer.length}.`,
        );
    }

    // Extract the string part and decode it from UTF-8
    const stringBuffer = buffer.subarray(offset, offset + length);
    const value = new TextDecoder().decode(stringBuffer);

    return { value, newOffset: offset + length };
}
