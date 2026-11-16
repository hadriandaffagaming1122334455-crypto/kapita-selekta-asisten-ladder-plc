# Catatan v5 dan agent-v3

Gabungkan bagian ini ke `prompts/CATATAN.md` kalau mau satu berkas. `app/api/draft/route.ts` memakai v5 dan `app/api/agent/route.ts` memakai agent-v3.

## Apa yang berubah dari v4 / agent-v2
Skema keluaran disamakan dengan `rancangan-sistem.md` bagian 4, dan RAG masuk ke alur penyusunan draf (bagian 3 dan 6). Aturan v4 (tolak keselamatan, tolak gambar, jangan menebak jumlah atau durasi) tetap ada, hanya ditulis ulang dalam skema baru.

| Perubahan | Alasan |
|---|---|
| `status` menjadi `BERHASIL`, `PERLU_KLARIFIKASI`, `DITOLAK` (dulu `draf` dan `tidak_bisa`) | Rancangan bagian 4. Uji v1 menunjukkan model mengarang status ("BERHASIL — DRAF AWAL"), jadi nilai di luar tiga ini ditolak validator. |
| `tabel_io`, `rung` (daftar `{nomor, instruksi[]}`), `tidak_dapat_ditentukan`, `bukti_sumber` menggantikan `ringkasan`, `program`, `penjelasan`, `perlu_dicek` | Rancangan bagian 4. Teks program untuk parser, validator, dan simulator dibentuk sistem dari `rung`. |
| Pertanyaan klarifikasi ditaruh di `tidak_dapat_ditentukan`, `rung` wajib kosong | Rancangan bagian 4: tanpa nilai eksplisit model terdorong menebak jumlah lampu, tombol, atau durasi. Kode menolak `PERLU_KLARIFIKASI` yang membawa rung. |
| Validator isi (`lib/keluaran.ts`): alamat, sintaks, tabel I/O harus sama dengan alamat input/output di rung | Rancangan bagian 3: validasi oleh program, bukan oleh model. |
| Perbaikan maksimal 2 kali (dulu 1), lalu `PERLU_KLARIFIKASI` tanpa draf | Rancangan bagian 3 dan 4. |
| Retrieval 4 chunk teratas sebelum model dipanggil; chunk dikirim di blok `<sumber>` | Rancangan bagian 3 dan 6. |
| `bukti_sumber` = `{dokumen, halaman, kutipan}`; kutipan harus ada apa adanya di chunk dokumen itu, halaman diisi sistem dari metadata chunk | Rancangan bagian 4: kutipan langsung bisa dicocokkan dengan teks manual, ringkasan bisa mengarang. |
| Tidak ada chunk di atas ambang: draf tetap dibuat, `bukti_sumber` kosong, sistem menambah catatan "Tidak ditemukan di manual" ke `asumsi` | Lihat "Keputusan yang perlu kamu tegaskan" di `docs/selaras-rancangan-sistem.md`. |

## Yang belum terbukti
- Tes memakai model tiruan berskrip. Belum ada bukti bahwa model sungguhan menghasilkan JSON dalam skema ini, menyalin kutipan persis, atau mematuhi aturan tabel I/O. Jalankan enam masukan uji v1 dan sepuluh pertanyaan Minggu 9 pada model sungguhan, lalu isi tabel hasilnya.
- Nomor halaman hanya ada kalau teks manual diekstrak dengan pemisah halaman (`\f`) dan indeks dibangun ulang. Belum diuji dengan manual Omron asli.
