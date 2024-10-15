import { findProjectRoot } from '../storage/storageUtils.ts';
import openKv = Deno.openKv;
import * as path from 'jsr:@std/path';

let kv: Deno.Kv;

/**
 * Initializes and returns a Deno KV store instance.
 *
 * @return {Promise<Deno.Kv>} The initialized KV store.
 */
async function initializeKvStore(): Promise<Deno.Kv> {
    const rootDirectory = findProjectRoot(Deno.cwd());
    // if (Deno.env.get('ENVIRONMENT') === 'test') {
    //     return await openKv(':memory:');
    // } else {
    //     return await openKv(path.join(rootDirectory as string, 'deno-kv', 'pix-veil.db'));
    // }
    return await openKv(path.join(rootDirectory as string, 'deno-kv', 'pix-veil.db'));
}

export function closeKv() {
    kv.close();
}

export async function getEntryFromCache<T>(namespace: string, key: string) {
    if (!kv) {
        kv = await initializeKvStore();
    }
    const { value } = await kv.get<T>([namespace, key]);
    return value;
}

export async function setCacheEntry(namespace: string, key: string, value: unknown) {
    if (!kv) {
        kv = await initializeKvStore();
    }
    await kv.set([namespace, key], value);
}
