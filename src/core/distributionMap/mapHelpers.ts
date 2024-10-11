// src/core/distributionMap/mapHelpers.ts

import { ChannelSequence, IDistributionMap, IDistributionMapEntry, ISerializeInfo } from '../../@types/index.ts';

import { MAGIC_BYTE } from '../../config/index.ts';
import { Buffer } from 'node:buffer';
import {
    deserializeUInt32,
    deserializeUInt8,
    serializeUInt32,
    serializeUInt8,
} from '../../utils/serialization/serializationHelpers.ts';
import {
    channelFromValue,
    channelValue,
    compressionStrategyToValue,
    valueToCompressionStrategy,
} from './converters.ts';

/**
 * Serializes a distribution map into a Buffer.
 *
 * @param {IDistributionMap} distributionMap - The distribution map to serialize,
 *   containing information about entries, checksum, original filename, encrypted data length,
 *   and compression strategy.
 * @returns {Buffer} The serialized Buffer representation of the distribution map.
 */
export function serializeDistributionMap(distributionMap: IDistributionMap): Buffer {
    const entryBuffers = distributionMap.entries.map(serializeEntry);
    const entriesBuffer = Buffer.concat(entryBuffers);

    const checksumBuffer = serializeChecksum(distributionMap.checksum);
    const originalFilenameBuffer = serializeString(distributionMap.originalFilename);

    // Serialize encryptedDataLength (4 bytes)
    const encryptedDataLengthBuffer = serializeUInt32(distributionMap.encryptedDataLength);

    // Serialize compressionStrategy (UInt8)
    const compressionStrategyBuffer = Buffer.alloc(1);
    compressionStrategyBuffer.writeUInt8(compressionStrategyToValue(distributionMap.compressionStrategy), 0);

    // Serialize entryCount (4 bytes)
    const entryCountBuffer = Buffer.alloc(4);
    entryCountBuffer.writeUInt32BE(distributionMap.entries.length, 0);

    const mapContent = Buffer.concat([
        entryCountBuffer,
        entriesBuffer,
        checksumBuffer,
        originalFilenameBuffer,
        encryptedDataLengthBuffer,
        compressionStrategyBuffer,
    ]);

    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(mapContent.length, 0);

    return Buffer.concat([MAGIC_BYTE, sizeBuffer, mapContent]);
}

/**
 * Deserializes a buffer into a distribution map object.
 *
 * @param {Buffer} buffer - The buffer containing the serialized distribution map data.
 * @return {IDistributionMap} The deserialized distribution map object which includes entries, checksum, original filename, encrypted data length, and compression strategy.
 */
export function deserializeDistributionMap(buffer: Buffer): IDistributionMap {
    validateMagicBytes(buffer);

    const size = buffer.readUInt32BE(MAGIC_BYTE.length);
    const mapContent = buffer.subarray(MAGIC_BYTE.length + 4, MAGIC_BYTE.length + 4 + size);

    let offset = 0;

    // 1. Deserialize Number of Entries (UInt32BE)
    const entryCount = mapContent.readUInt32BE(offset);
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
        throw new RangeError('Buffer too small to contain compressionStrategy.');
    }
    const compressionStrategyValue = mapContent.readUInt8(offset);
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
 * Serializes a given distribution map entry into a Buffer.
 *
 * @param {IDistributionMapEntry} entry - The entry to be serialized, which contains properties such as
 *                chunkId, pngFile, startPosition, endPosition, bitsPerChannel,
 *                and channelSequence.
 * @returns {Buffer} A Buffer containing the serialized data of the provided entry.
 */
function serializeEntry(entry: IDistributionMapEntry): Buffer {
    const buffers: Buffer[] = [];

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

    return Buffer.concat(buffers);
}

/**
 * Deserializes a single distribution map entry from the buffer starting at the given offset.
 *
 * @param {Buffer} buffer - The buffer containing serialized entry data.
 * @param {number} offset - The initial offset in the buffer from where to start deserialization.
 * @return {{ entry: IDistributionMapEntry; newOffset: number }} - The deserialized entry and the new buffer offset.
 */
