export function makeId(prefix: string) {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${time}-${rand}`;
}

export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowIso() { return new Date().toISOString(); }

export function currentMonth() { return today().slice(0, 7); }

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
