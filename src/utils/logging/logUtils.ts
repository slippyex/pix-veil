// src/utils/logging/logUtils.ts

import type { ILogFacility, ILogger } from '../../@types/index.ts';

import chalk from 'chalk';

const loggerMap: Record<string, ILogger> = {};

export const NoopLogFacility: ILogFacility = {
    log: (..._input: unknown[]): void => {},
    warn: (..._input: unknown[]): void => {},
    error: (..._input: unknown[]): void => {},
};

/**
 * Logger class that implements ILogger interface to log messages at various levels such as info, success, warning, error, and debug.
 */
class Logger implements ILogger {
    infoMessages: string[] = [];
    debugMessages: string[] = [];
    warnMessages: string[] = [];
    errorMessages: string[] = [];
    successMessages: string[] = [];

    constructor(
        readonly name: string,
        readonly logger: ILogFacility,
        readonly verbose = false,
    ) {}

    info(message: string) {
        const msg = chalk.blue(`[INFO] ${this.name} :: ${message}`);
        this.logger.log(msg);
        this.infoMessages.push(msg);
    }

    success(message: string) {
        const msg = chalk.green(`[SUCCESS] ${this.name} :: ${message}`);
        this.logger.log(msg);
        this.successMessages.push(msg);
    }

    warn(message: string) {
        const msg = chalk.yellow(`[WARNING] ${this.name} :: ${message}`);
        this.logger.warn(msg);
        this.warnMessages.push(msg);
    }

    error(message: string) {
        const msg = chalk.red(`[ERROR] ${this.name} :: ${message}`);
        this.logger.error(msg);
        this.errorMessages.push(message);
    }

    debug(message: string) {
        const msg = chalk.magenta(`[DEBUG] ${this.name} :: ${message}`);
        if (this.verbose) {
            this.logger.log(msg);
        }
        this.debugMessages.push(message);
    }
}

/**
 * Retrieves logger by name. If the logger does not already exist, it creates a new one.
 *
 * @param {string} name - The name identifier for the logger.
 * @param {ILogFacility} [logFacility=console] - The log facility where logs will be sent.
 * @param {boolean} [verbose=false] - Optional flag to enable verbose logging.
 * @return {Logger} The logger instance associated with the provided name.
 */
export function getLogger(
    name: string,
    logFacility: ILogFacility = console as ILogFacility,
    verbose: boolean = false,
): ILogger {
    const logger = loggerMap[name];
    if (!logger) {
        loggerMap[name] = new Logger(name, logFacility, verbose);
    }
    return loggerMap[name];
}
