import { parseProgram } from "./parser";
import { validate } from "./validator";
import { initialState, step } from "./simulator";
import { EXAMPLES } from "./examples";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

const { program, errors } = parseProgram(EXAMPLES[0].program);
ok(errors.length === 0 && program.length === 3, "parse contoh: 3 rung tanpa galat");
ok(validate(program).valid, "validator: contoh valid");

// simulasi: tekan start 1 scan, lepas, jalankan 60 scan x 100 ms
let s = initialState();
s = step(program, s, { "0.00": true });
ok(s.bits["W0.00"] === true, "self-holding aktif setelah START");
for (let i = 0; i < 60; i++) s = step(program, s, { "0.00": false });
ok(s.bits["W0.00"] === true, "self-holding bertahan setelah START dilepas");
ok(s.bits["100.00"] === true, "lampu nyala setelah ~6 detik");

let s2 = initialState();
s2 = step(program, s2, { "0.00": true });
for (let i = 0; i < 30; i++) s2 = step(program, s2, { "0.00": false });
ok(!s2.bits["100.00"], "lampu BELUM nyala di ~3 detik");

s = step(program, s, { "0.01": true });
ok(!s.bits["W0.00"], "STOP mematikan self-holding");
s = step(program, s, { "0.01": false });
ok(!s.bits["100.00"], "lampu mati setelah STOP");

// validator menangkap kesalahan
ok(!validate([]).valid, "program kosong = tidak valid (bukan 'aman')");
const dup = parseProgram("LD 0.00\nOUT 100.00\n\nLD 0.01\nOUT 100.00").program;
ok(validate(dup).issues.some((i) => i.message.includes("OUT ganda")), "OUT ganda terdeteksi");
const bad = parseProgram("LD M0.00\nOUT 100.00").program;
ok(!validate(bad).valid, "alamat M0.00 ditolak");
const badT = parseProgram("LD 0.00\nTIM 0000 #0050\n\nLD T0000\nOUT 100.00").program;
ok(validate(badT).valid, "TIM sederhana valid");

console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
process.exit(fail === 0 ? 0 : 1);
