export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
