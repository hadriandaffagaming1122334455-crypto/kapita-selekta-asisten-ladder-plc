import { parseProgram } from "./parser";
import { validate } from "./validator";
import { initialState, step, type SimState } from "./simulator";
import { layoutProgram } from "./layout";
import { EXAMPLES } from "./examples";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const run = (p: ReturnType<typeof parseProgram>["program"], s: SimState, inp: Record<string, boolean>, n = 1) => {
  for (let i = 0; i < n; i++) s = step(p, s, inp);
  return s;
};
const pulse = (p: ReturnType<typeof parseProgram>["program"], s: SimState, addr: string) =>
  run(p, run(p, s, { [addr]: true }), { [addr]: false });

// --- parser ---
const pa = parseProgram("LD 0.00\nLD 0.01\nANDLD\nOUT 100.00");
ok(pa.errors.length === 0 && pa.program[0].instructions[2].op === "ANDLD", "parser: ANDLD terbaca tanpa alamat");
ok(parseProgram("LD 0.00\nLD 0.01\nANDLD 0.02\nOUT 100.00").errors.length > 0, "parser: ANDLD dengan alamat ditolak");
ok(parseProgram("LD 0.00\nLD 0.01\nORLD\nOUT 100.00").program[0].instructions[2].op === "ORLD", "parser: ORLD terbaca");
ok(parseProgram("LD 0.00\nAND 0.01\nOUT 100.00").program[0].instructions[1].op === "AND", "parser: AND tidak salah terbaca sebagai ANDLD");

// --- validator ---
ok(validate(pa.program).valid, "validator: LD, LD, ANDLD, OUT valid");
ok(!validate(parseProgram("LD 0.00\nLD 0.01\nOUT 100.00").program).valid, "validator: dua blok tanpa ANDLD/ORLD ditolak");
ok(!validate(parseProgram("LD 0.00\nANDLD\nOUT 100.00").program).valid, "validator: ANDLD dengan satu blok ditolak");
ok(validate(parseProgram("LD 0.00\nLD 0.01\nCNT 0000 #0003").program).valid, "validator: CNT dengan dua kondisi valid");
ok(!validate(parseProgram("LD 0.00\nCNT 0000 #0003").program).valid, "validator: CNT dengan satu kondisi ditolak");
ok(!validate(parseProgram("LD 0.00\nLD 0.01\nLD 0.02\nCNT 0000 #0003").program).valid, "validator: CNT dengan tiga kondisi ditolak");
ok(!validate(parseProgram("LD 0.00\nTIM 0000 #0010\n\nLD 0.01\nLD 0.02\nCNT 0000 #0003").program).valid, "validator: nomor 0000 dipakai TIM dan CNT ditolak");
ok(validate(parseProgram("LD C0000\nOUT 100.00").program).valid, "validator: kontak C0000 diterima");
ok(!validate(parseProgram("LD C9999\nOUT 100.00").program).valid, "validator: kontak C9999 ditolak");
ok(!validate(parseProgram("LD 0.00\nLD 0.01\nCNT 0000 #0003").program).issues.some((i) => i.message.includes("belum didukung")), "validator: tidak ada lagi peringatan 'belum didukung'");

// --- simulator: ANDLD / ORLD ---
const and = parseProgram("LD 0.00\nOR 0.01\nLD 0.02\nOR 0.03\nANDLD\nOUT 100.00").program; // (a|b)&(c|d)
let t = run(and, initialState(), { "0.00": true, "0.02": false });
ok(!t.bits["100.00"], "ANDLD: (1|0)&(0|0) = 0");
t = run(and, initialState(), { "0.01": true, "0.03": true });
ok(t.bits["100.00"] === true, "ANDLD: (0|1)&(0|1) = 1");
const orl = parseProgram("LD 0.00\nAND 0.01\nLD 0.02\nAND 0.03\nORLD\nOUT 100.00").program; // a&b | c&d
t = run(orl, initialState(), { "0.02": true, "0.03": true });
ok(t.bits["100.00"] === true, "ORLD: c&d menyalakan keluaran");
t = run(orl, initialState(), { "0.00": true, "0.03": true });
ok(!t.bits["100.00"], "ORLD: a saja + d saja = 0");

