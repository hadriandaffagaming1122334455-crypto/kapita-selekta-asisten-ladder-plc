# Rancangan Agent: Asisten Draf Ladder PLC

Draf awal untuk Minggu 10 sampai 11. Tanda **[ISI]** berarti bagian yang hanya bisa kamu lengkapi dari hasil uji dengan model sungguhan atau dari keputusanmu sendiri. Jawaban di bagian 1 adalah usulan yang jujur, bukan jawaban final: baca, ubah kalau tidak sesuai, dan pastikan kamu bisa mempertahankannya.

## 1. Empat pertanyaan sebelum menjadikannya agent

1. **Apakah urutan langkahnya tidak bisa ditentukan di awal?** Sebagian. Kerangkanya tetap: susun program, periksa, simulasi, jawab. Yang tidak bisa ditentukan di awal adalah berapa putaran perbaikan yang dibutuhkan dan skenario uji apa yang cocok untuk deskripsi tertentu. Jadi sistem ini lebih dekat ke workflow dengan satu putaran yang diputuskan model, dan bagian agentic-nya sempit.
2. **Berapa biaya terburuk kalau agent berputar sampai batas langkah?** Satu tugas maksimal 8 panggilan model, tiap jawaban dibatasi 1200 token, dan hasil tool dipotong 1500 karakter di konteks. Angka rupiah atau dolarnya: **[ISI setelah tahu harga model dari gateway]**.
3. **Kalau agent mengambil langkah yang salah, apa akibatnya dan bisakah dibatalkan?** Dua tool (periksa dan simulasi) tidak punya efek keluar, jadi langkah salah hanya membuang satu langkah. Satu-satunya efek keluar adalah menulis berkas, dan itu tidak dijalankan agent: harus disetujui manusia.
4. **Bagaimana menguji sesuatu yang langkahnya berbeda tiap kali?** Dua cara. Alur dan batasnya diuji dengan model tiruan berskrip (`lib/test-agent.ts`). Perilaku model sungguhan diuji dengan menjalankan tugas yang sama tiga kali dan mencatat perbedaan urutan langkahnya di trace: **[ISI hasilnya]**.

## 2. Pola orkestrasi

Satu agent dengan loop berbatas. Bukan multi-agent: tidak ada bukti bahwa satu agent dengan tool yang baik tidak cukup untuk tugas ini, dan multi-agent akan menambah biaya dan menyulitkan pelacakan masalah.

## 3. Tool dan batas aksesnya

Jumlah minimum untuk K = 36 adalah 2 tool (2 + 36 mod 2). Ada tiga di sini: dua yang dipanggil bebas, satu yang dikunci.

| Tool | Fungsi | Batas akses (dipasang di kode, `lib/agent-tools.ts`) |
|---|---|---|
| `periksa_program` | Memeriksa sintaks dan alamat program | Fungsi murni. Hanya membaca teks yang dikirim model. Tidak menyentuh berkas atau jaringan. |
| `simulasikan_program` | Menjalankan program pada skenario masukan | Fungsi murni. Maksimal 600 scan, 50 kejadian, 10 pengamatan, 12 alamat. Kejadian hanya boleh mengubah alamat input. Program harus valid dulu. |
| `simpan_draf` | Mengusulkan penyimpanan program akhir | Tidak menulis apa pun. Hanya ditawarkan kalau pengguna meminta penyimpanan. Nama berkas ditentukan permintaan pengguna, bukan model. Hanya program yang lolos periksa dan sudah disimulasikan yang bisa diusulkan. |

## 4. State tugas (di luar percakapan)

Setiap tugas disimpan sebagai `data/tugas/<id>.json` dan ditulis ulang di tiap langkah. Isinya: status, nomor langkah, program terbaru, hasil periksa terakhir, hasil simulasi terakhir, usulan penyimpanan, jawaban akhir, dan trace. Bisa dibaca langsung atau lewat `GET /api/agent?id=<id>`. Konteks yang dikirim ke model dijaga ramping: hasil tool dipotong, dan state lengkap ada di berkas, bukan di riwayat percakapan.

## 5. Batas langkah dan kegagalan

- **Batas langkah:** 8 panggilan model. Kalau tercapai, status menjadi `batas_langkah`, pesan ke pengguna menyebut agent berhenti sebelum selesai, program terakhir tetap tersimpan di state, dan tidak ada tindakan yang dijalankan.
- **Maksimal 3 panggilan tool dalam satu langkah.** Sisanya ditolak dan dicatat.
- **Tool gagal:** dicoba ulang 2 kali (3 percobaan). Kalau tetap gagal, model diberi tahu. Kalau tool gagal permanen dua kali, tugas dihentikan dengan status `gagal`.
- **Model gagal:** dicoba ulang 1 kali, lalu status `gagal`.
- **Format jawaban akhir salah:** diminta memperbaiki satu kali, lalu `gagal`.

## 6. Human-in-the-loop

Titik persetujuan: `simpan_draf`. Menulis berkas bisa menimpa berkas lama, dan itu tidak bisa dibatalkan. Alurnya:

1. Agent memanggil `simpan_draf`. Sistem membuat usulan dan berhenti (`menunggu_persetujuan`). Belum ada yang ditulis.
2. Usulan menampilkan apa persisnya yang akan terjadi: jalur berkas, ukuran, isi lengkap, apakah berkas lama akan ditimpa, dan apakah program lolos pemeriksaan.
3. Manusia memanggil `POST /api/agent/setujui` dengan `setuju` atau `tolak`.
4. Saat setuju, sistem memeriksa ulang isi usulan dan nama berkas sebelum menulis. Persetujuan kedua pada tugas yang sama ditolak.

## 7. Bagian yang sengaja tidak agentic

- **Parser, validator, dan simulator** adalah kode deterministik. Kebenaran program diputuskan oleh kode, bukan oleh pendapat model.
- **Pemeriksaan akhir** dihitung ulang oleh sistem. Klaim model bahwa programnya valid tidak dipercaya.
- **Urutan "periksa dan simulasi dulu, baru boleh diusulkan disimpan"** dipaksa oleh kode, tidak diserahkan ke kepatuhan model.
- **Keputusan menyimpan** ada di manusia.

## 8. Yang harus kamu kumpulkan dari uji nyata

- Tiga trace lengkap: satu tugas berhasil, satu gagal, satu mencapai batas langkah. **[ISI: salin JSON dari `GET /api/agent?id=...`]**
- Tantangan wajib Minggu 11: satu tugas yang gagal, diperbaiki hanya dengan mengubah deskripsi tool atau `prompts/agent-v1.md`, tanpa menambah tool. Sertakan trace sebelum dan sesudah. **[ISI]**
