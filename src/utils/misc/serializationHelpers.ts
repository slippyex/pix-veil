// src/utils/misc/serializationHelpers.ts

import { Buffer } from 'node:buffer';

/**
 * Serializes a 32-bit unsigned integer.
 * @param value - The value to serialize.
 * @returns Buffer containing the serialized value.
 */
export function serializeUInt32(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value, 0);
    return buffer;
}

/**
 * Deserializes a 32-bit unsigned integer.
 * @param buffer - The buffer containing the serialized value.
 * @param offset - The offset at which the value begins.
 * @returns The deserialized value and the new offset.
 */
export function deserializeUInt32(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt32BE(offset);
    return { value, newOffset: offset + 4 };
}

/**
 * Serializes a 16-bit unsigned integer.
 * @param value - The value to serialize.
 * @returns Buffer containing the serialized value.
 */
export function serializeUInt16(value: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(value, 0);
    return buffer;
}

/**
 * Deserializes a 16-bit unsigned integer.
 * @param buffer - The buffer containing the serialized value.
 * @param offset - The offset at which the value begins.
 * @returns The deserialized value and the new offset.
 */
export function deserializeUInt16(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt16BE(offset);
    return { value, newOffset: offset + 2 };
}

/**
 * Serializes an 8-bit unsigned integer.
 * @param value - The value to serialize.
 * @returns Buffer containing the serialized value.
 */
export function serializeUInt8(value: number): Buffer {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value, 0);
    return buffer;
}

/**
 * Deserializes an 8-bit unsigned integer.
 * @param buffer - The buffer containing the serialized value.
 * @param offset - The offset at which the value begins.
 * @returns The deserialized value and the new offset.
 */
export function deserializeUInt8(buffer: Buffer, offset: number): { value: number; newOffset: number } {
    const value = buffer.readUInt8(offset);
    return { value, newOffset: offset + 1 };
}
