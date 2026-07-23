/**
 * Unified data layer.
 * Uses Appwrite by default. Can fall back to mock (offline / auth failure).
 */

import { appwriteApi } from '@/lib/api.appwrite';
import { mockApi } from '@/lib/api.mock';
import { useAppwrite } from '@/lib/config';

let preferMock = false;

export function setPreferMock(value: boolean) {
  preferMock = value;
}

export function isPreferMock() {
  return preferMock;
}

export const isAppwriteMode = useAppwrite;

type ApiShape = typeof mockApi;

function resolveApi(): ApiShape {
  if (!useAppwrite || preferMock) return mockApi;
  return appwriteApi as unknown as ApiShape;
}

/** Always call through this — switches between Appwrite and mock. */
export const api: ApiShape = new Proxy({} as ApiShape, {
  get(_target, prop: keyof ApiShape) {
    const active = resolveApi();
    const value = active[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(active);
    }
    // nested namespaces: auth, clubs, events, ...
    if (value && typeof value === 'object') {
      return new Proxy(value as object, {
        get(ns, key) {
          const current = (resolveApi() as Record<string | symbol, unknown>)[prop] as Record<
            string | symbol,
            unknown
          >;
          const method = current?.[key];
          return typeof method === 'function' ? method.bind(current) : method;
        },
      });
    }
    return value;
  },
});
