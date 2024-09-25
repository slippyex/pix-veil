// src/mapHelpers.ts
import { ChannelSequence, DistributionMap, DistributionMapEntry } from '../@types/types';
import { MAGIC_BYTE } from '../constants/MagicBytes';

/**
 * Serializes the distribution map into a buffer with Magic Byte and Size Field.
 * @param distributionMap - The DistributionMap object to serialize.
 * @returns Buffer containing the serialized distribution map.
 */
export function serializeDistributionMap(distributionMap: DistributionMap): Buffer {
    const mapBufferArray: Buffer[] = [];
    // Serialize the distribution map entries and checksum
    const entryCountBuffer = Buffer.alloc(4);
    entryCountBuffer.writeUInt32BE(distributionMap.entries.length, 0);
    mapBufferArray.push(entryCountBuffer);
    for (const entry of distributionMap.entries) {
        const entryBufferArray: Buffer[] = [];
        // Chunk ID (4 bytes)
        const chunkIdBuffer = Buffer.alloc(4);
        chunkIdBuffer.writeUInt32BE(entry.chunkId, 0);
        entryBufferArray.push(chunkIdBuffer);
        // File Name Length (2 bytes) and File Name
        const fileNameBuffer = Buffer.from(entry.pngFile, 'utf-8');
        const fileNameLengthBuffer = Buffer.alloc(2);
        fileNameLengthBuffer.writeUInt16BE(fileNameBuffer.length, 0);
        entryBufferArray.push(fileNameLengthBuffer, fileNameBuffer);
        // Start Position (4 bytes) and End Position (4 bytes)
        const startBuffer = Buffer.alloc(4);
        startBuffer.writeUInt32BE(entry.startPosition, 0);
        const endBuffer = Buffer.alloc(4);
        endBuffer.writeUInt32BE(entry.endPosition, 0);
        entryBufferArray.push(startBuffer, endBuffer);
        // Bits Per Channel (1 byte)
        const bitsPerChannelBuffer = Buffer.alloc(1);
        bitsPerChannelBuffer.writeUInt8(entry.bitsPerChannel, 0);
        entryBufferArray.push(bitsPerChannelBuffer);
        // Channel Sequence Length (1 byte)
        const channelSeqLengthBuffer = Buffer.alloc(1);
        channelSeqLengthBuffer.writeUInt8(entry.channelSequence.length, 0);
        entryBufferArray.push(channelSeqLengthBuffer);
        // Channel Sequence (packed into bytes, 2 bits per channel)
        const channelSeqBuffer = Buffer.alloc(Math.ceil(entry.channelSequence.length / 4)); // 2 bits per channel, 4 channels per byte
        entry.channelSequence.forEach((channel, index) => {
            const shift = (3 - (index % 4)) * 2; // 2 bits per channel
            let value = 0;
            switch (channel) {
                case 'R':
                    value = 0x0;
                    break;
                case 'G':
                    value = 0x1;
                    break;
                case 'B':
                    value = 0x2;
                    break;
                default:
                    value = 0x0; // Default fallback to 'R'
            }
            channelSeqBuffer[Math.floor(index / 4)] |= value << shift;
        });
        entryBufferArray.push(channelSeqBuffer);
        // Concatenate entry buffers
        mapBufferArray.push(Buffer.concat(entryBufferArray));
    }
    // Serialize checksum
    const checksumBuffer = Buffer.from(distributionMap.checksum, 'hex');
    const checksumLengthBuffer = Buffer.alloc(2);
    checksumLengthBuffer.writeUInt16BE(checksumBuffer.length, 0);
    mapBufferArray.push(checksumLengthBuffer, checksumBuffer);
    const mapContent = Buffer.concat(mapBufferArray);
    // Prefix with Magic Byte
    const magicBuffer = MAGIC_BYTE;
    // Prefix with Size Field (4 bytes indicating the size of mapContent)
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(mapContent.length, 0);
    // Combine Magic Byte, Size Field, and Content
    const serializedMap = Buffer.concat([magicBuffer, sizeBuffer, mapContent]);
    return serializedMap;
}

/**
 * Deserializes the distribution map buffer into a DistributionMap object.
 * Expects the buffer to start with MAGIC_BYTE followed by SIZE and then CONTENT.
 * @param buffer - Buffer containing the serialized distribution map.
 * @returns Parsed DistributionMap object.
 */
