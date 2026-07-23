/**
 * Unified data layer.
 * Uses Appwrite when EXPO_PUBLIC_APPWRITE_PROJECT_ID is set (default).
 * Force mock with EXPO_PUBLIC_USE_MOCK=1.
 */

import { appwriteApi } from '@/lib/api.appwrite';
import { mockApi } from '@/lib/api.mock';
import { useAppwrite } from '@/lib/config';

export const api = useAppwrite ? appwriteApi : mockApi;

export const isAppwriteMode = useAppwrite;
