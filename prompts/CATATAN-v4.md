# Catatan v4 dan agent-v2

Gabungkan bagian ini ke `prompts/CATATAN.md` kalau mau satu berkas.

## v4 (dan agent-v2)
Perubahan dari v3 (agent-v2 dari agent-v1). `app/api/draft/route.ts` memakai v4 dan `app/api/agent/route.ts` memakai agent-v2.

Latar belakang: uji prompt v1 di ChatGPT (lihat `docs/uji-prompt-v1.md`) menunjukkan tiga perilaku yang sebelumnya ada di v1 tetapi hilang di v2 dan v3:

| Perubahan | Alasan |
|---|---|
| Tolak fungsi keselamatan (emergency stop, interlock) dan sarankan konsultasi ke dosen | Ada di prompt v1 bagian Batasan, tapi tidak terbawa ke v2 dan v3. Masukan 5 pada uji v1 menguji ini. Juga dipasang di kode (`tolakKeselamatan` di `lib/guard.ts`), jadi tidak hanya bergantung pada kepatuhan model. |
| Tolak permintaan gambar, dengan satu contoh penolakan | Masukan 6 pada uji v1 gagal: ChatGPT membuat gambar walau dilarang. Dugaan penyebab: larangan hanya satu baris dan contoh hanya dua. v4 menambah contoh penolakan gambar. Ini cara membuktikan dugaan itu: kirim ulang masukan 6 dan lihat apakah sekarang ditolak. |
| Jangan menebak jumlah lampu, tombol, durasi, atau urutan; jawab "PERLU KLARIFIKASI:" dengan satu pertanyaan | Aturan TIDAK DAPAT DITENTUKAN di v1 membuat masukan 4 berhasil (model bertanya, bukan menebak). v2 dan v3 justru menyuruh model memilih sendiri apa yang tidak disebut. v4 membedakan: alamat boleh dipilih dan dicatat, jumlah dan durasi tidak boleh ditebak. |
| Tiga contoh penolakan dan klarifikasi ditambahkan | Contoh meningkatkan kepatuhan pada format penolakan. Belum diuji, hanya dugaan. |

Yang belum terbukti: bahwa v4 benar-benar menolak masukan 5 dan 6 dan bertanya pada masukan 4. Itu hanya bisa dibuktikan dengan menjalankan enam masukan pada model sungguhan (tabel kosong di `docs/uji-prompt-v1.md`). Kode di `lib/guard.ts` menjamin penolakan untuk frasa keselamatan yang jelas, tapi tidak untuk semua kemungkinan kalimat.
