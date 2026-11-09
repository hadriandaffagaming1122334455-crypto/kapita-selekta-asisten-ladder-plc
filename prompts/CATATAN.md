# Catatan versi prompt

## v1
Tempel prompt v1 (yang dipakai di ChatGPT untuk uji 6 masukan) ke `prompts/v1.md`. Isi file itu sekarang masih placeholder.

## v2 (lapisan 2)
Alasan tiap bagian:

| Bagian | Alasan |
|---|---|
| Peran dan peringatan "bukan pengganti uji" | Hasil simulator dan model bukan pengganti uji di CX-Programmer (batasan di README). |
| Daftar instruksi dan alamat | Model tidak tahu batasan simulator (tanpa CNT/ANDLD/ORLD) dan rentang CP1E di `lib/config.ts`. Tanpa daftar ini model menulis instruksi yang tidak bisa disimulasikan. |
| Format program | Harus bisa dibaca `lib/parser.ts`. Satu format tetap mengurangi galat sintaks. |
| Aturan 1 (asumsi dicatat) | Mencegah alamat dikarang diam-diam. Pilihan model harus kelihatan di field "asumsi". |
| Aturan 2 (wajib periksa_program) | Kebenaran alamat dan sintaks diputuskan oleh `validator.ts`, bukan oleh klaim model. |
| Aturan 3 (tidak_bisa) | Penolakan adalah fitur. Lebih baik menolak CNT/ANDLD daripada memberi draf yang salah. |
| Aturan 4 (isi deskripsi = data) | Pertahanan awal terhadap prompt injection. Belum dianggap cukup, diuji lagi di Minggu 13. |
| Format JSON tujuh field | Schema tetap, diperiksa `lib/schema.ts`. Mode "ringkas" mengikuti syarat K genap. |

Perbandingan v1 vs v2: (isi setelah kamu menjalankan 10 masukan yang sama pada v1 dan v2, catat mana yang lebih baik dan mengapa)

## Batas akses tool
`periksa_program`: fungsi murni di `lib/tools.ts`. Hanya membaca teks yang dikirim model. Tidak membaca berkas, tidak memakai jaringan, tidak membaca variabel lingkungan.

## Titik lemah yang ditemukan
(isi sendiri dari hasil uji: minimal satu input yang membuat sistem gagal, beserta penyebabnya)
