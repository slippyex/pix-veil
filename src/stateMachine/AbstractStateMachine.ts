// src/stateMachine/AbstractStateMachine.ts

import type { ILogger } from '../@types/index.ts';

interface IStateMachineOptions {
    logger: ILogger;
    verbose: boolean;
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

    protected transitionTo(nextState: S, error?: Error): void {
        const { logger } = this.options;
        if (nextState === this.getErrorState() && error) {
            logger.error(`Error occurred during "${this.state}": ${error.message}`);
            this.state = this.getErrorState();
        } else {
            if (this.options.verbose) {
                logger.debug(`STATE :: Transitioning from state "${this.state}" -> "${nextState}"`);
            }
            this.state = nextState;
        }
    }

    protected handleError(error: Error): void {
        const { logger } = this.options;
        logger.error(`${this.getErrorState()} failed: ${error.message}`);
        throw error;
    }

    protected abstract getCompletionState(): S;
    protected abstract getErrorState(): S;
}
