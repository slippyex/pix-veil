import type { ILogger } from '../../src/@types/index.ts';

export class MockLogger implements ILogger {
    debugMessages: string[] = [];
    errorMessages: string[] = [];
    verbose: boolean;

    constructor(verbose: boolean = false) {
        this.verbose = verbose;
    }

    info(_message: string): void {}
    success(_message: string): void {}
    warn(_message: string): void {}
    error(message: string): void {
        this.errorMessages.push(message);
    }
    debug(message: string): void {
        if (this.verbose) {
            this.debugMessages.push(message);
        }
    }
}
