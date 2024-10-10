// src/utils/cache/cacheHelper.ts

/// <reference lib="deno.unstable" />

import * as path from 'jsr:@std/path';
import { findProjectRoot } from '../storage/storageUtils.ts';
import openKv = Deno.openKv;

let kv: Deno.Kv;

/**
 * Initializes and returns a Deno KV store instance.
 *
 * @return {Promise<Deno.Kv>} The initialized KV store.
 */
async function initializeKvStore(): Promise<Deno.Kv> {
    const rootDirectory = findProjectRoot(Deno.cwd());
    return await openKv(path.join(rootDirectory as string, 'deno-kv', 'pix-veil.db'));
}

/**
 * Retrieves a value from Deno KV by key.
 *
 * @param {string} namespace - The namespace for the cache key.
 * @param {string} key - The key to retrieve.
 * @return {Promise<T>} - The cached value, or null if not found.
 */
export async function getCacheValue<T>(namespace: string, key: string): Promise<T | null> {
    if (!kv) kv = await initializeKvStore();
    const { value } = await kv.get<T>([namespace, key]);
    return value;
}

/**
 * Stores a value in Deno KV with the given key.
 *
 * @param {string} namespace - The namespace for the cache key.
 * @param {string} key - The key to store.
 * @param {T} value - The value to store.
 * @return {Promise<void>} - Resolves when the value is stored.
 */
export async function setCacheValue<T>(namespace: string, key: string, value: T): Promise<void> {
    if (!kv) kv = await initializeKvStore();
    await kv.set([namespace, key], value);
}

/**
 * Constructs a unique cache key using the full path and file size.
 *
 * @param {string} filePath - The full path to the file.
 * @param {number} fileSize - The size of the file in bytes.
 * @return {string} - The constructed cache key.
 */
export function createCacheKey(filePath: string, fileSize: number): string {
    return `${filePath}:${fileSize}`;
}

/**
 * Closes the Deno KV store.
 *
 * @return {void}
 */
export function closeKv(): void {
    if (kv) kv.close();
}
