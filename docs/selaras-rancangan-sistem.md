# Keselarasan kode dengan rancangan-sistem.md

Acuan: `rancangan-sistem.md` (UTS Minggu 8, tidak diubah). Kolom kanan menunjukkan di mana bagian itu sekarang ada di kode.

| Rancangan | Di kode |
|---|---|
| Bagian 3: retrieval 4 chunk sebelum model | `ambilSumber` di `lib/rag.ts`, dipanggil `lib/draft.ts` dan `lib/agent.ts`; pencari dimuat `pencariBersama` di `lib/rag-muat.ts` |
| Bagian 3 dan 4: validator deterministik, ulang maks 2 kali, lalu PERLU_KLARIFIKASI tanpa draf | `lib/keluaran.ts` (`periksaKeluaran`, `MAX_PERBAIKAN = 2`, `keluaranKlarifikasiGagal`) |
| Bagian 4: schema `status`, `tabel_io`, `rung`, `asumsi`, `tidak_dapat_ditentukan`, `bukti_sumber` | `lib/schema.ts` |
| Bagian 4: instruksi dari himpunan dasar, alamat sesuai rentang | `lib/parser.ts`, `lib/validator.ts` (tidak diubah; `isOutput` kini diekspor) |
| Bagian 4: bukti berupa kutipan langsung yang bisa dicocokkan dengan teks manual | `cocokkanBukti` di `lib/keluaran.ts` |
| Bagian 4: dua mode keluaran | `penuh` dan `ringkas` di `lib/schema.ts` (lihat keputusan 3 di bawah) |
| Bagian 6: metadata chunk dokumen, halaman, bagian | `Chunk.halaman` di `lib/rag-chunk.ts` |
| Bagian 6: tidak ada chunk di atas ambang → "tidak ditemukan di manual" | `CATATAN_TANPA_SUMBER` di `lib/keluaran.ts` (lihat keputusan 1) |
| Bagian 6: pertanyaan tersebar tidak digabung lintas dokumen | Tidak ditambahkan, sesuai keputusanmu |
| Bagian 5: hasil kosong dianggap galat | `validate` untuk program kosong (sudah ada); `rung` kosong pada BERHASIL ditolak |

## Yang sengaja tidak kuubah, tetapi berbeda dari rancangan
1. **Nama dan jumlah tool.** Rancangan menyebut dua tool (`periksa_alamat_sintaks`, `telusur_scan`) yang hanya membaca. Kode memakai `periksa_program` dan `simulasikan_program`, ditambah `simpan_draf` dengan persetujuan manusia. `rancangan-agent.md` (Minggu 10) sudah mendeskripsikan tiga tool itu, jadi kode lebih selaras dengan dokumen yang lebih baru. Kalau laporan akhir mengacu ke rancangan Minggu 8, tulis bahwa nama dan satu tool berubah di Minggu 10.
2. **Himpunan instruksi.** Rancangan bagian 4 menyebut LD sampai CNT; kode juga menerima ANDLD dan ORLD (perlu untuk blok, dicatat di `prompts/v5.md`).

## Keputusan yang perlu kamu tegaskan
Rancangan diam tentang hal-hal ini, jadi kuputuskan sementara. Ubah kalau tidak cocok.
1. **Tidak ada chunk di atas ambang.** Rancangan bagian 3 menulis "tidak ditemukan di manual". Kuterapkan sebagai: draf tetap dibuat, `bukti_sumber` kosong, dan `asumsi` mendapat catatan itu. Alternatifnya menolak seluruh permintaan, tetapi deskripsi lampu berjalan jarang mirip secara kata kunci dengan teks manual, jadi hampir semua permintaan akan ditolak.
2. **Field `alasan`.** Rancangan tidak punya tempat untuk alasan `DITOLAK`. Kutambahkan satu field `alasan` (wajib untuk DITOLAK, kosong untuk BERHASIL). Tidak ada field lain di luar rancangan.
3. **Isi mode `ringkas`.** Rancangan hanya mewajibkan adanya mode ringkas. Kudefinisikan: `keterangan` di `tabel_io` kosong, `asumsi` maksimal 3 butir, `bukti_sumber` maksimal 1 butir.
4. **Tabel I/O ketat.** Tabel harus memuat persis alamat input dan output yang dipakai rung (tidak kurang, tidak lebih). Dengan model sungguhan ini bisa memicu banyak perbaikan; kalau begitu, longgarkan di `periksaKeluaran`.

## Bukan bagian dari perubahan ini
Ambang kemiripan di `data/indeks/konfigurasi.json` masih placeholder sampai kalibrasi Minggu 9. Selama ambang terlalu tinggi, setiap draf akan jatuh ke jalur "tidak ditemukan di manual".
