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

/** Always true: the app only talks to Appwrite. */
export const useAppwrite = true;
