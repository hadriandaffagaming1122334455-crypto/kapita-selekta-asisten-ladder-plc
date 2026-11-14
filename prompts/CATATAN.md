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

## v3
Perubahan dari v2: simulator dan validator sekarang mendukung CNT, ANDLD, dan ORLD, jadi daftar instruksi di prompt diperluas dan aturan 3 (tidak_bisa) tidak lagi menolak ketiganya. `app/api/draft/route.ts` memakai v3. v2 tetap disimpan sebagai riwayat.

| Perubahan | Alasan |
|---|---|
| Tambah ANDLD, ORLD, CNT dan penjelasan blok | Prompt harus selaras dengan kemampuan `lib/validator.ts` dan `lib/simulator.ts`. Kalau prompt melarang sesuatu yang sudah didukung, model menolak permintaan yang sebenarnya bisa dikerjakan. |
| Aturan "semua blok digabung sebelum OUT/TIM" | Ini yang diperiksa validator. Menyebutnya di prompt mengurangi draf yang ditolak validator. |
| CNT: dua kondisi (hitung, lalu reset) | Format ini yang dibaca parser dan simulator. |
| Nomor TIM dan CNT tidak boleh sama | Aturan validator. Asumsinya masih harus dicocokkan dengan manual W483/W480. |

Hipotesis yang perlu diuji dengan model sungguhan: model mungkin lupa menggabungkan blok dengan ANDLD/ORLD, atau salah urutan input hitung dan reset pada CNT. Catat hasilnya di bagian titik lemah di bawah.

## agent-v1 (lapisan 4)
Prompt terpisah untuk agent (`prompts/agent-v1.md`), dipakai `app/api/agent/route.ts`. Perbedaan dari v3: ada urutan kerja (susun, periksa, simulasi, jawab), aturan kapan boleh meminta penyimpanan, dan perintah untuk berhenti dengan status "tidak_bisa" kalau perbaikan berulang tidak berhasil. Urutan dan batas itu juga dipaksa oleh kode (`lib/agent.ts`), jadi prompt bukan satu-satunya penjaga.

## Batas akses tool
`periksa_program`: fungsi murni di `lib/tools.ts`. Hanya membaca teks yang dikirim model. Tidak membaca berkas, tidak memakai jaringan, tidak membaca variabel lingkungan.

## Titik lemah yang ditemukan
(isi sendiri dari hasil uji: minimal satu input yang membuat sistem gagal, beserta penyebabnya)
