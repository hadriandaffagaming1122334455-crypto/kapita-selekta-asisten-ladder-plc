import type { Program } from "./types";

export interface SimState {
  bits: Record<string, boolean>; // semua alamat bit (input, output, work)
  timers: Record<string, { elapsedMs: number; done: boolean }>; // kunci "T0000"
  // kunci "C0", "C1", ... pv = nilai hitung saat ini (turun dari nilai set), done = flag selesai
  counters: Record<string, { pv: number; done: boolean; prevCount: boolean }>;
  scan: number;
}

export function initialState(): SimState {
  return { bits: {}, timers: {}, counters: {}, scan: 0 };
}

/**
 * Satu scan program. Model tumpukan blok:
 * LD/LD NOT memulai blok baru (blok sebelumnya disimpan di tumpukan),
 * AND/OR menggabungkan ke blok saat ini, ANDLD/ORLD menggabungkan blok saat ini
 * dengan blok teratas di tumpukan. OUT/TIM memakai hasil blok saat ini.
 * CNT memakai dua kondisi: LD pertama = input hitung, LD kedua = input reset.
 * Perilaku CNT di sini: turun dari nilai set pada tiap tepi naik input hitung,
 * flag selesai menyala saat nilai mencapai 0 dan bertahan sampai reset.
 * COCOKKAN perilaku CNT ini dengan manual W483/W480 sebelum dianggap final.
 *
 * dtMs = waktu yang dianggap berlalu pada scan ini (mis. 100 ms).
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
  const counters: SimState["counters"] = {};
  for (const [k, v] of Object.entries(prev.counters ?? {})) counters[k] = { ...v };

  const tk = (a: string) => "T" + parseInt(a.replace(/^T/, ""), 10); // T010 == T10
  const ck = (a: string) => "C" + parseInt(a.replace(/^C/, ""), 10);
  const read = (addr: string): boolean =>
    /^T\d+$/.test(addr)
      ? timers[tk(addr)]?.done ?? false
      : /^C\d+$/.test(addr)
        ? counters[ck(addr)]?.done ?? false
        : bits[addr] ?? false;

  for (const rung of program) {
    let acc = false;
    let started = false;
    const stack: boolean[] = [];
    for (const ins of rung.instructions) {
      switch (ins.op) {
        case "LD":
        case "LD NOT": {
          if (started) stack.push(acc);
          acc = ins.op === "LD" ? read(ins.arg) : !read(ins.arg);
          started = true;
          break;
        }
        case "AND": acc = acc && read(ins.arg); break;
        case "AND NOT": acc = acc && !read(ins.arg); break;
        case "OR": acc = acc || read(ins.arg); break;
        case "OR NOT": acc = acc || !read(ins.arg); break;
        case "ANDLD": acc = (stack.pop() ?? false) && acc; break;
        case "ORLD": acc = (stack.pop() ?? false) || acc; break;
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
        case "CNT": {
          const reset = acc;
          const count = stack.pop() ?? false;
          const key = ck(ins.arg);
          const c = counters[key] ?? { pv: ins.preset ?? 0, done: false, prevCount: false };
          if (reset) {
            c.pv = ins.preset ?? 0;
            c.done = false;
          } else if (count && !c.prevCount && c.pv > 0) {
            c.pv -= 1;
            c.done = c.pv === 0;
          }
          c.prevCount = count;
          counters[key] = c;
          break;
        }
      }
    }
  }
  return { bits, timers, counters, scan: prev.scan + 1 };
}
