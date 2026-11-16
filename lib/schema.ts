// Schema tetap untuk output model (lapisan 2). Mengikuti rancangan-sistem.md bagian 4:
//   status | tabel_io | rung | asumsi | tidak_dapat_ditentukan | bukti_sumber
// Satu field tambahan, "alasan", karena rancangan tidak punya tempat untuk alasan penolakan (DITOLAK).
// Dipakai untuk memeriksa BENTUK jawaban model sebelum sampai ke pengguna. Pemeriksaan isi (alamat, sintaks,
// kecocokan tabel I/O dengan rung, kutipan) ada di lib/keluaran.ts. Sengaja ditulis tangan, tanpa pustaka tambahan.

export type Mode = "penuh" | "ringkas";
export type StatusDraf = "BERHASIL" | "PERLU_KLARIFIKASI" | "DITOLAK";

export interface TabelIoItem {
  alamat: string; // mis. "0.00" atau "100.00"
  nama: string;
  jenis: "input" | "output";
  keterangan: string;
}
export interface RungItem {
  nomor: number; // berurutan mulai dari 1
  instruksi: string[]; // satu mnemonic Omron per butir, komentar "// nama" boleh di akhir
}
export interface BuktiSumber {
  dokumen: string; // kode dokumen, mis. "W483"
  halaman: number | null; // diisi sistem dari metadata chunk; null kalau indeks tidak punya nomor halaman
  kutipan: string; // kutipan langsung dari manual; diverifikasi sistem terhadap teks chunk
}

export interface DraftOutput {
  status: StatusDraf;
  alasan: string; // wajib terisi jika DITOLAK, kosong jika BERHASIL, bebas (penjelasan sistem) jika PERLU_KLARIFIKASI
  tabel_io: TabelIoItem[];
  rung: RungItem[]; // kosong kecuali BERHASIL
  asumsi: string[];
  tidak_dapat_ditentukan: string[]; // hal yang kurang dari deskripsi; wajib terisi jika PERLU_KLARIFIKASI
  bukti_sumber: BuktiSumber[];
}

const KEYS = ["status", "alasan", "tabel_io", "rung", "asumsi", "tidak_dapat_ditentukan", "bukti_sumber"];
const STATUS: StatusDraf[] = ["BERHASIL", "PERLU_KLARIFIKASI", "DITOLAK"];
export const MAX_PROGRAM = 4000;
const MAX_ITEMS = 20;
const MAX_TEXT = 400;
const MAX_IO = 30;
const MAX_RUNG = 20;
const MAX_INSTRUKSI = 40;
export const MIN_KUTIPAN = 15;
export const MAX_KUTIPAN = 300;
export const MAX_ASUMSI_RINGKAS = 3;
export const MAX_BUKTI_RINGKAS = 1;
const MAX_BUKTI = 5;

export type CheckResult = { ok: true; value: DraftOutput } | { ok: false; errors: string[] };

