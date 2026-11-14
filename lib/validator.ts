import { ADDRESS_CONFIG as C } from "./config";
import type { Issue, Program, ValidationResult } from "./types";

const CONTACT_OPS = ["LD", "LD NOT", "AND", "AND NOT", "OR", "OR NOT"];

export function isInput(a: string): boolean {
  const m = /^(\d{1,3})\.(\d{2})$/.exec(a);
  if (!m) return false;
  const w = +m[1], b = +m[2];
  return C.inputWords.includes(w) && b < C.inputBitsPerWord;
}
function isOutput(a: string): boolean {
  const m = /^(\d{1,3})\.(\d{2})$/.exec(a);
  if (!m) return false;
  const w = +m[1], b = +m[2];
  return C.outputWords.includes(w) && b < C.outputBitsPerWord;
}
function isWork(a: string): boolean {
  const w = /^W(\d{1,3})\.(\d{2})$/.exec(a);
  if (w) return +w[1] <= C.workMaxWord && +w[2] <= 15;
  const c = /^(\d{1,3})\.(\d{2})$/.exec(a); // bit kerja CIO, mis. 10.00
  return !!c && +c[1] >= C.cioWorkMin && +c[1] <= C.cioWorkMax && +c[2] <= 15;
}
function isTimerContact(a: string): boolean {
  const m = /^T(\d{1,4})$/.exec(a);
  return !!m && +m[1] <= C.maxTimerNo;
}
function isCounterContact(a: string): boolean {
  const m = /^C(\d{1,4})$/.exec(a);
  return !!m && +m[1] <= C.maxTimerNo;
}

export function validate(program: Program): ValidationResult {
  const issues: Issue[] = [];
  const add = (severity: Issue["severity"], rung: number | undefined, message: string) =>
    issues.push({ severity, rung, message });

  // Hasil kosong BUKAN "tidak ada masalah" (prinsip dari rancangan sistem).
  if (program.length === 0) {
    add("error", undefined, "Program kosong: tidak ada rung untuk diperiksa.");
    return { valid: false, issues };
  }

  const outCount = new Map<string, number>();
  const timerNos = new Map<string, number>();

  for (const rung of program) {
    const ins = rung.instructions;
    if (ins.length < 2) add("error", rung.no, "Rung minimal berisi satu kondisi dan satu keluaran.");
    if (ins.length > 0 && !["LD", "LD NOT"].includes(ins[0].op))
      add("error", rung.no, "Rung harus diawali LD atau LD NOT.");

    const last = ins[ins.length - 1];
    if (last && !["OUT", "TIM", "CNT"].includes(last.op))
      add("error", rung.no, "Rung harus diakhiri OUT, TIM, atau CNT.");

    // Kedalaman tumpukan blok: tiap LD menambah satu blok, ANDLD/ORLD menggabungkan dua blok jadi satu.
    let depth = 0;

    ins.forEach((x, idx) => {
      if (x.op === "ANDLD" || x.op === "ORLD") {
        if (depth < 2) add("error", rung.no, `${x.op} butuh dua blok (dua LD sebelumnya) untuk digabung.`);
        else depth -= 1;
        return;
      }
      if (CONTACT_OPS.includes(x.op)) {
        if (x.op === "LD" || x.op === "LD NOT") depth += 1;
        if (!(isInput(x.arg) || isOutput(x.arg) || isWork(x.arg) || isTimerContact(x.arg) || isCounterContact(x.arg)))
          add("error", rung.no, `Alamat kontak "${x.arg}" tidak valid untuk konfigurasi ini.`);
        return;
      }
      if (x.op === "OUT" || x.op === "TIM") {
        if (depth > 1) add("error", rung.no, `Ada ${depth} blok yang belum digabung sebelum ${x.op}: gunakan ANDLD atau ORLD.`);
      }
      if (x.op === "CNT") {
        if (depth !== 2)
          add("error", rung.no, "CNT butuh tepat dua kondisi: LD input hitung, lalu LD input reset (masing-masing boleh berisi AND/OR).");
        depth = 0;
      }
      if (x.op === "OUT") {
        if (!(isOutput(x.arg) || isWork(x.arg)))
          add("error", rung.no, `OUT ke "${x.arg}" tidak valid (harus output atau work bit).`);
        outCount.set(x.arg, (outCount.get(x.arg) ?? 0) + 1);
        if (idx !== ins.length - 1) add("error", rung.no, "OUT harus instruksi terakhir di rung.");
      } else if (x.op === "TIM" || x.op === "CNT") {
        const n = /^\d{1,4}$/.test(x.arg) ? +x.arg : NaN;
        if (Number.isNaN(n) || n > C.maxTimerNo)
          add("error", rung.no, `Nomor ${x.op} "${x.arg}" tidak valid (0-${C.maxTimerNo}).`);
        if (x.preset === undefined || x.preset > 9999)
          add("error", rung.no, `Nilai set ${x.op} harus #0000-#9999.`);
        timerNos.set(x.arg, (timerNos.get(x.arg) ?? 0) + 1);
      }
    });
  }

  for (const [addr, n] of outCount)
    if (n > 1) add("error", undefined, `OUT ganda ke ${addr} (${n} kali). Satu alamat hanya boleh di-OUT sekali.`);
  // Asumsi: TIM dan CNT berbagi satu ruang nomor (0-255), jadi nomor yang sama tidak boleh dipakai keduanya.
  // COCOKKAN dengan manual W483/W480 untuk CP1E.
  for (const [no, n] of timerNos)
    if (n > 1) add("error", undefined, `Nomor timer/counter ${no} dipakai ${n} kali.`);

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
