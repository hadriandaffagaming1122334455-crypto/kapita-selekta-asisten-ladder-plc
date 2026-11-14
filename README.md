# Ladder Tutor — Asisten Draf Ladder PLC Omron CP1E

Website untuk membantu mahasiswa Teknik Elektro memahami dan menyusun diagram ladder PLC.
Proyek UTS Kapita Selekta: AI Engineering (Ganjil 2026/2027).

## Status
- [x] Parser mnemonic (`lib/parser.ts`)
- [x] Validator alamat dan sintaks (`lib/validator.ts`)
- [x] Simulator scan dengan self-holding, TIM, CNT, ANDLD, dan ORLD (`lib/simulator.ts`)
- [x] Halaman awal: editor, pemeriksaan, simulator (`app/page.tsx`)
- [ ] Prompt v2 dan endpoint AI
- [ ] RAG dari 5 manual Omron
- [ ] Gambar ladder SVG, mode latihan
- [ ] Uji di CX-Programmer

## Menjalankan
```bash
npm install
npm run dev        # buka http://localhost:3000
npx tsx lib/test.ts       # uji logika inti
npx tsx lib/test-blok.ts  # uji CNT, ANDLD, ORLD
npx tsx lib/test-ai.ts    # uji alur AI dengan model tiruan (tanpa kunci)
npx tsx lib/test-agent.ts # uji agent, batas langkah, dan persetujuan manusia (tanpa kunci)
```

## Agent (lapisan 4)
- `POST /api/agent` dengan `{"deskripsi": "...", "mode": "penuh", "simpanSebagai": "nama-opsional"}` menjalankan agent: susun, periksa, simulasi, jawab.
- `GET /api/agent?id=<id>` membaca state tugas dan trace. State tersimpan di `data/tugas/` (tidak ikut git).
- Kalau `simpanSebagai` diisi, agent hanya mengusulkan penyimpanan. Berkas `data/draf/<nama>.txt` baru ditulis setelah `POST /api/agent/setujui` dengan `{"id": "...", "keputusan": "setuju"}`.
- Rancangan: `docs/rancangan-agent.md`. Guardrails: `docs/guardrails.md`.

## Batasan saat ini
- Rentang alamat di `lib/config.ts` perlu dicocokkan dengan manual W479/W480 untuk model CP1E yang dipakai.
- Perilaku CNT di simulator (turun dari nilai set pada tepi naik, flag bertahan sampai reset) dan aturan nomor TIM/CNT berbagi satu ruang perlu dicocokkan dengan manual W483/W480.
- Hasil simulator bukan pengganti uji di CX-Programmer.

## Sumber
Manual Omron (W446, W461, W483, W479, W480): lihat tautan di dokumen rancangan. File manual tidak disertakan di repo ini.