/** Mengubah daftar rung menjadi teks mnemonic untuk parser, validator, dan simulator (satu instruksi per baris, baris kosong antar rung). */
export function rungKeProgram(rung: RungItem[]): string {
  return rung.map((r) => r.instruksi.join("\n")).join("\n\n");
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function checkOutput(x: unknown, mode: Mode): CheckResult {
  const errors: string[] = [];
  if (!isObj(x)) return { ok: false, errors: ["Output harus berupa satu objek JSON."] };
  const o = x;

  for (const k of Object.keys(o)) if (!KEYS.includes(k)) errors.push(`Field tambahan tidak diizinkan: "${k}".`);
  for (const k of KEYS) if (!(k in o)) errors.push(`Field wajib hilang: "${k}".`);
  if (errors.length > 0) return { ok: false, errors };

  const strArr = (k: string): string[] => {
    const v = o[k];
    if (!Array.isArray(v) || !v.every((i) => typeof i === "string" && i.trim() !== "" && i.length <= MAX_TEXT)) {
      errors.push(`"${k}" harus berupa daftar string tidak kosong (maks ${MAX_TEXT} karakter per butir).`);
      return [];
    }
    if (v.length > MAX_ITEMS) errors.push(`"${k}" maksimal ${MAX_ITEMS} butir.`);
    return v as string[];
  };

  const status = o.status as StatusDraf;
  if (!STATUS.includes(status)) errors.push('"status" harus salah satu dari "BERHASIL", "PERLU_KLARIFIKASI", "DITOLAK".');
  const alasan = typeof o.alasan === "string" ? o.alasan : (errors.push('"alasan" harus string.'), "");
  if (alasan.length > MAX_TEXT) errors.push(`"alasan" maksimal ${MAX_TEXT} karakter.`);
  const asumsi = strArr("asumsi");
  const tidakDapat = strArr("tidak_dapat_ditentukan");

  // ---- tabel_io ----
  const tabelIo: TabelIoItem[] = [];
  if (!Array.isArray(o.tabel_io) || o.tabel_io.length > MAX_IO) errors.push(`"tabel_io" harus berupa daftar (maks ${MAX_IO} butir).`);
  else {
    for (const [i, t] of o.tabel_io.entries()) {
      const ket = isObj(t) ? Object.keys(t).sort().join(",") : "";
      if (!isObj(t) || ket !== "alamat,jenis,keterangan,nama") { errors.push(`tabel_io[${i}] harus berisi tepat: alamat, nama, jenis, keterangan.`); continue; }
      const { alamat, nama, jenis, keterangan } = t;
      if (typeof alamat !== "string" || alamat.trim() === "") { errors.push(`tabel_io[${i}].alamat harus string tidak kosong.`); continue; }
      if (typeof nama !== "string" || nama.trim() === "" || nama.length > 40) { errors.push(`tabel_io[${i}].nama harus string tidak kosong (maks 40 karakter).`); continue; }
      if (jenis !== "input" && jenis !== "output") { errors.push(`tabel_io[${i}].jenis harus "input" atau "output".`); continue; }
      if (typeof keterangan !== "string" || keterangan.length > 120) { errors.push(`tabel_io[${i}].keterangan harus string (maks 120 karakter).`); continue; }
      tabelIo.push({ alamat: alamat.trim(), nama: nama.trim(), jenis, keterangan });
    }
  }

  // ---- rung ----
  const rung: RungItem[] = [];
  if (!Array.isArray(o.rung) || o.rung.length > MAX_RUNG) errors.push(`"rung" harus berupa daftar (maks ${MAX_RUNG} rung).`);
  else {
    for (const [i, r] of o.rung.entries()) {
      const ok = isObj(r) && Object.keys(r).sort().join(",") === "instruksi,nomor";
      if (!isObj(r) || !ok) { errors.push(`rung[${i}] harus berisi tepat: nomor, instruksi.`); continue; }
      if (r.nomor !== i + 1) errors.push(`rung[${i}].nomor harus ${i + 1} (nomor berurutan mulai dari 1).`);
      const ins = r.instruksi;
      if (!Array.isArray(ins) || ins.length < 1 || ins.length > MAX_INSTRUKSI || !ins.every((s) => typeof s === "string" && s.trim() !== "" && !s.includes("\n") && s.length <= 100)) {
        errors.push(`rung[${i}].instruksi harus daftar 1 sampai ${MAX_INSTRUKSI} string, satu instruksi per butir (maks 100 karakter, tanpa baris baru).`);
        continue;
      }
      rung.push({ nomor: i + 1, instruksi: (ins as string[]).map((s) => s.trim()) });
    }
  }
  const panjangProgram = rungKeProgram(rung).length;
  if (panjangProgram > MAX_PROGRAM) errors.push(`Program terlalu panjang (maks ${MAX_PROGRAM} karakter).`);

  // ---- bukti_sumber (bentuk saja; kecocokan dengan teks manual diperiksa di lib/keluaran.ts) ----
  const bukti: BuktiSumber[] = [];
  if (!Array.isArray(o.bukti_sumber) || o.bukti_sumber.length > MAX_BUKTI) errors.push(`"bukti_sumber" harus berupa daftar (maks ${MAX_BUKTI} butir).`);
  else {
    for (const [i, b] of o.bukti_sumber.entries()) {
      if (!isObj(b) || Object.keys(b).sort().join(",") !== "dokumen,halaman,kutipan") { errors.push(`bukti_sumber[${i}] harus berisi tepat: dokumen, halaman, kutipan.`); continue; }
      const { dokumen, halaman, kutipan } = b;
      if (typeof dokumen !== "string" || dokumen.trim() === "") { errors.push(`bukti_sumber[${i}].dokumen harus string tidak kosong.`); continue; }
      if (halaman !== null && !(typeof halaman === "number" && Number.isInteger(halaman) && halaman >= 1)) { errors.push(`bukti_sumber[${i}].halaman harus bilangan bulat >= 1 atau null.`); continue; }
      if (typeof kutipan !== "string" || kutipan.trim().length < MIN_KUTIPAN || kutipan.length > MAX_KUTIPAN) { errors.push(`bukti_sumber[${i}].kutipan harus string ${MIN_KUTIPAN} sampai ${MAX_KUTIPAN} karakter.`); continue; }
      bukti.push({ dokumen: dokumen.trim(), halaman: halaman as number | null, kutipan: kutipan.trim() });
    }
  }

  // ---- aturan antar field menurut status ----
  if (STATUS.includes(status)) {
    if (status === "BERHASIL") {
      if (rung.length < 1) errors.push('Status "BERHASIL" butuh minimal satu rung.');
      if (tabelIo.length < 1) errors.push('Status "BERHASIL" butuh "tabel_io" terisi.');
      if (tidakDapat.length > 0) errors.push('Status "BERHASIL" harus punya "tidak_dapat_ditentukan" kosong. Kalau masih ada yang tidak jelas, pakai "PERLU_KLARIFIKASI".');
      if (alasan !== "") errors.push('Status "BERHASIL" harus punya "alasan" kosong.');
      if (mode === "penuh" && tabelIo.some((t) => t.keterangan.trim() === "")) errors.push('Mode "penuh": tiap butir "tabel_io" butuh "keterangan" terisi.');
    }
    if (status === "PERLU_KLARIFIKASI") {
      if (tidakDapat.length < 1) errors.push('Status "PERLU_KLARIFIKASI" butuh minimal satu butir "tidak_dapat_ditentukan" (isi dengan pertanyaan yang harus dijawab pengguna).');
      if (rung.length > 0) errors.push('Status "PERLU_KLARIFIKASI" harus punya "rung" kosong: logika yang belum jelas tidak boleh ditebak.');
      if (bukti.length > 0) errors.push('Status "PERLU_KLARIFIKASI" harus punya "bukti_sumber" kosong.');
    }
    if (status === "DITOLAK") {
      if (alasan.trim() === "") errors.push('Status "DITOLAK" butuh "alasan" terisi.');
      if (tabelIo.length > 0 || rung.length > 0 || bukti.length > 0 || asumsi.length > 0 || tidakDapat.length > 0)
        errors.push('Status "DITOLAK" harus punya "tabel_io", "rung", "asumsi", "tidak_dapat_ditentukan", dan "bukti_sumber" kosong.');
    }
    if (mode === "ringkas") {
      if (tabelIo.some((t) => t.keterangan !== "")) errors.push('Mode "ringkas": "keterangan" di "tabel_io" harus string kosong.');
      if (asumsi.length > MAX_ASUMSI_RINGKAS) errors.push(`Mode "ringkas": "asumsi" maksimal ${MAX_ASUMSI_RINGKAS} butir.`);
      if (bukti.length > MAX_BUKTI_RINGKAS) errors.push(`Mode "ringkas": "bukti_sumber" maksimal ${MAX_BUKTI_RINGKAS} butir.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { status, alasan, tabel_io: tabelIo, rung, asumsi, tidak_dapat_ditentukan: tidakDapat, bukti_sumber: bukti } };
}
