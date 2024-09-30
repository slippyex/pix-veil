// src/utils/serialization/serializationHelpers.ts

import { Buffer } from 'node:buffer';

/**
 * Serializes a 32-bit unsigned integer into a Buffer.
 *
 * @param {number} value - The 32-bit unsigned integer to serialize.
 * @returns {Buffer} A Buffer containing the serialized 32-bit unsigned integer.
 */
export function serializeUInt32(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value, 0);
    return buffer;
}

/**
 * Deserializes a 32-bit unsigned integer from the given buffer at the specified offset.
 *
 * @param {Buffer} buffer - The buffer containing the serialized 32-bit unsigned integer.
 * @param {number} offset - The offset in the buffer where the 32-bit unsigned integer starts.
 * @return {{ value: number, newOffset: number }} An object containing the deserialized 32-bit unsigned integer and the new offset.
 */
export function deserializeUInt32(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt32BE(offset);
    return { value, newOffset: offset + 4 };
}

/**
 * Serializes a 16-bit unsigned integer into a Buffer.
 *
 * @param {number} value - The 16-bit unsigned integer to serialize.
 * @returns {Buffer} The Buffer containing the serialized data.
 */
export function serializeUInt16(value: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(value, 0);
    return buffer;
}

/**
 * Deserializes a 16-bit unsigned integer from the given buffer starting at the specified offset.
 *
 * @param {Buffer} buffer - The buffer containing the serialized 16-bit unsigned integer.
 * @param {number} offset - The offset in the buffer to start reading from.
 * @return {{ value: number; newOffset: number }} An object containing the deserialized 16-bit unsigned integer and the updated offset.
 */
export function deserializeUInt16(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt16BE(offset);
    return { value, newOffset: offset + 2 };
}

/**
 * Serializes an unsigned 8-bit integer to a Buffer.
 *
 * @param {number} value - The value to serialize. Must be a number between 0 and 255.
 * @returns {Buffer} A Buffer containing the serialized 8-bit unsigned integer.
 */
export function serializeUInt8(value: number): Buffer {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value, 0);
    return buffer;
}

/**
 * Deserializes an unsigned 8-bit integer from the given buffer starting at the specified offset.
 *
 * @param {Buffer} buffer - The buffer from which to read the unsigned 8-bit integer.
 * @param {number} offset - The offset within the buffer at which to start reading.
 * @return {Object} An object containing the deserialized value and the new offset.
 * @return {number} return.value - The deserialized unsigned 8-bit integer.
 * @return {number} return.newOffset - The offset after reading the unsigned 8-bit integer.
 */
export function deserializeUInt8(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt8(offset);
    return { value, newOffset: offset + 1 };
}
