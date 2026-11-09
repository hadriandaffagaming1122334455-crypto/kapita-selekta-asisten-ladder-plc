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

// contoh pola CX-Programmer
const ex2 = parseProgram(EXAMPLES[1].program);
ok(ex2.errors.length === 0 && ex2.program.length === 5, "contoh 2: 5 rung terbaca");
ok(validate(ex2.program).valid, "contoh 2 valid (10.00, T010, 100.12 diterima)");
let t2 = initialState();
t2 = step(ex2.program, t2, { "0.00": true });
t2 = step(ex2.program, t2, { "0.00": false });
ok(t2.bits["100.12"] === true && t2.bits["100.01"] === true && !t2.bits["100.00"], "buzzer dan L2 nyala, L1 mati");
for (let i = 0; i < 55; i++) t2 = step(ex2.program, t2, {});
ok(!t2.bits["100.12"] && t2.bits["100.01"], "buzzer berhenti setelah TIM 5 detik, L2 tetap");
t2 = step(ex2.program, t2, { "0.01": true });
ok(t2.bits["100.00"] === true && !t2.bits["100.01"], "RESET: L1 nyala, L2 mati");

import { layoutProgram } from "./layout";
ok(ex2.program[0].instructions[0].label === "START", "komentar akhir baris menjadi nama simbol");
ok(ex2.program[3].instructions[1].label === "L1 Lampu sistem tidak berjalan", "label coil terbaca");
const lay = layoutProgram(ex2.program);
ok(lay.shapes.filter((x) => x.k === "contact").length === 8, "layout: 8 kontak tergambar");
ok(lay.shapes.filter((x) => x.k === "tim").length === 1 && lay.shapes.filter((x) => x.k === "coil").length === 4, "layout: 1 TIM dan 4 coil");
import { writeFileSync } from "node:fs";
if (process.env.SVG_OUT) {
  const sv = lay.shapes.map((s) => s.k === "line" ? `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="#222" stroke-width="1.5"/>`
    : s.k === "text" ? `<text x="${s.x}" y="${s.y}" font-size="11">${s.s}</text>`
    : s.k === "contact" ? `<g stroke="#222" stroke-width="2"><line x1="${s.x}" y1="${s.y+25}" x2="${s.x+30}" y2="${s.y+25}"/><line x1="${s.x+50}" y1="${s.y+25}" x2="${s.x+80}" y2="${s.y+25}"/><line x1="${s.x+30}" y1="${s.y+13}" x2="${s.x+30}" y2="${s.y+37}"/><line x1="${s.x+50}" y1="${s.y+13}" x2="${s.x+50}" y2="${s.y+37}"/>${s.nc ? `<line x1="${s.x+28}" y1="${s.y+37}" x2="${s.x+52}" y2="${s.y+13}"/>` : ""}<text x="${s.x+40}" y="${s.y+9}" font-size="11" stroke="none" text-anchor="middle">${s.addr}</text></g>`
    : s.k === "coil" ? `<circle cx="${s.x}" cy="${s.y}" r="12" fill="none" stroke="#222" stroke-width="2"/><text x="${s.x}" y="${s.y-18}" font-size="11" text-anchor="middle">${s.addr}</text>`
    : `<rect x="${s.x}" y="${s.y}" width="100" height="60" fill="none" stroke="#222" stroke-width="2"/><text x="${s.x+50}" y="${s.y+22}" font-size="11" text-anchor="middle">TIM ${s.no}</text><text x="${s.x+50}" y="${s.y+40}" font-size="11" text-anchor="middle">#${s.preset}</text>`).join("");
  writeFileSync(process.env.SVG_OUT, `<svg xmlns="http://www.w3.org/2000/svg" width="${lay.width}" height="${lay.height}" font-family="monospace"><rect width="100%" height="100%" fill="white"/>${sv}</svg>`);
}

console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
process.exit(fail === 0 ? 0 : 1);
