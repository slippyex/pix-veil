// src/utils/logging/logUtils.ts

import type { ILogger } from '../../@types/index.ts';

import chalk from 'chalk';

const loggerMap: Record<string, ILogger> = {};

/**
 * Logger class that implements ILogger interface to log messages at various levels such as info, success, warning, error, and debug.
 */
class Logger implements ILogger {
    debugMessages: string[] = [];
    errorMessages: string[] = [];

    constructor(
        readonly name: string,
        readonly verbose = false,
    ) {}

    info(message: string) {
        console.log(chalk.blue(`[INFO] ${this.name} :: ${message}`));
    }

    success(message: string) {
        console.log(chalk.green(`[SUCCESS] ${this.name} :: ${message}`));
    }

    warn(message: string) {
        console.warn(chalk.yellow(`[WARNING] ${this.name} :: ${message}`));
    }

    error(message: string) {
        console.error(chalk.red(`[ERROR] ${this.name} :: ${message}`));
        this.errorMessages.push(message);
    }

    debug(message: string) {
        if (this.verbose) {
            console.log(chalk.magenta(`[DEBUG] ${this.name} :: ${message}`));
        }
        this.debugMessages.push(message);
    }
}

/**
 * Retrieves or creates a logger instance associated with the given name.
 *
 * @param name - The name associated with the logger instance.
 * @param verbose - verbose logging enabled
 * @return The logger instance associated with the provided name.
 */
export function getLogger(name: string, verbose = false) {
    const logger = loggerMap[name];
    if (!logger) {
        loggerMap[name] = new Logger(name, verbose);
    }
    return loggerMap[name];
}
