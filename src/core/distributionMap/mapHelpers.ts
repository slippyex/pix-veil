// src/core/distributionMap/mapHelpers.ts

import type { ChannelSequence, IDistributionMap, IDistributionMapEntry } from '../../@types/index.ts';

import { MAGIC_BYTE } from '../../config/index.ts';
import {
    deserializeUInt32,
    deserializeUInt8,
    serializeUInt32,
    serializeUInt8,
} from '../../utils/serialization/serializationHelpers.ts';
import { SupportedCompressionStrategies } from '../../utils/compression/compressionStrategies.ts';
import { channelFromValue, getChannelOffset } from '../../utils/misc/lookups.ts';
import { compareUint8ArraysQuick, concatUint8Arrays } from '../../utils/misc/uint8arrayHelpers.ts';

/**
 * Serializes a distribution map into an Uint8Array.
 *
 * @param {IDistributionMap} distributionMap - The distribution map to serialize,
 *   containing information about entries, checksum, original filename, encrypted data length,
 *   and compression strategy.
 * @returns {Uint8Array} The serialized Uint8Array representation of the distribution map.
 */
export function serializeDistributionMap(distributionMap: IDistributionMap): Uint8Array {
    const entryBuffers = distributionMap.entries.map(serializeEntry);
    const entriesBuffer = concatUint8Arrays(entryBuffers);

    const checksumBuffer = serializeChecksum(distributionMap.checksum);
    const originalFilenameBuffer = serializeString(distributionMap.originalFilename);

    // Serialize encryptedDataLength (4 bytes)
    const encryptedDataLengthBuffer = serializeUInt32(distributionMap.encryptedDataLength);

    // Serialize compressionStrategy (UInt8)
    const compressionStrategyBuffer = new Uint8Array(1);
    compressionStrategyBuffer[0] = compressionStrategyToValue(distributionMap.compressionStrategy);

    // Serialize entryCount (4 bytes)
    const entryCountBuffer = new Uint8Array(4);
    const entryCountView = new DataView(entryCountBuffer.buffer);
    entryCountView.setUint32(0, distributionMap.entries.length, false); // false for Big Endian

    const mapContent = concatUint8Arrays([
        entryCountBuffer,
        entriesBuffer,
        checksumBuffer,
        originalFilenameBuffer,
        encryptedDataLengthBuffer,
        compressionStrategyBuffer,
    ]);

    const sizeBuffer = new Uint8Array(4);
    const sizeBufferView = new DataView(sizeBuffer.buffer);
    sizeBufferView.setUint32(0, mapContent.length, false);
    //    sizeBuffer.writeUInt32BE(mapContent.length, 0);

    return concatUint8Arrays([MAGIC_BYTE, sizeBuffer, mapContent]);
}

/**
 * Converts a SupportedCompressionStrategies enum to its corresponding numeric value.
 *
 * @param {SupportedCompressionStrategies} strategy - The compression strategy to convert.
 * @returns {number} - The numeric value representing the compression strategy.
 */
function compressionStrategyToValue(strategy: SupportedCompressionStrategies): number {
    switch (strategy) {
        case SupportedCompressionStrategies.Brotli:
            return 0;
        case SupportedCompressionStrategies.GZip:
            return 1;
        case SupportedCompressionStrategies.None:
            return 2;
        default:
            throw new Error(`Unknown compression strategy: ${strategy}`);
    }
}

/**
 * Deserializes a buffer into a distribution map object.
 *
 * @param {Uint8Array} buffer - The buffer containing the serialized distribution map data.
 * @return {IDistributionMap} The deserialized distribution map object which includes entries, checksum, original filename, encrypted data length, and compression strategy.
 */
