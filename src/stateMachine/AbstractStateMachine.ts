// src/stateMachine/AbstractStateMachine.ts

import { IDecodeOptions, IEncodeOptions } from '../@types/index.ts';

export abstract class AbstractStateMachine<S, O> {
    protected state: S;
    protected readonly options: O;
    protected stateTransitions: Array<{ state: S; handler: () => Promise<void> | void }>;

    protected constructor(initialState: S, options: O) {
        this.state = initialState;
        this.options = options;
        this.stateTransitions = [];
    }

    /**
     * Executes a series of state transitions defined in `this.stateTransitions`.
     * Each transition has an associated handler that is invoked asynchronously.
     * The method transitions to the appropriate completion or error state based on execution outcome.
     *
     * @return {Promise<void>} A promise that resolves when all state transitions and associated handlers have been executed.
     */
    async run(): Promise<void> {
        try {
            for (const transition of this.stateTransitions) {
                this.transitionTo(transition.state);
                await transition.handler.bind(this)();
            }
            this.transitionTo(this.getCompletionState());
        } catch (error) {
            this.transitionTo(this.getErrorState(), error as Error);
            this.handleError(error as Error);
        }
    }

    /**
     * Transitions the current state to the specified next state. If the next state
     * is an error state and an error object is provided, logs the error and sets
     * the current state to the error state. Otherwise, logs the state transition
     * and sets the current state to the next state.
     *
     * @param {S} nextState - The state to transition to.
     * @param {Error} [error] - Optional error object to log if transitioning to an error state.
     * @return {void}
     */
    protected transitionTo(nextState: S, error?: Error): void {
        const { logger } = this.options as IEncodeOptions | IDecodeOptions;
        if (nextState === this.getErrorState() && error) {
            logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = this.getErrorState();
        } else {
            logger.debug(`Transitioning from "${this.state}" to "${nextState}"`);
            this.state = nextState;
        }
    }

    /**
     * Handles error reporting and logs the error message.
     * This function extracts the logger from the options and logs
     * the error message with a specific error state.
     * It then rethrows the error.
     *
     * @param error The error object that needs to be handled.
     * @return void This method does not return any value.
     */
    protected handleError(error: Error): void {
        const { logger } = this.options as IEncodeOptions | IDecodeOptions;
        logger.error(`${this.getErrorState()} failed: ${error.message}`);
        throw error;
    }

    /**
     * Method to retrieve the current completion state.
     *
     * @return {S} The current completion state.
     */
    protected abstract getCompletionState(): S;

    /**
     * Retrieves the current error state.
     *
     * @return {S} The current error state.
     */
    protected abstract getErrorState(): S;
}
