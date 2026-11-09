// Schema tetap untuk output model (lapisan 2). Dipakai untuk memeriksa jawaban model
// sebelum sampai ke pengguna. Sengaja ditulis tangan, tanpa pustaka tambahan.

export type Mode = "penuh" | "ringkas";

export interface DraftOutput {
  status: "draf" | "tidak_bisa";
  alasan: string; // wajib terisi jika tidak_bisa, kosong jika draf
  ringkasan: string;
  program: string; // mnemonic format parser; kosong jika tidak_bisa
  penjelasan: string[]; // mode penuh: satu butir per rung; mode ringkas: kosong
  asumsi: string[];
  perlu_dicek: string[]; // minimal satu butir jika draf
}

const KEYS = ["status", "alasan", "ringkasan", "program", "penjelasan", "asumsi", "perlu_dicek"];
const MAX_PROGRAM = 4000;
const MAX_ITEMS = 20;
const MAX_TEXT = 400;
export const MAX_RINGKAS = 240;

export type CheckResult = { ok: true; value: DraftOutput } | { ok: false; errors: string[] };

export function checkOutput(x: unknown, mode: Mode): CheckResult {
  const errors: string[] = [];
  if (typeof x !== "object" || x === null || Array.isArray(x)) {
    return { ok: false, errors: ["Output harus berupa satu objek JSON."] };
  }
  const o = x as Record<string, unknown>;

  for (const k of Object.keys(o)) if (!KEYS.includes(k)) errors.push(`Field tambahan tidak diizinkan: "${k}".`);
  for (const k of KEYS) if (!(k in o)) errors.push(`Field wajib hilang: "${k}".`);
  if (errors.length > 0) return { ok: false, errors };

  const str = (k: string) => {
    if (typeof o[k] !== "string") errors.push(`"${k}" harus string.`);
    return typeof o[k] === "string" ? (o[k] as string) : "";
  };
  const arr = (k: string) => {
    const v = o[k];
    if (!Array.isArray(v) || !v.every((i) => typeof i === "string" && i.trim() !== "" && i.length <= MAX_TEXT)) {
      errors.push(`"${k}" harus berupa daftar string tidak kosong (maks ${MAX_TEXT} karakter per butir).`);
      return [] as string[];
    }
    if (v.length > MAX_ITEMS) errors.push(`"${k}" maksimal ${MAX_ITEMS} butir.`);
    return v as string[];
  };

  const status = str("status");
  const alasan = str("alasan");
  const ringkasan = str("ringkasan");
  const program = str("program");
  const penjelasan = arr("penjelasan");
  const asumsi = arr("asumsi");
  const perluDicek = arr("perlu_dicek");

  if (status !== "draf" && status !== "tidak_bisa") errors.push('"status" harus "draf" atau "tidak_bisa".');
  if (ringkasan.trim() === "") errors.push('"ringkasan" tidak boleh kosong.');
  if (program.length > MAX_PROGRAM) errors.push(`"program" terlalu panjang (maks ${MAX_PROGRAM} karakter).`);

  if (status === "draf") {
    if (program.trim() === "") errors.push('Status "draf" butuh "program" terisi.');
    if (alasan !== "") errors.push('Status "draf" harus punya "alasan" kosong.');
    if (perluDicek.length < 1) errors.push('Status "draf" butuh minimal satu butir "perlu_dicek".');
    if (mode === "penuh" && penjelasan.length < 1) errors.push('Mode "penuh" butuh minimal satu butir "penjelasan".');
  }
  if (status === "tidak_bisa") {
    if (program !== "") errors.push('Status "tidak_bisa" harus punya "program" kosong.');
    if (alasan.trim() === "") errors.push('Status "tidak_bisa" butuh "alasan" terisi.');
  }
  if (mode === "ringkas") {
    if (ringkasan.length > MAX_RINGKAS) errors.push(`Mode "ringkas": "ringkasan" maksimal ${MAX_RINGKAS} karakter.`);
    if (penjelasan.length !== 0) errors.push('Mode "ringkas": "penjelasan" harus daftar kosong.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { status: status as DraftOutput["status"], alasan, ringkasan, program, penjelasan, asumsi, perlu_dicek: perluDicek },
  };
}
