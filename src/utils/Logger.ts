// src/utils/Logger.ts

import chalk from 'chalk';
import { ILogger } from '../@types';

export class Logger implements ILogger {
    debugMessages: string[] = [];
    errorMessages: string[] = [];

    constructor(readonly verbose = false) {}

    info(message: string) {
        console.log(chalk.blue(`[INFO] ${message}`));
    }

    success(message: string) {
        console.log(chalk.green(`[SUCCESS] ${message}`));
    }

    warn(message: string) {
        console.warn(chalk.yellow(`[WARNING] ${message}`));
    }

    error(message: string) {
        console.error(chalk.red(`[ERROR] ${message}`));
        this.errorMessages.push(message);
    }

    debug(message: string) {
        if (this.verbose) {
            console.log(chalk.magenta(`[DEBUG] ${message}`));
        }
        this.debugMessages.push(message);
    }
}