function deserializeEntry(buffer: Buffer, offset: number): { entry: IDistributionMapEntry; newOffset: number } {
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
 * Serializes a sequence of channel objects into a Buffer, with a compact binary representation.
 *
 * @param {ChannelSequence[]} channelSequence - An array of channel objects to be serialized. Each channel's value is extracted using the channelValue function.
 * @returns {Buffer} - A Buffer containing the serialized binary representation of the channel sequence.
 */
function serializeChannelSequence(channelSequence: ChannelSequence[]): Buffer {
    const byteLength = Math.ceil(channelSequence.length / 4);
    const buffer = Buffer.alloc(byteLength);

    channelSequence.forEach((channel, index) => {
        const byteIndex = Math.floor(index / 4);
        const shift = (3 - (index % 4)) * 2;
        buffer[byteIndex] |= channelValue(channel) << shift;
    });

    return buffer;
}

/**
 * Deserializes a channel sequence from a buffer.
 *
 * @param {Buffer} buffer - The buffer containing serialized channel sequence data.
 * @param {number} length - The number of channels to deserialize.
 * @returns {ChannelSequence[]} An array of deserialized ChannelSequence objects.
 */
function deserializeChannelSequence(buffer: Buffer, length: number): ChannelSequence[] {
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
 * @returns {Buffer} A buffer containing the length-prefixed checksum.
 */
function serializeChecksum(checksum: string): Buffer {
    const checksumBuffer = Buffer.from(checksum, 'hex');
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(checksumBuffer.length, 0);
    return Buffer.concat([lengthBuffer, checksumBuffer]);
}

/**
 * Deserializes a checksum from a given buffer starting at a specified offset.
 *
 * @param {Buffer} buffer - The buffer containing the serialized checksum.
 * @param {number} offset - The position in the buffer to start reading from.
 * @return {Object} The deserialized checksum as a hex string and the new offset after reading.
 * @return {string} return.checksum - The deserialized checksum in hex format.
 * @return {number} return.newOffset - The new offset position after reading the checksum.
 */
function deserializeChecksum(buffer: Buffer, offset: number): { checksum: string; newOffset: number } {
    const length = buffer.readUInt16BE(offset);
    offset += 2;
    const checksum = buffer.subarray(offset, offset + length).toString('hex');
    return { checksum, newOffset: offset + length };
}

/**
 * Serializes a given string into a Buffer object.
 *
 * @param {string} str - The string to be serialized.
 * @returns {Buffer} The Buffer object representing the serialized string.
 */
function serializeString(str: string): Buffer {
    const stringBuffer = Buffer.from(str, 'utf-8');
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(stringBuffer.length, 0);
    return Buffer.concat([lengthBuffer, stringBuffer]);
}

/**
 * Deserializes a string from the given buffer starting at the specified offset.
 *
 * @param {Buffer} buffer - The buffer from which the string will be deserialized.
 * @param {number} offset - The offset within the buffer at which to start deserialization.
 * @return {Object} An object containing the deserialized string and the new offset.
 */
function deserializeString(buffer: Buffer, offset: number): { value: string; newOffset: number } {
    const length = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + length > buffer.length) {
        throw new RangeError(
            `The value of "offset" (${offset + length}) is out of range. It must be >= 0 and <= ${buffer.length}.`,
        );
    }

    const value = buffer.subarray(offset, offset + length).toString('utf-8');
    return { value, newOffset: offset + length };
}

/**
 * Validates the presence of specified magic bytes at the beginning of a buffer.
 *
 * @param {Buffer} buffer - The buffer in which to validate the magic bytes.
 * @return {void} - Throws an error if the magic bytes are not found.
 */
function validateMagicBytes(buffer: Buffer): void {
    if (!buffer.subarray(0, MAGIC_BYTE.length).equals(MAGIC_BYTE)) {
        throw new Error('Magic bytes not found at the start of the distribution map.');
    }
}
