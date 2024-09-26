// src/utils/distributionMap/mapHelpers.ts

import { ChannelSequence, DistributionMap, DistributionMapEntry } from '../../@types';
import { MAGIC_BYTE } from '../../constants';

/**
 * Serializes the distribution map into a buffer with Magic Byte and Size Field.
 * @param distributionMap - The DistributionMap object to serialize.
 * @returns Buffer containing the serialized distribution map.
 */
export function serializeDistributionMap(distributionMap: DistributionMap): Buffer {
    const mapBufferArray: Buffer[] = [];
    const entryCountBuffer = Buffer.alloc(4);
    entryCountBuffer.writeUInt32BE(distributionMap.entries.length, 0);
    mapBufferArray.push(entryCountBuffer);

    distributionMap.entries.forEach(entry => {
        mapBufferArray.push(serializeEntry(entry));
    });

    const checksumBuffer = serializeChecksum(distributionMap.checksum);
    mapBufferArray.push(...checksumBuffer);

    const mapContent = Buffer.concat(mapBufferArray);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(mapContent.length, 0);

    return Buffer.concat([MAGIC_BYTE, sizeBuffer, mapContent]);
}

function serializeEntry(entry: DistributionMapEntry): Buffer {
    const entryBufferArray: Buffer[] = [];

    const chunkIdBuffer = Buffer.alloc(4);
    chunkIdBuffer.writeUInt32BE(entry.chunkId, 0);
    entryBufferArray.push(chunkIdBuffer);

    const fileNameBuffer = Buffer.from(entry.pngFile, 'utf-8');
    const fileNameLengthBuffer = Buffer.alloc(2);
    fileNameLengthBuffer.writeUInt16BE(fileNameBuffer.length, 0);
    entryBufferArray.push(fileNameLengthBuffer, fileNameBuffer);

    const startBuffer = Buffer.alloc(4);
    startBuffer.writeUInt32BE(entry.startPosition, 0);
    entryBufferArray.push(startBuffer);

    const endBuffer = Buffer.alloc(4);
    endBuffer.writeUInt32BE(entry.endPosition, 0);
    entryBufferArray.push(endBuffer);

    const bitsPerChannelBuffer = Buffer.alloc(1);
    bitsPerChannelBuffer.writeUInt8(entry.bitsPerChannel, 0);
    entryBufferArray.push(bitsPerChannelBuffer);

    const channelSeqLengthBuffer = Buffer.alloc(1);
    channelSeqLengthBuffer.writeUInt8(entry.channelSequence.length, 0);
    entryBufferArray.push(channelSeqLengthBuffer);

    entryBufferArray.push(serializeChannelSequence(entry.channelSequence));

    return Buffer.concat(entryBufferArray);
}

function serializeChannelSequence(channelSequence: ChannelSequence[]): Buffer {
    const channelSeqBuffer = Buffer.alloc(Math.ceil(channelSequence.length / 4));

    channelSequence.forEach((channel, index) => {
        const shift = (3 - (index % 4)) * 2;
        const value = channelValue(channel);
        channelSeqBuffer[Math.floor(index / 4)] |= value << shift;
    });

    return channelSeqBuffer;
}

function channelValue(channel: string): number {
    switch (channel) {
        case 'R':
            return 0x0;
        case 'G':
            return 0x1;
        case 'B':
            return 0x2;
        default:
            return 0x0; // Default fallback to 'R'
    }
}

function serializeChecksum(checksum: string): Buffer[] {
    const checksumBuffer = Buffer.from(checksum, 'hex');
    const checksumLengthBuffer = Buffer.alloc(2);
    checksumLengthBuffer.writeUInt16BE(checksumBuffer.length, 0);
    return [checksumLengthBuffer, checksumBuffer];
}

/**
 * Deserializes the distribution map buffer into a DistributionMap object.
 * Expects the buffer to start with MAGIC_BYTE followed by SIZE and then CONTENT.
 * @param buffer - Buffer containing the serialized distribution map.
 * @returns Parsed DistributionMap object.
 */
export function deserializeDistributionMap(buffer: Buffer): DistributionMap {
    const magicLength = MAGIC_BYTE.length;
    validateMagicBytes(buffer);

    const size = buffer.readUInt32BE(magicLength);
    const mapContent = buffer.subarray(magicLength + 4, magicLength + 4 + size);

    let offset = 0;
    const entryCount = readUInt32BE(mapContent, offset);
    offset += 4;

    const entries: DistributionMapEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
        const entry = deserializeEntry(mapContent, offset);
        entries.push(entry.entry);
        offset = entry.newOffset;
    }

    const checksum = deserializeChecksum(mapContent, offset);
    return { entries, checksum };
}

function validateMagicBytes(buffer: Buffer): void {
    const magicLength = MAGIC_BYTE.length;
    if (!buffer.subarray(0, magicLength).equals(MAGIC_BYTE)) {
        throw new Error('Magic bytes not found at the start of the distribution map.');
    }
}

function readUInt32BE(buffer: Buffer, offset: number): number {
    return buffer.readUInt32BE(offset);
}

function deserializeEntry(buffer: Buffer, offset: number) {
    const chunkId = readUInt32BE(buffer, offset);
    offset += 4;

    const fileNameLength = buffer.readUInt16BE(offset);
    offset += 2;
    const fileName = buffer.subarray(offset, offset + fileNameLength).toString('utf-8');
    offset += fileNameLength;

    const startPosition = readUInt32BE(buffer, offset);
    offset += 4;
    const endPosition = readUInt32BE(buffer, offset);
    offset += 4;

    const bitsPerChannel = buffer.readUInt8(offset);
    offset += 1;

    const channelSeqLength = buffer.readUInt8(offset);
    offset += 1;

    const channelSeqBytes = Math.ceil(channelSeqLength / 4);
    const channelSeqBuffer = buffer.subarray(offset, offset + channelSeqBytes);
    offset += channelSeqBytes;

    const channelSequence = deserializeChannelSequence(channelSeqBuffer, channelSeqLength);

    return {
        entry: { chunkId, pngFile: fileName, startPosition, endPosition, bitsPerChannel, channelSequence },
        newOffset: offset
    };
}

function deserializeChannelSequence(buffer: Buffer, length: number): ChannelSequence[] {
    const channelSequence: ChannelSequence[] = [];

    for (let j = 0; j < length; j++) {
        const byteIndex = Math.floor(j / 4);
        const shift = (3 - (j % 4)) * 2;
        const value = (buffer[byteIndex] >> shift) & 0x03;
        channelSequence.push(channelFromValue(value));
    }

    return channelSequence;
}

function channelFromValue(value: number): ChannelSequence {
    switch (value) {
        case 0x0:
            return 'R';
        case 0x1:
            return 'G';
        case 0x2:
            return 'B';
        default:
            return 'R'; // Default fallback
    }
}

function deserializeChecksum(buffer: Buffer, offset: number): string {
    const checksumLength = buffer.readUInt16BE(offset);
    offset += 2;

    const checksumBuffer = buffer.subarray(offset, offset + checksumLength);
    return checksumBuffer.toString('hex');
}
