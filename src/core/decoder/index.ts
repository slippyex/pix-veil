import type { IDecodeOptions } from '../../@types/index.ts';
import { DecodeStateMachine } from './stateMachine.ts';

/**
 * Asynchronously decodes the input based on the specified options.
 *
 * @param {IDecodeOptions} options - The decoding options to configure the state machine.
 * @return {Promise<void>} A promise that resolves when the decoding process is complete.
 */
export async function decode(options: IDecodeOptions): Promise<void> {
    const stateMachine = new DecodeStateMachine(options);
    await stateMachine.run();
}