export function deserializeDistributionMap(buffer: Buffer): DistributionMap {
    const magicLength = MAGIC_BYTE.length;
    // Verify Magic Byte at the start
    if (!buffer.subarray(0, magicLength).equals(MAGIC_BYTE)) {
        throw new Error('Magic bytes not found at the start of the distribution map.');
    }
    // Read Size Field (next 4 bytes)
    if (buffer.length < magicLength + 4) {
        throw new Error('Size field missing in the distribution map.');
    }
    const size = buffer.readUInt32BE(magicLength);
    // Read Content based on Size
    if (buffer.length < magicLength + 4 + size) {
        throw new Error('Incomplete distribution map content.');
    }
    const mapContent = buffer.subarray(magicLength + 4, magicLength + 4 + size);
    const entries: DistributionMapEntry[] = [];
    let offset = 0;
    // Read Entry Count (4 bytes)
    if (offset + 4 > mapContent.length) throw new Error('Invalid distribution map format: Entry count missing.');
    const entryCount = mapContent.readUInt32BE(offset);
    offset += 4;
    for (let i = 0; i < entryCount; i++) {
        // Read Chunk ID (4 bytes)
        if (offset + 4 > mapContent.length)
            throw new Error(`Invalid distribution map format: Chunk ID missing for entry ${i + 1}.`);
        const chunkId = mapContent.readUInt32BE(offset);
        offset += 4;
        // Read File Name Length (2 bytes)
        if (offset + 2 > mapContent.length)
            throw new Error(`Invalid distribution map format: File name length missing for entry ${i + 1}.`);
        const fileNameLength = mapContent.readUInt16BE(offset);
        offset += 2;
        // Read File Name
        if (offset + fileNameLength > mapContent.length)
            throw new Error(`Invalid distribution map format: File name missing for entry ${i + 1}.`);
        const fileName = mapContent.subarray(offset, offset + fileNameLength).toString('utf-8');
        offset += fileNameLength;
        // Read Start Position (4 bytes) and End Position (4 bytes)
        if (offset + 8 > mapContent.length)
            throw new Error(`Invalid distribution map format: Start/End positions missing for entry ${i + 1}.`);
        const startPosition = mapContent.readUInt32BE(offset);
        offset += 4;
        const endPosition = mapContent.readUInt32BE(offset);
        offset += 4;
        // Read Bits Per Channel (1 byte)
        if (offset + 1 > mapContent.length)
            throw new Error(`Invalid distribution map format: Bits per channel missing for entry ${i + 1}.`);
        const bitsPerChannel = mapContent.readUInt8(offset);
        offset += 1;
        // Read Channel Sequence Length (1 byte)
        if (offset + 1 > mapContent.length)
            throw new Error(`Invalid distribution map format: Channel sequence length missing for entry ${i + 1}.`);
        const channelSeqLength = mapContent.readUInt8(offset);
        offset += 1;
        // Read Channel Sequence (packed into bytes, 2 bits per channel)
        const channelSeqBytes = Math.ceil(channelSeqLength / 4); // 2 bits per channel, 4 channels per byte
        if (offset + channelSeqBytes > mapContent.length)
            throw new Error(`Invalid distribution map format: Channel sequence missing for entry ${i + 1}.`);
        const channelSeqBuffer = mapContent.subarray(offset, offset + channelSeqBytes);
        offset += channelSeqBytes;
        const channelSequence: ChannelSequence[] = [];
        for (let j = 0; j < channelSeqLength; j++) {
            const byteIndex = Math.floor(j / 4);
            const shift = (3 - (j % 4)) * 2;
            const value = (channelSeqBuffer[byteIndex] >> shift) & 0x03;
            switch (value) {
                case 0x0:
                    channelSequence.push('R');
                    break;
                case 0x1:
                    channelSequence.push('G');
                    break;
                case 0x2:
                    channelSequence.push('B');
                    break;
                default:
                    channelSequence.push('R'); // Default fallback
            }
        }
        entries.push({
            chunkId,
            pngFile: fileName,
            startPosition,
            endPosition,
            bitsPerChannel,
            channelSequence
        });
    }
    // Read Checksum Length (2 bytes)
    if (offset + 2 > mapContent.length) throw new Error('Invalid distribution map format: Checksum length missing.');
    const checksumLength = mapContent.readUInt16BE(offset);
    offset += 2;
    // Read Checksum
    if (offset + checksumLength > mapContent.length)
        throw new Error('Invalid distribution map format: Checksum missing.');
    const checksumBuffer = mapContent.subarray(offset, offset + checksumLength);
    const checksum = checksumBuffer.toString('hex');
    offset += checksumLength;
    return { entries, checksum };
}