export function deserializeDistributionMap(buffer: Uint8Array): IDistributionMap {
    validateMagicBytes(buffer);

    // Read size as a 32-bit unsigned integer (Big Endian) after the magic bytes
    const sizeView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const size = sizeView.getUint32(MAGIC_BYTE.length, false); // Big Endian

    // Extract the map content based on the calculated size
    const mapContent = buffer.subarray(MAGIC_BYTE.length + 4, MAGIC_BYTE.length + 4 + size);

    let offset = 0;

    // 1. Deserialize Number of Entries (UInt32BE)
    const entryCountView = new DataView(mapContent.buffer, mapContent.byteOffset, mapContent.byteLength);
    const entryCount = entryCountView.getUint32(offset, false); // Big Endian
    offset += 4;

    // 2. Deserialize Each DistributionMapEntry
    const entries: IDistributionMapEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
        const { entry, newOffset } = deserializeEntry(mapContent, offset);
        entries.push(entry);
        offset = newOffset;
    }

    // 3. Deserialize checksum (String with UInt16BE length prefix)
    const { checksum, newOffset: checksumOffset } = deserializeChecksum(mapContent, offset);
    offset = checksumOffset;

    // 4. Deserialize originalFilename (String with UInt16BE length prefix)
    const { value: originalFilename, newOffset: filenameOffset } = deserializeString(mapContent, offset);
    offset = filenameOffset;

    // 5. Deserialize encryptedDataLength (UInt32BE)
    const { value: encryptedDataLength, newOffset: offsetAfterLength } = deserializeUInt32(mapContent, offset);
    offset = offsetAfterLength;

    // 6. Deserialize compressionStrategy (UInt8)
    if (offset + 1 > mapContent.length) {
        throw new RangeError('Uint8Array too small to contain compressionStrategy.');
    }

    const view = new DataView(mapContent.buffer, mapContent.byteOffset, mapContent.byteLength);
    const compressionStrategyValue = view.getUint8(offset);
    //    const compressionStrategyValue = mapContent.readUInt8(offset);
    const compressionStrategy = valueToCompressionStrategy(compressionStrategyValue);
    offset += 1;

    return {
        entries,
        checksum,
        originalFilename,
        encryptedDataLength,
        compressionStrategy,
    };
}

/**
 * Converts a numeric compression strategy value back to its corresponding enum.
 *
 * @param {number} value - The numeric value representing the compression strategy.
 * @returns {SupportedCompressionStrategies} - The corresponding compression strategy.
 */
function valueToCompressionStrategy(value: number): SupportedCompressionStrategies {
    switch (value) {
        case 0:
            return SupportedCompressionStrategies.Brotli;
        case 1:
            return SupportedCompressionStrategies.GZip;
        case 2:
            return SupportedCompressionStrategies.None;
        default:
            throw new Error(`Unknown compression strategy value: ${value}`);
    }
}

/**
 * Serializes a given distribution map entry into an Uint8Array.
 *
 * @param {IDistributionMapEntry} entry - The entry to be serialized, which contains properties such as
 *                chunkId, pngFile, startPosition, endPosition, bitsPerChannel,
 *                and channelSequence.
 * @returns {Uint8Array} An Uint8Array containing the serialized data of the provided entry.
 */
function serializeEntry(entry: IDistributionMapEntry): Uint8Array {
    const buffers: Uint8Array[] = [];

    // Serialize chunkId (4 bytes)
    buffers.push(serializeUInt32(entry.chunkId));

    // Serialize pngFile (filename)
    buffers.push(serializeString(entry.pngFile));

    // Serialize startPosition and endPosition (4 bytes each)
    buffers.push(serializeUInt32(entry.startChannelPosition));
    buffers.push(serializeUInt32(entry.endChannelPosition));

    // Serialize bitsPerChannel (1 byte)
    buffers.push(serializeUInt8(entry.bitsPerChannel));

    // Serialize channelSequence length (1 byte)
    buffers.push(serializeUInt8(entry.channelSequence.length));

    // Serialize channelSequence
    buffers.push(serializeChannelSequence(entry.channelSequence));

    return concatUint8Arrays(buffers);
}

/**
 * Deserializes a single distribution map entry from the buffer starting at the given offset.
 *
 * @param {Uint8Array} buffer - The buffer containing serialized entry data.
 * @param {number} offset - The initial offset in the buffer from where to start deserialization.
 * @return {{ entry: IDistributionMapEntry; newOffset: number }} - The deserialized entry and the new buffer offset.
 */
