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
}

export interface IDecodeOptions {
    inputFolder: string;
    outputFolder: string;
    password: string;
    verbose: boolean;
    logger: ILogger;
}
