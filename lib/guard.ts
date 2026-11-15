// Lapis 1 guardrails: bersihkan atau tolak input sebelum sampai ke model.
// LEMAH dan sengaja begitu: hanya menangkap serangan yang kasar. Perlindungan sebenarnya ada
// di lapis 3 (batas akses tool) dan lapis 5 (persetujuan manusia).

export const MAX_DESKRIPSI = 1500;

const POLA_MENCURIGAKAN: RegExp[] = [
  /abaikan\s+(semua\s+)?(instruksi|aturan|perintah)/i,
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /system\s*prompt/i,
  /(periksa_program|simulasikan_program|simpan_draf)/i, // pengguna tidak perlu menyebut nama tool
];

export function bersihkanDeskripsi(x: unknown): { ok: true; teks: string } | { ok: false; alasan: string } {
  if (typeof x !== "string") return { ok: false, alasan: "Deskripsi harus berupa teks." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x)) return { ok: false, alasan: "Deskripsi memuat karakter kontrol." };
  const teks = x.replace(/<\/?deskripsi>/gi, "").trim();
  if (teks === "") return { ok: false, alasan: "Deskripsi tidak boleh kosong." };
  if (teks.length > MAX_DESKRIPSI) return { ok: false, alasan: `Deskripsi maksimal ${MAX_DESKRIPSI} karakter.` };
  if (POLA_MENCURIGAKAN.some((p) => p.test(teks))) return { ok: false, alasan: "Deskripsi memuat pola yang ditolak oleh penyaring input." };
  return { ok: true, teks };
}

export const NAMA_BERKAS_RE = /^[a-z0-9-]{1,40}$/;

export const MAX_PERTANYAAN = 500;

// Lapis 1 untuk pertanyaan RAG. Sama lemahnya dengan bersihkanDeskripsi: hanya menyaring yang kasar.
export function bersihkanPertanyaan(x: unknown): { ok: true; teks: string } | { ok: false; alasan: string } {
  if (typeof x !== "string") return { ok: false, alasan: "Pertanyaan harus berupa teks." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x)) return { ok: false, alasan: "Pertanyaan memuat karakter kontrol." };
  const teks = x.replace(/<\/?(sumber|deskripsi)>/gi, "").trim();
  if (teks === "") return { ok: false, alasan: "Pertanyaan tidak boleh kosong." };
  if (teks.length > MAX_PERTANYAAN) return { ok: false, alasan: `Pertanyaan maksimal ${MAX_PERTANYAAN} karakter.` };
  if (POLA_MENCURIGAKAN.some((p) => p.test(teks))) return { ok: false, alasan: "Pertanyaan memuat pola yang ditolak oleh penyaring input." };
  return { ok: true, teks };
}

// Penolakan fungsi keselamatan di KODE, bukan hanya di prompt (prompt v1 menolaknya, tapi v2/v3 sempat tidak memuat aturan ini).
// Sengaja sempit: hanya frasa yang jelas menyebut fungsi keselamatan. Frasa yang lolos tetap ditangani aturan di prompt.
const POLA_KESELAMATAN: RegExp[] = [
  /emergency\s*[- ]?stop|\be-?stop\b|\bestop\b/i,
  /interlock/i,
  /fungsi\s+keselamatan|safety\s+(relay|function|circuit|plc)/i,
  /pengaman\s+(mesin|operator|manusia|orang)|light\s*curtain|tirai\s+cahaya/i,
];
export const PESAN_KESELAMATAN =
  "Fungsi keselamatan (mis. emergency stop atau interlock) tidak disusun oleh asisten ini. Draf hanya untuk belajar dan simulasi, bukan untuk mengamankan mesin atau orang. Konsultasikan dengan dosen dan acu standar keselamatan yang berlaku.";
export function tolakKeselamatan(teks: string): string | null {
  return POLA_KESELAMATAN.some((p) => p.test(teks)) ? PESAN_KESELAMATAN : null;
}
