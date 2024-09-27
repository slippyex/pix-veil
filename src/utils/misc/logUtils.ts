// src/utils/misc/logUtils.ts

import chalk from 'chalk';
import { ILogger } from '../../@types';

const loggerMap: Record<string, ILogger> = {};

class Logger implements ILogger {
    debugMessages: string[] = [];
    errorMessages: string[] = [];

    constructor(
        readonly name: string,
        readonly verbose = false
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

export function getLogger(name: string, verbose = false) {
    const logger = loggerMap[name];
    if (!logger) {
        loggerMap[name] = new Logger(name, verbose);
    }
    return loggerMap[name];
}
