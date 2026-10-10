/**
 * Data layer: Appwrite only. There is no offline/mock mode.
 */
import { appwriteApi } from '@/lib/api.appwrite';

export const isAppwriteMode = true;
export const api = appwriteApi;
