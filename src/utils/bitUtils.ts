// src/utils/bitUtils.ts

import { ChannelSequence } from '../@types';

/**
 * Extracts a specific number of bits from a byte.
 * @param byte - The byte to extract bits from.
 * @param startBit - The starting bit position (0-7).
 * @param bitCount - Number of bits to extract.
 * @returns The extracted bits as a number.
 */
export function extractBits(byte: number, startBit: number, bitCount: number): number {
    const mask = (1 << bitCount) - 1;
    return (byte >> startBit) & mask;
}

/**
 * Inserts bits into a byte at a specific position.
 * @param byte - The original byte.
 * @param bits - The bits to insert.
 * @param startBit - The starting bit position (0-7).
 * @param bitCount - Number of bits to insert.
 * @returns The modified byte with bits inserted.
 */
export function insertBits(byte: number, bits: number, startBit: number, bitCount: number): number {
    const mask = ((1 << bitCount) - 1) << startBit;
    return (byte & ~mask) | ((bits << startBit) & mask);
}

/**
 * Converts a channel sequence array to a packed buffer.
 * @param channelSequence - Array of ChannelSequence.
 * @returns Buffer containing packed channel sequence.
 */
export function serializeChannelSequence(channelSequence: ChannelSequence[]): Buffer {
    const packedLength = Math.ceil(channelSequence.length / 4);
    const channelSeqBuffer = Buffer.alloc(packedLength, 0);

    channelSequence.forEach((channel, index) => {
        const shift = (3 - (index % 4)) * 2;
        const value = channelToValue(channel);
        channelSeqBuffer[Math.floor(index / 4)] |= value << shift;
    });

    return channelSeqBuffer;
}

/**
 * Converts a packed buffer to a channel sequence array.
 * @param buffer - Buffer containing packed channel sequence.
 * @param length - Number of channels to extract.
 * @returns Array of ChannelSequence.
 */
export function deserializeChannelSequence(buffer: Buffer, length: number): ChannelSequence[] {
    const channelSequence: ChannelSequence[] = [];

    for (let j = 0; j < length; j++) {
        const byteIndex = Math.floor(j / 4);
        const shift = (3 - (j % 4)) * 2;
        const value = (buffer[byteIndex] >> shift) & 0x03;
        channelSequence.push(valueToChannel(value));
    }

    return channelSequence;
}

function channelToValue(channel: ChannelSequence): number {
    switch (channel) {
        case 'R':
            return 0x0;
        case 'G':
            return 0x1;
        case 'B':
            return 0x2;
        case 'A':
            return 0x3;
        default:
            throw new Error(`Invalid channel: ${channel}`);
    }
}

function valueToChannel(value: number): ChannelSequence {
    switch (value) {
        case 0x0:
            return 'R';
        case 0x1:
            return 'G';
        case 0x2:
            return 'B';
        case 0x3:
            return 'A';
        default:
            throw new Error(`Invalid channel value: ${value}`);
    }
}
