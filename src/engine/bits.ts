import { u32 } from "./hash";

/** Expand a chain id (base64url tx, key, etc.) into a bit stream. Same id always yields the same bits. */
export function bitStream(entropy: string) {
  let i = 0;
  return {
    take(n: number): number {
      let v = 0;
      for (let k = 0; k < n; k += 1) {
        const word = u32(`${entropy}#${Math.floor(i / 32)}`);
        const b = (word >>> (i % 32)) & 1;
        i += 1;
        v = (v << 1) | b;
      }
      return v >>> 0;
    },
    bit(): number {
      return this.take(1);
    },
    frac(): number {
      return this.take(10) / 1024;
    },
  };
}

export type Bits = ReturnType<typeof bitStream>;
