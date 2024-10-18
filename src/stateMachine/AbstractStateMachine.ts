// src/stateMachine/AbstractStateMachine.ts

import type { ILogger, IProgressBar } from '../@types/index.ts';

interface IStateMachineOptions {
    logger: ILogger;
    verbose: boolean;
    progressBar?: IProgressBar;
}

export abstract class AbstractStateMachine<S, O extends IStateMachineOptions> {
    protected state: S;
    protected readonly options: O;
    protected stateTransitions: Array<{ state: S; handler: () => Promise<void> | void }>;

    protected constructor(initialState: S, options: O) {
        this.state = initialState;
        this.options = options;
        this.stateTransitions = [];
    }

    /**
     * Executes a series of state transitions defined in `stateTransitions`.
     * Iterates through each transition, updating the state and invoking the corresponding handler.
     * Optionally updates a progress bar if enabled in the options.
     * Handles errors by transitioning to the error state and invoking an error handler.
     *
     * @return {Promise<void>} Resolves when all state transitions and their handlers have completed, or after handling an error.
     */
    async run(): Promise<void> {
        try {
            for (const transition of this.stateTransitions) {
                this.transitionTo(transition.state);
                await transition.handler.bind(this)();
            }
            if (this.options.progressBar) {
                this.options.progressBar.increment({ state: 'COMPLETE' });
            }
            this.transitionTo(this.getCompletionState());
        } catch (error) {
            this.transitionTo(this.getErrorState(), error as Error);
            this.handleError(error as Error);
        }
    }

    /**
     * Handles the state transition for an object. If an error state is encountered,
     * logs the error and transitions to the error state. Otherwise, logs the state
     * transition (if verbose mode is enabled) and changes the state to the next state.
     *
     * @param {S} nextState - The next state to transition to.
     * @param {Error} [error] - An optional error that, if provided and the next state
     *                          is an error state, will be logged.
     * @return {void}
     */
    protected transitionTo(nextState: S, error?: Error): void {
        const { logger } = this.options;
        if (nextState === this.getErrorState() && error) {
            logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = this.getErrorState();
        } else {
            if (this.options.verbose) {
                logger.debug(`STATE :: Transitioning from state "${this.state}" -> "${nextState}"`);
            }
            if (this.options.progressBar) {
                this.options.progressBar.increment({ state: nextState });
            }
            this.state = nextState;
        }
    }

    /**
     * Handles errors by logging the error message and re-throwing the error.
     *
     * @param {Error} error - The error object that needs to be handled.
     *
     * @return {void}
     */
    protected handleError(error: Error): void {
        const { logger } = this.options;
        if (this.options.progressBar) {
            console.error(`\n\nFailed reason :: ${this.getErrorState()} failed: ${error.message}`);
        } else {
            logger.error(`${this.getErrorState()} failed: ${error.message}`);
        }
        throw error;
    }

    protected abstract getCompletionState(): S;
    protected abstract getErrorState(): S;
}
