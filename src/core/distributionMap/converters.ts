import { ChannelSequence, SupportedCompressionStrategies } from '../../@types/index.ts';

/**
 * Returns the numerical value associated with the specified channel.
 *
 * @param {ChannelSequence} channel - The channel for which the numerical value is needed.
 * Possible values are 'R', 'G', 'B', 'A'.
 *
 * @return {number} The numerical value corresponding to the specified channel.
 * @throws Will throw an error if the channel value is invalid.
 */
export function channelValue(channel: ChannelSequence): number {
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
            throw new Error(`Invalid channel value: ${channel}`);
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

/**
 * Converts a numeric compression strategy value back to its corresponding enum.
 *
 * @param {number} value - The numeric value representing the compression strategy.
 * @returns {SupportedCompressionStrategies} - The corresponding compression strategy.
 */
export function valueToCompressionStrategy(value: number): SupportedCompressionStrategies {
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
 * Converts a SupportedCompressionStrategies enum to its corresponding numeric value.
 *
 * @param {SupportedCompressionStrategies} strategy - The compression strategy to convert.
 * @returns {number} - The numeric value representing the compression strategy.
 */
export function compressionStrategyToValue(strategy: SupportedCompressionStrategies): number {
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
