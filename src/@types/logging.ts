export interface ILogger {
    debugMessages: string[];
    errorMessages: string[];
    readonly verbose: boolean;

    info(message: string): void;

    success(message: string): void;

    warn(message: string): void;

    error(message: string): void;

    debug(message: string): void;
}

export interface ILogFacility {
    log(...input: unknown[]): void;
    warn(...input: unknown[]): void;
    error(...input: unknown[]): void;
}
