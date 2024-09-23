// src/utils/steganography.ts
import sharp from 'sharp';

/**
 * Embeds multiple chunks of data into an image using LSB steganography.
 * Each chunk is embedded in a specified tonal area (dark, midtone, light).
 * @param imagePath Path to the PNG image.
 * @param dataChunks Array of Buffers, each representing a data chunk to embed.
 * @param tonalAreas Array specifying the tonal area for each chunk.
 * @returns Modified raw pixel data as a Buffer.
 */
export const embedChunksLSB = async (
    imagePath: string,
    dataChunks: Buffer[],
    tonalAreas: ('dark' | 'midtone' | 'light')[]
): Promise<Buffer> => {
    const image = sharp(imagePath);
    const { data: imgData, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const modifiedData = Buffer.from(imgData); // Make a copy

    // Collect pixel indices for each tonal area
    const tonalAreaIndices: { [key: string]: number[] } = {
        'dark': [],
        'midtone': [],
        'light': [],
    };

    for (let i = 0; i < info.width * info.height; i++) {
        const r = imgData[i * info.channels];
        const g = imgData[i * info.channels + 1];
        const b = imgData[i * info.channels + 2];
        const brightness = Math.round((0.299 * r + 0.587 * g + 0.114 * b));

        if (brightness < 85) {
            tonalAreaIndices['dark'].push(i);
        } else if (brightness < 170) {
            tonalAreaIndices['midtone'].push(i);
        } else {
            tonalAreaIndices['light'].push(i);
        }
    }

    // Iterate over each chunk to embed
    for (let chunkIdx = 0; chunkIdx < dataChunks.length; chunkIdx++) {
        const chunk = dataChunks[chunkIdx];
        const tonalArea = tonalAreas[chunkIdx];

        const pixelIndices = tonalAreaIndices[tonalArea];
        if (!pixelIndices || pixelIndices.length === 0) {
            throw new Error(`No pixels found in tonal area: ${tonalArea}`);
        }

        let bitPointer = 0;
        const totalBits = chunk.length * 8;

        for (let bit = 0; bit < totalBits; bit++) {
            const byteIdx = Math.floor(bit / 8);
            const bitIdx = 7 - (bit % 8); // Embed bits from MSB to LSB

            const bitValue = (chunk[byteIdx] >> bitIdx) & 1;

            const pixelIdx = pixelIndices[bit % pixelIndices.length];
            const channel = bit % info.channels; // Cycle through channels

            modifiedData[pixelIdx * info.channels + channel] =
                (modifiedData[pixelIdx * info.channels + channel] & 0xFE) | bitValue;

            bitPointer++;
            if (bitPointer >= totalBits) break;
        }
    }

    return modifiedData;
};

/**
 * Extracts multiple chunks of data from an image using LSB steganography.
 * @param imagePath Path to the PNG image.
 * @param numberOfChunks Number of data chunks to extract.
 * @param chunkSizes Array specifying the size of each chunk in bytes.
 * @param tonalAreas Array specifying the tonal area for each chunk.
 * @returns Array of Buffers, each representing an extracted data chunk.
 */
export const extractChunksLSB = async (
    imagePath: string,
    numberOfChunks: number,
    chunkSizes: number[],
    tonalAreas: ('dark' | 'midtone' | 'light')[]
): Promise<Buffer[]> => {
    const image = sharp(imagePath);
    const { data: imgData, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const extractedChunks: Buffer[] = [];

    // Collect pixel indices for each tonal area
    const tonalAreaIndices: { [key: string]: number[] } = {
        'dark': [],
        'midtone': [],
        'light': [],
    };

    for (let i = 0; i < info.width * info.height; i++) {
        const r = imgData[i * info.channels];
        const g = imgData[i * info.channels + 1];
        const b = imgData[i * info.channels + 2];
        const brightness = Math.round((0.299 * r + 0.587 * g + 0.114 * b));

        if (brightness < 85) {
            tonalAreaIndices['dark'].push(i);
        } else if (brightness < 170) {
            tonalAreaIndices['midtone'].push(i);
        } else {
            tonalAreaIndices['light'].push(i);
        }
    }

    for (let chunkIdx = 0; chunkIdx < numberOfChunks; chunkIdx++) {
        const chunkSize = chunkSizes[chunkIdx];
        const tonalArea = tonalAreas[chunkIdx];

        const pixelIndices = tonalAreaIndices[tonalArea];
        if (!pixelIndices || pixelIndices.length === 0) {
            throw new Error(`No pixels found in tonal area: ${tonalArea}`);
        }

        const chunk = Buffer.alloc(chunkSize, 0);

        let bitPointer = 0;
        const totalBits = chunkSize * 8;

        for (let bit = 0; bit < totalBits; bit++) {
            const byteIdx = Math.floor(bit / 8);
            const bitIdx = 7 - (bit % 8); // Extract bits from MSB to LSB

            const pixelIdx = pixelIndices[bit % pixelIndices.length];
            const channel = bit % info.channels; // Cycle through channels

            const bitValue = imgData[pixelIdx * info.channels + channel] & 1;
            chunk[byteIdx] |= bitValue << bitIdx;

            bitPointer++;
            if (bitPointer >= totalBits) break;
        }

        extractedChunks.push(chunk);
    }

    return extractedChunks;
};
