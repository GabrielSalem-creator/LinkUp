import Constants from 'expo-constants';

type Extra = {
  appwriteEndpoint?: string;
  appwriteProjectId?: string;
  appwriteDatabaseId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  appwriteEndpoint:
    process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ||
    extra.appwriteEndpoint ||
    'https://fra.cloud.appwrite.io/v1',
  appwriteProjectId:
    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ||
    extra.appwriteProjectId ||
    '6a61202f000e451a56a8',
  appwriteDatabaseId:
    process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ||
    extra.appwriteDatabaseId ||
    'linkup',
};

/** True when a project ID is set (Appwrite mode). Set EXPO_PUBLIC_USE_MOCK=1 to force mock. */
export const useAppwrite =
  process.env.EXPO_PUBLIC_USE_MOCK !== '1' && Boolean(config.appwriteProjectId);
