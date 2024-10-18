// src/utils/misc/lookups.ts

import { ChannelSequence } from '../../@types/index.ts';

/**
 * Helper function to get the channel offset based on the channel name.
 * @param channel - The channel name ('R', 'G', 'B', 'A').
 * @returns The channel offset index.
 */
export function getChannelOffset(channel: ChannelSequence): number {
    switch (channel) {
        case 'R':
            return 0;
        case 'G':
            return 1;
        case 'B':
            return 2;
        case 'A':
            return 3;
        default:
            throw new Error(`Invalid channel specified: ${channel}`);
    }
}

/**
 * Determines the channel sequence based on the provided numerical value.
 *
 * @param {number} value - The numerical value representing a color channel (0 for 'R', 1 for 'G', 2 for 'B', 3 for 'A').
 * @return {ChannelSequence} The channel sequence corresponding to the provided value.
 * @throws {Error} If the provided value does not correspond to a valid channel sequence.
 */
export function channelFromValue(value: number): ChannelSequence {
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
            throw new Error(`Invalid channel sequence value: ${value}`);
    }
}