function deserializeEntry(buffer: Uint8Array, offset: number): { entry: IDistributionMapEntry; newOffset: number } {
    // Deserialize chunkId
    const { value: chunkId, newOffset: offset1 } = deserializeUInt32(buffer, offset);

    // Deserialize pngFile (filename)
    const { value: pngFile, newOffset: offset2 } = deserializeString(buffer, offset1);

    // Deserialize startPosition
    const { value: startPosition, newOffset: offset3 } = deserializeUInt32(buffer, offset2);

    // Deserialize endPosition
    const { value: endPosition, newOffset: offset4 } = deserializeUInt32(buffer, offset3);

    // Deserialize bitsPerChannel
    const { value: bitsPerChannel, newOffset: offset5 } = deserializeUInt8(buffer, offset4);

    // Deserialize channelSeqLength
    const { value: channelSeqLength, newOffset: offset6 } = deserializeUInt8(buffer, offset5);

    // Deserialize channelSequence
    const channelSeqBufferLength = Math.ceil(channelSeqLength / 4);
    const channelSeqBuffer = buffer.subarray(offset6, offset6 + channelSeqBufferLength);
    const newOffset = offset6 + channelSeqBufferLength;
    const channelSequence = deserializeChannelSequence(channelSeqBuffer, channelSeqLength);

    const entry: IDistributionMapEntry = {
        chunkId,
        pngFile,
        startChannelPosition: startPosition,
        endChannelPosition: endPosition,
        bitsPerChannel,
        channelSequence,
    };

    return { entry, newOffset };
}

/**
 * Serializes a sequence of channel objects into an Uint8Array, with a compact binary representation.
 *
 * @param {ChannelSequence[]} channelSequence - An array of channel objects to be serialized. Each channel's value is extracted using the channelValue function.
 * @returns {Uint8Array} - An Uint8Array containing the serialized binary representation of the channel sequence.
 */
function serializeChannelSequence(channelSequence: ChannelSequence[]): Uint8Array {
    const byteLength = Math.ceil(channelSequence.length / 4);
    const buffer = new Uint8Array(byteLength);

    channelSequence.forEach((channel, index) => {
        const byteIndex = Math.floor(index / 4);
        const shift = (3 - (index % 4)) * 2;
        buffer[byteIndex] |= getChannelOffset(channel) << shift;
    });

    return buffer;
}

/**
 * Deserializes a channel sequence from a buffer.
 *
 * @param {Uint8Array} buffer - The buffer containing serialized channel sequence data.
 * @param {number} length - The number of channels to deserialize.
 * @returns {ChannelSequence[]} An array of deserialized ChannelSequence objects.
 */
function deserializeChannelSequence(buffer: Uint8Array, length: number): ChannelSequence[] {
    const channelSequence: ChannelSequence[] = [];

    for (let i = 0; i < length; i++) {
        const byteIndex = Math.floor(i / 4);
        const shift = (3 - (i % 4)) * 2;
        const value = (buffer[byteIndex] >> shift) & 0x03;
        channelSequence.push(channelFromValue(value));
    }

    return channelSequence;
}

/**
 * Serializes a hexadecimal checksum string into a buffer that includes
 * a 2-byte length prefix indicating the length of the checksum.
 *
 * @param {string} checksum - The hexadecimal checksum string to serialize.
 * @returns {Uint8Array} A buffer containing the length-prefixed checksum.
 */
function serializeChecksum(checksum: string): Uint8Array {
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
function deserializeChecksum(buffer: Uint8Array, offset: number): { checksum: string; newOffset: number } {
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
function serializeString(str: string): Uint8Array {
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
function deserializeString(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
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

/**
 * Validates the presence of specified magic bytes at the beginning of a buffer.
 *
 * @param {Uint8Array} buffer - The buffer in which to validate the magic bytes.
 * @return {void} - Throws an error if the magic bytes are not found.
 */
function validateMagicBytes(buffer: Uint8Array): void {
    if (!compareUint8ArraysQuick(buffer.subarray(0, MAGIC_BYTE.length), MAGIC_BYTE)) {
        throw new Error('Magic bytes not found at the start of the distribution map.');
    }
}
