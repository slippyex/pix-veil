// src/core/encoder/index.ts

import type { IEncodeOptions } from '../../@types/index.ts';

import { EncodeStateMachine } from './stateMachine.ts';

/**
 * Encodes data using a state machine based on provided options.
 *
 * @param {IEncodeOptions} options - The options to configure the encoding process.
 * @return {Promise<void>} A promise that resolves when the encoding is complete.
 */
export async function encode(options: IEncodeOptions): Promise<void> {
    const stateMachine = new EncodeStateMachine(options);
    await stateMachine.run();
}
