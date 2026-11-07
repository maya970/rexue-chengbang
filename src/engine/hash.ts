/** Deterministic 32-bit mix. Same string always yields the same number. */
export function u32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(list: readonly T[], seed: string): T {
  return list[u32(seed) % list.length];
}

export function range(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (u32(seed) % span);
}
