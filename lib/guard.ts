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
