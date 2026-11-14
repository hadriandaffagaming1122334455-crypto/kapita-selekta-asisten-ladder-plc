import { parseProgram } from "./parser";
import { validate } from "./validator";
import { initialState, step, type SimState } from "./simulator";
import { layoutProgram } from "./layout";
import { EXAMPLES } from "./examples";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

const ex = EXAMPLES[3];
const { program, errors } = parseProgram(ex.program);
ok(errors.length === 0, "contoh 4: terbaca tanpa galat");
const v = validate(program);
ok(v.valid, "contoh 4: valid" + (v.valid ? "" : " -> " + v.issues.map((i) => i.message).join("; ")));
ok(!v.issues.some((i) => i.severity === "warning"), "contoh 4: tanpa peringatan");

const run = (s: SimState, inp: Record<string, boolean>, n = 1) => { for (let i = 0; i < n; i++) s = step(program, s, inp); return s; };
const on = (s: SimState, ...a: string[]) => a.every((x) => s.bits[x] === true);
const off = (s: SimState, ...a: string[]) => a.every((x) => !s.bits[x]);
const L1 = "100.00", L2 = "100.01", M5 = "100.02", M1 = "100.03", M2 = "100.04", M3 = "100.05", M4 = "100.06";
const BA = "100.07", BB = "100.08", BC = "100.09", BD = "100.10", BE = "100.11", BUZ = "100.12";

let s = run(initialState(), {}, 2);
ok(on(s, L1) && off(s, L2, M5, BE, BUZ, M1, BA), "standby: hanya L1 menyala");

s = run(run(s, { "0.00": true }), { "0.00": false }, 2);
ok(on(s, L2, M5, BE, BUZ) && off(s, L1), "START: L2, M5, Box E, buzzer menyala; L1 mati; bertahan setelah START dilepas");
s = run(s, {}, 46); // START 1 scan + lepas 2 scan + 46 = 49 scan = 4,9 detik
ok(on(s, BUZ), "buzzer masih bunyi sebelum 5 detik");
s = run(s, {}, 2);
ok(off(s, BUZ) && on(s, L2), "buzzer mati setelah 5 detik, L2 tetap");

const pilih = (addr: string, m: string, box: string, nama: string) => {
  s = run(s, { [addr]: true }, 2);
  ok(on(s, m) && off(s, box), `paket ${nama}: pendorong ${m} aktif, ${box} belum menyala`);
  s = run(s, {}, 17);
  ok(on(s, m), `paket ${nama}: pendorong masih aktif sebelum 2 detik`);
  s = run(s, {}, 3);
  ok(off(s, m, BE) && on(s, box), `paket ${nama}: setelah 2 detik pendorong mati, ${box} menyala, Box E mati`);
  s = run(s, { [addr]: false }, 2);
  ok(on(s, BE) && off(s, box), `paket ${nama}: dilepas, kembali ke Box E`);
};
pilih("0.02", M1, BA, "A");
pilih("0.03", M2, BB, "B");
pilih("0.04", M3, BC, "C");
pilih("0.05", M4, BD, "D");

s = run(s, { "0.02": true, "0.03": true }, 2);
ok(on(s, M1) && off(s, M2), "prioritas: A dan B bersamaan, hanya A yang diproses");
s = run(s, { "0.02": false, "0.03": false }, 2);

s = run(s, { "0.02": true }, 5);
s = run(s, { "0.01": true }, 2);
ok(on(s, L1) && off(s, L2, M5, M1, BE, BA, BUZ), "RESET: semua mati kecuali L1");
s = run(s, { "0.01": false, "0.02": false }, 2);
ok(on(s, L1) && off(s, L2), "setelah RESET dilepas tetap standby");
s = run(run(s, { "0.00": true }), { "0.00": false }, 2);
ok(on(s, BUZ, L2), "START lagi: buzzer bunyi lagi (timer ikut ter-reset)");

const lay = layoutProgram(program);
ok(lay.shapes.filter((x) => x.k === "tim").length === 5, "layout: 5 kotak timer tergambar");
ok(program.length === 23, "contoh 4: 23 rung");
ok(lay.shapes.filter((x) => x.k === "coil").length === 18, "layout: 18 coil tergambar");
console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
process.exit(fail === 0 ? 0 : 1);
