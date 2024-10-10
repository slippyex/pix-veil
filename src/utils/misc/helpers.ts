// src/utils/misc/helpers.ts

import { ChannelSequence, ILogger } from '../../@types/index.ts';

/**
 * Selects a weighted random choice from an array of objects containing weight and tone.
 *
 * @param {Array<{ weight: number; tone: 'low' | 'mid' | 'high' }>} choices - The array of choice objects where each object has a weight and tone.
 * @param {ILogger} logger - Logger for debugging the selection process.
 * @return {'low' | 'mid' | 'high'} - The randomly selected tone based on the provided weights.
 */
export function weightedRandomChoice(
    choices: Array<{ weight: number; tone: 'low' | 'mid' | 'high' }>,
    logger: ILogger,
): 'low' | 'mid' | 'high' {
    const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    for (const choice of choices) {
        cumulative += choice.weight;
        if (random < cumulative) {
            logger.debug(`Weighted random choice selected tone "${choice.tone}" with weight ${choice.weight}.`);
            return choice.tone;
        }
    }
    // Fallback
    const fallback = choices[choices.length - 1].tone;
    logger.debug(`Weighted random choice fallback to tone "${fallback}".`);
    return fallback;
}

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
