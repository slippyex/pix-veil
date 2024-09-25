// shared/utils/Logger.ts

import chalk from 'chalk';

export class Logger {
    public debugMessages: string[] = [];
    public errorMessages: string[] = [];

    constructor(private readonly verbose = false) {}

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
