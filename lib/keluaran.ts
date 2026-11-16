import { checkOutput, rungKeProgram, type BuktiSumber, type DraftOutput, type Mode } from "./schema";
import { parseProgram } from "./parser";
import { isInput, isOutput } from "./validator";
import { periksaProgram, type Pemeriksaan } from "./tools";
import type { Chunk } from "./rag-chunk";

// Validator deterministik (rancangan-sistem.md bagian 3 dan 4): memeriksa ISI keluaran model, bukan hanya bentuknya.
// Model boleh salah; kode yang memutuskan. Kegagalan di sini memicu perbaikan (maks 2 kali), lalu PERLU_KLARIFIKASI.

export const MAX_PERBAIKAN = 2;
export const CATATAN_TANPA_SUMBER =
  "Tidak ditemukan di manual: tidak ada potongan manual yang cukup mirip dengan deskripsi, jadi alamat dan nilai set di draf ini belum didukung kutipan manual. Cocokkan dengan W479, W480, dan W483 sebelum dipakai.";

export type HasilPeriksa =
  | { ok: true; value: DraftOutput; program: string; pemeriksaan?: Pemeriksaan }
  | { ok: false; errors: string[] };

const rapikan = (s: string) => s.replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();

/** Kutipan harus muncul apa adanya (selain beda spasi dan baris baru) di teks chunk dokumen yang disebut. */
function cocokkanBukti(bukti: BuktiSumber[], sumber: Chunk[], errors: string[]): BuktiSumber[] {
  const hasil: BuktiSumber[] = [];
  const tersedia = [...new Set(sumber.map((s) => s.dokumen))].join(", ");
  bukti.forEach((b, i) => {
    const kandidat = sumber.filter((s) => s.dokumen === b.dokumen);
    if (kandidat.length === 0) {
      errors.push(`bukti_sumber[${i}]: dokumen "${b.dokumen}" tidak ada di <sumber>. Dokumen yang tersedia: ${tersedia}.`);
      return;
    }
    const k = rapikan(b.kutipan);
    const chunk = kandidat.find((c) => rapikan(c.teks).includes(k));
    if (!chunk) {
      errors.push(`bukti_sumber[${i}]: kutipan tidak ditemukan apa adanya di teks ${b.dokumen} pada <sumber>. Salin kutipan persis dari <sumber>, jangan diparafrasa.`);
      return;
    }
    hasil.push({ dokumen: b.dokumen, halaman: chunk.halaman ?? null, kutipan: b.kutipan });
  });
  return hasil;
}

/** Alamat input/output yang dipakai program, dikumpulkan dari instruksi kontak dan OUT. */
function alamatIoProgram(program: string): { input: Set<string>; output: Set<string> } {
  const input = new Set<string>();
  const output = new Set<string>();
  for (const r of parseProgram(program).program)
    for (const ins of r.instructions) {
      if (ins.op === "TIM" || ins.op === "CNT" || ins.op === "ANDLD" || ins.op === "ORLD") continue;
      if (isInput(ins.arg)) input.add(ins.arg);
      else if (isOutput(ins.arg)) output.add(ins.arg);
    }
  return { input, output };
}

