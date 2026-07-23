/**
 * Always use Appwrite when configured.
 * Mock only if EXPO_PUBLIC_USE_MOCK=1.
 */

import { appwriteApi } from '@/lib/api.appwrite';
import { mockApi } from '@/lib/api.mock';
import { useAppwrite } from '@/lib/config';

export const isAppwriteMode = useAppwrite;

export const api = (useAppwrite ? appwriteApi : mockApi) as typeof mockApi;

/** @deprecated kept so old imports don't crash */
export function setPreferMock(_value: boolean) {
  /* no-op — we no longer force global mock mode */
}

export function isPreferMock() {
  return !useAppwrite;
}
