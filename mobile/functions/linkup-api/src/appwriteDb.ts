import { Client, Databases, Query, Teams, Users } from 'node-appwrite';

import { ConflictError, NotFoundError, type Db, type Doc, type ListOptions } from './db.ts';

export class AppwriteDb implements Db {
  private readonly databases: Databases;
  private readonly databaseId: string;
  constructor(client: Client, databaseId: string) {
    this.databases = new Databases(client);
    this.databaseId = databaseId;
  }

  async get(collection: string, id: string): Promise<Doc | null> {
    try {
      return (await this.databases.getDocument({ databaseId: this.databaseId, collectionId: collection, documentId: id })) as Doc;
    } catch (e) {
      if ((e as { code?: number }).code === 404) return null;
      throw e;
    }
  }

  async list(collection: string, opts: ListOptions = {}): Promise<Doc[]> {
    const base: string[] = [];
    for (const [field, op, value] of opts.where ?? []) {
      if (op === 'eq') base.push(Query.equal(field, value as never));
      else if (op === 'ne') base.push(Query.notEqual(field, value as never));
      else if (op === 'lt') base.push(Query.lessThan(field, value as never));
      else if (op === 'lte') base.push(Query.lessThanEqual(field, value as never));
      else if (op === 'gt') base.push(Query.greaterThan(field, value as never));
      else if (op === 'gte') base.push(Query.greaterThanEqual(field, value as never));
      else if (op === 'in') base.push(Query.equal(field, value as never));
    }
    for (const o of opts.orderBy ?? []) base.push(o.dir === 'asc' ? Query.orderAsc(o.field) : Query.orderDesc(o.field));
    const max = opts.limit ?? 5000;
    const out: Doc[] = [];
    let cursor: string | undefined;
    while (out.length < max) {
      const page = Math.min(100, max - out.length);
      const queries = [...base, Query.limit(page)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const res = await this.databases.listDocuments({ databaseId: this.databaseId, collectionId: collection, queries });
      out.push(...(res.documents as Doc[]));
      if (res.documents.length < page) break;
      cursor = res.documents[res.documents.length - 1].$id;
    }
    return out;
  }

  async create(collection: string, id: string, data: Record<string, unknown>, permissions?: string[]): Promise<Doc> {
    try {
      return (await this.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: collection,
        documentId: id,
        data,
        permissions,
      })) as Doc;
    } catch (e) {
      if ((e as { code?: number }).code === 409) throw new ConflictError(`Document ${collection}/${id} already exists`);
      throw e;
    }
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<Doc> {
    try {
      return (await this.databases.updateDocument({ databaseId: this.databaseId, collectionId: collection, documentId: id, data })) as Doc;
    } catch (e) {
      if ((e as { code?: number }).code === 404) throw new NotFoundError(`Document ${collection}/${id} not found`);
      throw e;
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      await this.databases.deleteDocument({ databaseId: this.databaseId, collectionId: collection, documentId: id });
    } catch (e) {
      if ((e as { code?: number }).code === 404) throw new NotFoundError(`Document ${collection}/${id} not found`);
      throw e;
    }
  }
}

export function makeAdminChecker(client: Client, teamId: string) {
  const teams = new Teams(client);
  return async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await teams.listMemberships({ teamId, queries: [Query.equal('userId', userId), Query.limit(1)] });
      const m = res.memberships[0];
      return Boolean(m && m.confirm !== false);
    } catch {
      return false;
    }
  };
}

export function makeUserLookup(client: Client) {
  const users = new Users(client);
  return async (userId: string): Promise<{ email?: string; name?: string } | null> => {
    try {
      const u = await users.get({ userId });
      return { email: u.email || undefined, name: u.name || undefined };
    } catch {
      return null;
    }
  };
}