export function periksaKeluaran(x: unknown, mode: Mode, sumber: Chunk[], opsi: { catatanTanpaSumber?: string } = {}): HasilPeriksa {
  const bentuk = checkOutput(x, mode);
  if (!bentuk.ok) return bentuk;
  const v = bentuk.value;
  const errors: string[] = [];

  // tabel_io: alamat valid, jenis cocok dengan rentang, tidak ganda (semua status)
  const dilihat = new Set<string>();
  for (const t of v.tabel_io) {
    if (dilihat.has(t.alamat)) errors.push(`tabel_io: alamat ${t.alamat} muncul dua kali.`);
    dilihat.add(t.alamat);
    const benar = t.jenis === "input" ? isInput(t.alamat) : isOutput(t.alamat);
    if (!benar) errors.push(`tabel_io: ${t.alamat} bukan alamat ${t.jenis} CP1E yang valid (input 0.00 sampai 1.15, output 100.00 sampai 101.15).`);
  }

  if (v.status !== "BERHASIL") {
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: v, program: "" };
  }

  // program dari rung harus lolos parser dan validator
  const program = rungKeProgram(v.rung);
  const pemeriksaan = periksaProgram(program);
  if (!pemeriksaan.valid) {
    const daftar = [...pemeriksaan.galat_sintaks, ...pemeriksaan.masalah.filter((m) => m.tingkat === "error").map((m) => (m.rung !== undefined ? `rung ${m.rung}: ${m.pesan}` : m.pesan))];
    errors.push(`Program tidak lolos pemeriksaan: ${daftar.slice(0, 6).join(" ")}`);
  }

  // tabel_io harus sama dengan alamat input/output yang dipakai rung
  if (pemeriksaan.valid) {
    const dipakai = alamatIoProgram(program);
    for (const a of dipakai.input) if (!v.tabel_io.some((t) => t.alamat === a && t.jenis === "input")) errors.push(`Alamat input ${a} dipakai di rung tetapi tidak ada di tabel_io.`);
    for (const a of dipakai.output) if (!v.tabel_io.some((t) => t.alamat === a && t.jenis === "output")) errors.push(`Alamat output ${a} dipakai di rung tetapi tidak ada di tabel_io.`);
    for (const t of v.tabel_io)
      if (!(t.jenis === "input" ? dipakai.input : dipakai.output).has(t.alamat)) errors.push(`tabel_io memuat ${t.alamat} tetapi alamat itu tidak dipakai di rung manapun.`);
  }

  // bukti sumber
  let bukti: BuktiSumber[] = [];
  if (sumber.length === 0) {
    if (v.bukti_sumber.length > 0) errors.push('Tidak ada <sumber> pada permintaan ini, jadi "bukti_sumber" harus daftar kosong.');
  } else if (v.bukti_sumber.length === 0) {
    errors.push('Ada <sumber> pada permintaan ini, jadi "bukti_sumber" wajib berisi minimal satu kutipan langsung yang mendukung draf.');
  } else {
    bukti = cocokkanBukti(v.bukti_sumber, sumber, errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  const asumsi = sumber.length === 0 && opsi.catatanTanpaSumber ? [...v.asumsi, opsi.catatanTanpaSumber] : v.asumsi;
  return { ok: true, value: { ...v, asumsi, bukti_sumber: bukti }, program, pemeriksaan };
}

// ---- keluaran yang dibuat sistem sendiri (tanpa model) ----

export function keluaranDitolak(alasan: string): DraftOutput {
  return { status: "DITOLAK", alasan, tabel_io: [], rung: [], asumsi: [], tidak_dapat_ditentukan: [], bukti_sumber: [] };
}

/** Keluaran model tetap tidak valid setelah perbaikan: draf tidak ditampilkan (rancangan-sistem.md bagian 3). */
export function keluaranKlarifikasiGagal(galat: string[]): DraftOutput {
  const rinci = galat.join(" ").slice(0, 300);
  return {
    status: "PERLU_KLARIFIKASI",
    alasan: `Draf tidak ditampilkan karena keluaran model tidak lolos pemeriksaan setelah ${MAX_PERBAIKAN} kali perbaikan. Galat terakhir: ${rinci}`,
    tabel_io: [], rung: [], asumsi: [], bukti_sumber: [],
    tidak_dapat_ditentukan: ["Sistem belum bisa menyusun draf yang lolos pemeriksaan dari deskripsi ini. Jelaskan ulang urutan kerja dengan jumlah lampu, jumlah tombol, dan durasi yang jelas, lalu coba lagi."],
  };
}

// ---- konteks untuk model ----

/** Blok <sumber> untuk pesan pengguna. Isi chunk adalah data, bukan perintah. */
export function blokSumber(sumber: Chunk[]): string {
  if (sumber.length === 0)
    return 'Tidak ada potongan manual yang cukup mirip dengan deskripsi ini (tidak ditemukan di manual). "bukti_sumber" harus daftar kosong.';
  const isi = sumber
    .map((c) => `[Sumber ${c.id}] dokumen: ${c.dokumen} | halaman: ${c.halaman ?? "tidak diketahui"} | bagian: ${c.bagian}\n${c.teks.replace(/<\/?sumber>/gi, "")}`)
    .join("\n\n");
  return `<sumber>\n${isi}\n</sumber>`;
}
