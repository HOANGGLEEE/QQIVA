import { getDatabase } from '@/db/database';

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM json_store WHERE key=?', key);
  if (!row?.json) return fallback;
  try { return JSON.parse(row.json) as T; } catch { return fallback; }
}

export async function setJson(key: string, value: unknown) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO json_store (key,json,updated_at) VALUES (?,?,?)', key, JSON.stringify(value), new Date().toISOString());
}

export async function mutateJson<T>(key: string, fallback: T, updater: (value: T) => T | void): Promise<T> {
  const current = await getJson<T>(key, fallback);
  const next = updater(current) ?? current;
  await setJson(key, next);
  return next;
}
