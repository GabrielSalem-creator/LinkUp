/**
 * Calls the privileged `linkup-api` Appwrite Function. The session is attached by the SDK;
 * the function reads x-appwrite-user-id and verifies app-admin membership server-side.
 */
import { ExecutionMethod, Functions, Teams } from 'appwrite';

import { client, restorePersistedSession } from '@/lib/appwrite';

export const FUNCTION_ID = 'linkup-api';
const functions = new Functions(client);
const teams = new Teams(client);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  constructor(status: number, code: string, message: string, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

const METHODS: Record<string, ExecutionMethod> = {
  GET: ExecutionMethod.GET,
  POST: ExecutionMethod.POST,
  PUT: ExecutionMethod.PUT,
  PATCH: ExecutionMethod.PATCH,
  DELETE: ExecutionMethod.DELETE,
};

export async function callApi<T = unknown>(method: keyof typeof METHODS, path: string, body?: unknown): Promise<T> {
  await restorePersistedSession();
  let exec;
  try {
    exec = await functions.createExecution({
      functionId: FUNCTION_ID,
      xpath: path,
      method: METHODS[method],
      body: body == null ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const err = e as { code?: number; message?: string };
    throw new ApiError(err.code ?? 0, 'network', err.message || 'Could not reach the server');
  }
  if (exec.status === 'failed' && !exec.responseBody) {
    throw new ApiError(500, 'execution_failed', exec.errors || 'Server execution failed');
  }
  let parsed: unknown = null;
  try {
    parsed = exec.responseBody ? JSON.parse(exec.responseBody) : null;
  } catch {
    parsed = null;
  }
  if (exec.responseStatusCode >= 400 || !exec.responseStatusCode) {
    const p = (parsed ?? {}) as { error?: string; code?: string; correlation_id?: string };
    throw new ApiError(exec.responseStatusCode || 500, p.code || 'error', p.error || `Request failed (${exec.responseStatusCode})`, p.correlation_id);
  }
  return parsed as T;
}

export type ServerConfig = {
  competition_enabled: boolean;
  checkout_enabled: boolean;
  provider: string;
  test_mode: boolean;
  refunds_enabled: boolean;
  hold_ttl_seconds: number;
  currency: string;
  email_delivery: string;
};

export const serverApi = {
  config: () => callApi<ServerConfig>('GET', '/config'),
  me: () => callApi<{ user_id: string | null; is_app_admin: boolean }>('GET', '/me'),
  /** Cheap client-side hint only; the server re-checks membership on every privileged call. */
  async isAppAdmin(): Promise<boolean> {
    try {
      await restorePersistedSession();
      const res = await teams.list();
      return res.teams.some((t) => t.$id === 'app-admins');
    } catch {
      return false;
    }
  },
};
