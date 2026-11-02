// Rentang alamat. ANGKA INI HARUS DICOCOKKAN dengan manual W480/W479
// untuk tipe CP1E yang kamu pakai (jumlah I/O beda tiap model).
// Mengubah angka di sini cukup; validator dan simulator mengikuti.

export const ADDRESS_CONFIG = {
  inputWords: [0, 1], // 0.00-0.11, 1.00-1.11 (isi sesuai model)
  inputBitsPerWord: 12,
  outputWords: [100, 101], // 100.00-100.07, dst
  outputBitsPerWord: 8,
  workMaxWord: 99, // W0.00 - W99.15 (verifikasi di manual)
  maxTimerNo: 255, // T0000 - T0255 (timer & counter berbagi nomor)
};
