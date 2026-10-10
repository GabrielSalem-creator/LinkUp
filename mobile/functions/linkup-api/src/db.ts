/**
 * Minimal database port. The production adapter wraps node-appwrite; tests use MemoryDb.
 * Document IDs are the atomic primitive: creating an existing ID throws ConflictError.
 */
import { DomainError } from '../../../lib/competition/states.ts';

export type Doc = { $id: string; $createdAt?: string; $updatedAt?: string } & Record<string, unknown>;

export type WhereOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';
export type Where = [field: string, op: WhereOp, value: unknown];

export interface ListOptions {
  where?: Where[];
  orderBy?: { field: string; dir: 'asc' | 'desc' }[];
  limit?: number; // max docs to return (paginated internally)
}

export class ConflictError extends DomainError {
  constructor(message = 'Document already exists') {
    super('conflict', message, 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super('not_found', message, 404);
  }
}

export interface Db {
  get(collection: string, id: string): Promise<Doc | null>;
  list(collection: string, opts?: ListOptions): Promise<Doc[]>;
  create(collection: string, id: string, data: Record<string, unknown>, permissions?: string[]): Promise<Doc>;
  update(collection: string, id: string, data: Record<string, unknown>): Promise<Doc>;
  delete(collection: string, id: string): Promise<void>;
}

/* ------------------------------ MemoryDb (tests) ------------------------------ */

function matches(doc: Doc, [field, op, value]: Where): boolean {
  const v = doc[field];
  switch (op) {
    case 'eq':
      return v === value;
    case 'ne':
      return v !== value;
    case 'lt':
      return (v as never) < (value as never);
    case 'lte':
      return (v as never) <= (value as never);
    case 'gt':
      return (v as never) > (value as never);
    case 'gte':
      return (v as never) >= (value as never);
    case 'in':
      return Array.isArray(value) && value.includes(v);
    default:
      return false;
  }
}

export class MemoryDb implements Db {
  readonly store = new Map<string, Map<string, Doc>>();
  private seq = 0;

  private col(name: string) {
    if (!this.store.has(name)) this.store.set(name, new Map());
    return this.store.get(name)!;
  }

  async get(collection: string, id: string): Promise<Doc | null> {
    const d = this.col(collection).get(id);
    return d ? structuredClone(d) : null;
  }

  async list(collection: string, opts: ListOptions = {}): Promise<Doc[]> {
    let docs = [...this.col(collection).values()];
    for (const w of opts.where ?? []) docs = docs.filter((d) => matches(d, w));
    for (const o of [...(opts.orderBy ?? [])].reverse()) {
      docs.sort((a, b) => {
        const x = a[o.field] as never;
        const y = b[o.field] as never;
        const c = x < y ? -1 : x > y ? 1 : 0;
        return o.dir === 'asc' ? c : -c;
      });
    }
    if (opts.limit != null) docs = docs.slice(0, opts.limit);
    return docs.map((d) => structuredClone(d));
  }

  async create(collection: string, id: string, data: Record<string, unknown>): Promise<Doc> {
    const c = this.col(collection);
    if (c.has(id)) throw new ConflictError(`Document ${collection}/${id} already exists`);
    const now = new Date(Date.now() + this.seq++).toISOString();
    const doc: Doc = { ...structuredClone(data), $id: id, $createdAt: now, $updatedAt: now };
    c.set(id, doc);
    return structuredClone(doc);
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<Doc> {
    const c = this.col(collection);
    const cur = c.get(id);
    if (!cur) throw new NotFoundError(`Document ${collection}/${id} not found`);
    const doc: Doc = { ...cur, ...structuredClone(data), $updatedAt: new Date().toISOString() };
    c.set(id, doc);
    return structuredClone(doc);
  }

  async delete(collection: string, id: string): Promise<void> {
    const c = this.col(collection);
    if (!c.delete(id)) throw new NotFoundError(`Document ${collection}/${id} not found`);
  }
}
