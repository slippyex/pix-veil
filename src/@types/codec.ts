// src/@types/codec.ts

import { ILogger } from './logging.ts';

export interface IEncodeOptions {
    inputFile: string;
    inputPngFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    debugVisual: boolean;
    logger: ILogger;
    verify?: boolean;
    progressBar?: IProgressBar;
}

export interface IDecodeOptions {
    inputFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    logger: ILogger;
    progressBar?: IProgressBar;
}

export interface IProgressBar {
    start(steps: number, start: number): void;
    stop(): void;
    increment(payload?: Record<string, unknown>): void;
}