// --- simulator: CNT ---
const cnt = parseProgram("LD 0.00\nLD 0.01\nCNT 0000 #0003\n\nLD C0000\nOUT 100.00").program;
let c = initialState();
c = pulse(cnt, c, "0.00");
ok(c.counters["C0"].pv === 2 && !c.bits["100.00"], "CNT: satu hitungan, PV turun jadi 2, belum selesai");
c = run(cnt, c, { "0.00": true }, 5); // ditahan ON: hanya tepi naik yang dihitung
c = run(cnt, c, { "0.00": false });
ok(c.counters["C0"].pv === 1, "CNT: input ditahan ON dihitung sekali (tepi naik)");
c = pulse(cnt, c, "0.00");
ok(c.counters["C0"].pv === 0 && c.bits["100.00"] === true, "CNT: hitungan ketiga, flag selesai menyala");
c = pulse(cnt, c, "0.00");
ok(c.counters["C0"].pv === 0 && c.bits["100.00"] === true, "CNT: tidak turun di bawah 0");
c = run(cnt, c, { "0.01": true });
ok(c.counters["C0"].pv === 3 && !c.bits["100.00"], "CNT: reset mengembalikan PV ke nilai set dan flag mati");
c = run(cnt, c, { "0.01": true, "0.00": true });
c = run(cnt, c, { "0.00": false });
ok(c.counters["C0"].pv === 3, "CNT: saat reset ON, hitungan diabaikan");

// --- contoh 3 ---
const ex = EXAMPLES[2];
const e = parseProgram(ex.program);
ok(e.errors.length === 0 && e.program.length === 5, "contoh 3: 5 rung terbaca tanpa galat");
const v = validate(e.program);
ok(v.valid, "contoh 3: valid" + (v.valid ? "" : " -> " + v.issues.map((i) => i.message).join("; ")));
let s = initialState();
s = pulse(e.program, s, "0.00");
ok(s.bits["10.00"] === true && s.bits["100.04"] === true, "contoh 3: START menyalakan konveyor dan motor");
ok(!s.bits["100.12"], "contoh 3: buzzer belum bunyi");
s = run(e.program, s, { "0.02": true });
ok(s.bits["100.01"] === true, "contoh 3: lampu deteksi nyala saat sensor A aktif (ORLD)");
s = run(e.program, s, { "0.02": false });
s = pulse(e.program, s, "0.02");
s = pulse(e.program, s, "0.02");
s = run(e.program, s, {});
ok(s.counters["C0"].done && !s.bits["10.00"] && !s.bits["100.04"], "contoh 3: tiga paket, konveyor dan motor berhenti");
ok(s.bits["100.12"] === true, "contoh 3: buzzer bunyi saat batch penuh (ANDLD)");
s = run(e.program, s, { "0.05": true });
ok(!s.bits["100.12"], "contoh 3: MUTE mematikan buzzer (ANDLD)");
s = run(e.program, s, { "0.05": false, "0.03": true });
s = run(e.program, s, { "0.03": false });
ok(!s.counters["C0"].done && !s.bits["100.12"], "contoh 3: reset hitungan mematikan buzzer");

// --- layout ---
const lay = layoutProgram(e.program);
const cntShapes = lay.shapes.filter((x) => x.k === "tim");
ok(cntShapes.length === 1 && cntShapes[0].k === "tim" && cntShapes[0].kind === "CNT", "layout: kotak CNT tergambar");
ok(lay.shapes.filter((x) => x.k === "contact").length === 15, "layout: 15 kontak tergambar (termasuk blok ANDLD/ORLD dan reset CNT)");
ok(lay.shapes.filter((x) => x.k === "coil").length === 4, "layout: 4 coil tergambar");

console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
process.exit(fail === 0 ? 0 : 1);
