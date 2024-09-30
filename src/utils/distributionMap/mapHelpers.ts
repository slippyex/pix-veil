// src/utils/distributionMap/mapHelpers.ts

import { ChannelSequence, IDistributionMap, IDistributionMapEntry } from '../../@types/index.ts';
import { MAGIC_BYTE } from '../../config/index.ts';
import { Buffer } from 'node:buffer';
import {
    deserializeUInt32,
    deserializeUInt8,
    serializeUInt32,
    serializeUInt8,
} from '../serialization/serializationHelpers.ts';

/**
 * Serializes the distribution map into a buffer with Magic Byte and Size Field.
 * @param distributionMap - The DistributionMap object to serialize.
 * @returns Buffer containing the serialized distribution map.
 */
export function serializeDistributionMap(distributionMap: IDistributionMap): Buffer {
    const entryBuffers = distributionMap.entries.map(serializeEntry);
    const entriesBuffer = Buffer.concat(entryBuffers);

    const checksumBuffer = serializeChecksum(distributionMap.checksum);
    const originalFilenameBuffer = serializeFilename(distributionMap.originalFilename);

    const entryCountBuffer = Buffer.alloc(4);
    entryCountBuffer.writeUInt32BE(distributionMap.entries.length, 0);

    const mapContent = Buffer.concat([entryCountBuffer, entriesBuffer, checksumBuffer, originalFilenameBuffer]);

    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(mapContent.length, 0);

    return Buffer.concat([MAGIC_BYTE, sizeBuffer, mapContent]);
}

/**
 * Deserializes the distribution map buffer into a DistributionMap object.
 * Expects the buffer to start with MAGIC_BYTE followed by SIZE and then CONTENT.
 * @param buffer - Buffer containing the serialized distribution map.
 * @returns Parsed DistributionMap object.
 */
export function deserializeDistributionMap(buffer: Buffer): IDistributionMap {
    validateMagicBytes(buffer);

    const size = buffer.readUInt32BE(MAGIC_BYTE.length);
    const mapContent = buffer.subarray(MAGIC_BYTE.length + 4, MAGIC_BYTE.length + 4 + size);

    let offset = 0;

    const entryCount = mapContent.readUInt32BE(offset);
    offset += 4;

    const entries: IDistributionMapEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
        const { entry, newOffset } = deserializeEntry(mapContent, offset);
        entries.push(entry);
        offset = newOffset;
    }

    const { checksum, newOffset: checksumOffset } = deserializeChecksum(mapContent, offset);
    offset = checksumOffset;

    const originalFilename = deserializeFilename(mapContent, offset);

    return { entries, checksum, originalFilename };
}

/**
 * Serializes a distribution map entry.
 * @param entry - The entry to serialize.
 * @returns Buffer containing the serialized entry.
 */
function serializeEntry(entry: IDistributionMapEntry): Buffer {
    const buffers: Buffer[] = [];

    // Serialize chunkId (4 bytes)
    buffers.push(serializeUInt32(entry.chunkId));

    // Serialize pngFile (filename)
    buffers.push(serializeString(entry.pngFile));

    // Serialize startPosition and endPosition (4 bytes each)
    buffers.push(serializeUInt32(entry.startPosition));
    buffers.push(serializeUInt32(entry.endPosition));

    // Serialize bitsPerChannel (1 byte)
    buffers.push(serializeUInt8(entry.bitsPerChannel));

    // Serialize channelSequence length (1 byte)
    buffers.push(serializeUInt8(entry.channelSequence.length));

    // Serialize channelSequence
    buffers.push(serializeChannelSequence(entry.channelSequence));

    return Buffer.concat(buffers);
}

/**
 * Deserializes a distribution map entry.
 * @param buffer - The buffer containing the serialized entry.
 * @param offset - The offset at which the entry begins.
 * @returns The deserialized entry and the new offset.
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
        startPosition,
        endPosition,
        bitsPerChannel,
        channelSequence,
    };

    return { entry, newOffset };
}

/**
 * Serializes the channel sequence.
 * @param channelSequence - The channel sequence to serialize.
 * @returns Buffer containing the serialized channel sequence.
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
 * Deserializes the channel sequence.
 * @param buffer - The buffer containing the serialized channel sequence.
 * @param length - The number of channels in the sequence.
 * @returns The deserialized channel sequence.
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
 * Serializes the checksum.
 * @param checksum - The checksum to serialize.
 * @returns Buffer containing the serialized checksum.
 */
function serializeChecksum(checksum: string): Buffer {
    const checksumBuffer = Buffer.from(checksum, 'hex');
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(checksumBuffer.length, 0);
    return Buffer.concat([lengthBuffer, checksumBuffer]);
}

/**
 * Deserializes the checksum.
 * @param buffer - The buffer containing the serialized checksum.
 * @param offset - The offset at which the checksum begins.
 * @returns The deserialized checksum and the new offset.
 */
function deserializeChecksum(buffer: Buffer, offset: number): { checksum: string; newOffset: number } {
    const length = buffer.readUInt16BE(offset);
    offset += 2;
    const checksum = buffer.subarray(offset, offset + length).toString('hex');
    return { checksum, newOffset: offset + length };
}

/**
 * Serializes a string with its length prefixed as a 2-byte unsigned integer.
 * @param str - The string to serialize.
 * @returns Buffer containing the serialized string.
 */
function serializeString(str: string): Buffer {
    const stringBuffer = Buffer.from(str, 'utf-8');
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(stringBuffer.length, 0);
    return Buffer.concat([lengthBuffer, stringBuffer]);
}

/**
 * Deserializes a string prefixed with its length as a 2-byte unsigned integer.
 * @param buffer - The buffer containing the serialized string.
 * @param offset - The offset at which the string begins.
 * @returns The deserialized string and the new offset.
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
 * Serializes the original filename.
 * @param filename - The filename to serialize.
 * @returns Buffer containing the serialized filename.
 */
function serializeFilename(filename: string): Buffer {
    return serializeString(filename);
}

/**
 * Deserializes the original filename.
 * @param buffer - The buffer containing the serialized filename.
 * @param offset - The offset at which the filename begins.
 * @returns The deserialized filename.
 */
function deserializeFilename(buffer: Buffer, offset: number): string {
    const { value } = deserializeString(buffer, offset);
    return value;
}

/**
 * Converts a channel character to its corresponding value.
 * @param channel - The channel character.
 * @returns The channel value.
 */
function channelValue(channel: ChannelSequence): number {
    switch (channel) {
        case 'R':
            return 0x0;
        case 'G':
            return 0x1;
        case 'B':
            return 0x2;
        default:
            throw new Error(`Invalid channel value: ${channel}`);
    }
}

/**
 * Converts a channel value to its corresponding character.
 * @param value - The channel value.
 * @returns The channel character.
 */
function channelFromValue(value: number): ChannelSequence {
    switch (value) {
        case 0x0:
            return 'R';
        case 0x1:
            return 'G';
        case 0x2:
            return 'B';
        default:
            throw new Error(`Invalid channel sequence value: ${value}`);
    }
}

/**
 * Validates the magic bytes at the start of the buffer.
 * @param buffer - The buffer to validate.
 * @throws If the magic bytes are not found.
 */
function validateMagicBytes(buffer: Buffer): void {
    if (!buffer.subarray(0, MAGIC_BYTE.length).equals(MAGIC_BYTE)) {
        throw new Error('Magic bytes not found at the start of the distribution map.');
    }
}
