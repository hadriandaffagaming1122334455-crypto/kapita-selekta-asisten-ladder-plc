import type { Program } from "./types";

export interface SimState {
  bits: Record<string, boolean>; // semua alamat bit (input, output, work)
  timers: Record<string, { elapsedMs: number; done: boolean }>; // kunci "T0000"
  scan: number;
}

export function initialState(): SimState {
  return { bits: {}, timers: {}, scan: 0 };
}

/**
 * Satu scan program, memakai model akumulator linier:
 * LD/LD NOT mengisi akumulator, AND/OR menggabungkan, OUT/TIM memakai hasilnya.
 * Batasan: belum ada ANDLD/ORLD (blok paralel bertingkat).
 * dtMs = waktu yang dianggap berlalu pada scan ini (mis. 100 ms).
 *
 * Input pengguna diberikan lewat `inputs` dan menimpa bit input tiap scan.
 */
export function step(
  program: Program,
  prev: SimState,
  inputs: Record<string, boolean>,
  dtMs = 100
): SimState {
  const bits = { ...prev.bits, ...inputs };
  const timers: SimState["timers"] = {};
  for (const [k, v] of Object.entries(prev.timers)) timers[k] = { ...v };

  const tk = (a: string) => "T" + parseInt(a.replace(/^T/, ""), 10); // T010 == T10
  const read = (addr: string): boolean =>
    /^T\d+$/.test(addr) ? timers[tk(addr)]?.done ?? false : bits[addr] ?? false;

  for (const rung of program) {
    let acc = false;
    for (const ins of rung.instructions) {
      switch (ins.op) {
        case "LD": acc = read(ins.arg); break;
        case "LD NOT": acc = !read(ins.arg); break;
        case "AND": acc = acc && read(ins.arg); break;
        case "AND NOT": acc = acc && !read(ins.arg); break;
        case "OR": acc = acc || read(ins.arg); break;
        case "OR NOT": acc = acc || !read(ins.arg); break;
        case "OUT": bits[ins.arg] = acc; break;
        case "TIM": {
          const key = tk(ins.arg);
          const t = timers[key] ?? { elapsedMs: 0, done: false };
          if (acc) {
            t.elapsedMs += dtMs;
            t.done = t.elapsedMs >= (ins.preset ?? 0) * 100; // #0050 = 5,0 detik
          } else {
            t.elapsedMs = 0;
            t.done = false;
          }
          timers[key] = t;
          break;
        }
        case "CNT":
          throw new Error("CNT belum didukung simulator.");
      }
    }
  }
  return { bits, timers, scan: prev.scan + 1 };
}
