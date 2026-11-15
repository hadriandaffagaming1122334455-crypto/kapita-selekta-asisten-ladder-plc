import type { Mode } from "./schema";

// Bentuk output RAG (rancangan-rag.md bagian 6). Model hanya menyebut NOMOR sumber;
// sistem yang menerjemahkannya menjadi nama dokumen dan bagian, sehingga rujukan tidak bisa dikarang.
export interface RagOutput {
  status: "dijawab" | "tidak_ada_di_dokumen";
  jawaban: string;
  rujukan: { sumber: number }[];
  catatan: string[];
}

const KEYS = ["status", "jawaban", "rujukan", "catatan"];
export const MAX_RINGKAS_RAG = 240;

export type RagCheck = { ok: true; value: RagOutput } | { ok: false; errors: string[] };

export function checkRag(x: unknown, mode: Mode, jumlahSumber: number): RagCheck {
  const errors: string[] = [];
  if (typeof x !== "object" || x === null || Array.isArray(x)) return { ok: false, errors: ["Output harus berupa satu objek JSON."] };
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) errors.push(`Field tambahan tidak diizinkan: "${k}".`);
  for (const k of KEYS) if (!(k in o)) errors.push(`Field wajib hilang: "${k}".`);
  if (errors.length > 0) return { ok: false, errors };

  const status = o.status;
  if (status !== "dijawab" && status !== "tidak_ada_di_dokumen") errors.push('"status" harus "dijawab" atau "tidak_ada_di_dokumen".');
  const jawaban = typeof o.jawaban === "string" ? o.jawaban : (errors.push('"jawaban" harus string.'), "");
  if (typeof o.jawaban === "string" && jawaban.trim() === "") errors.push('"jawaban" tidak boleh kosong.');
  if (jawaban.length > 1500) errors.push('"jawaban" maksimal 1500 karakter.');

  const rujukan: { sumber: number }[] = [];
  if (!Array.isArray(o.rujukan)) errors.push('"rujukan" harus berupa daftar.');
  else {
    const dilihat = new Set<number>();
    for (const r of o.rujukan) {
      const s = (r as { sumber?: unknown } | null)?.sumber;
      const keys = r && typeof r === "object" ? Object.keys(r as object) : [];
      if (typeof s !== "number" || !Number.isInteger(s) || keys.length !== 1) { errors.push('Tiap butir "rujukan" harus berbentuk {"sumber": nomor}.'); continue; }
      if (s < 1 || s > jumlahSumber) { errors.push(`Rujukan ke Sumber ${s} tidak ada. Sumber yang tersedia: 1 sampai ${jumlahSumber}.`); continue; }
      if (dilihat.has(s)) { errors.push(`Sumber ${s} disebut dua kali.`); continue; }
      dilihat.add(s);
      rujukan.push({ sumber: s });
    }
  }
  const catatan = Array.isArray(o.catatan) && o.catatan.every((c) => typeof c === "string" && c.length <= 300) && o.catatan.length <= 10
    ? (o.catatan as string[]) : (errors.push('"catatan" harus daftar string (maks 10 butir, 300 karakter).'), []);

  if (status === "dijawab" && rujukan.length < 1) errors.push('Status "dijawab" wajib menyertakan minimal satu rujukan sumber.');
  if (status === "tidak_ada_di_dokumen" && rujukan.length > 0) errors.push('Status "tidak_ada_di_dokumen" harus punya "rujukan" kosong.');
  if (mode === "ringkas") {
    if (jawaban.length > MAX_RINGKAS_RAG) errors.push(`Mode "ringkas": "jawaban" maksimal ${MAX_RINGKAS_RAG} karakter.`);
    if (catatan.length > 0) errors.push('Mode "ringkas": "catatan" harus daftar kosong.');
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { status: status as RagOutput["status"], jawaban, rujukan, catatan } };
}
