# Ladder Tutor — Asisten Draf Ladder PLC Omron CP1E

Website untuk membantu mahasiswa Teknik Elektro memahami dan menyusun diagram ladder PLC.
Proyek UTS Kapita Selekta: AI Engineering (Ganjil 2026/2027).

## Status
- [x] Parser mnemonic (`lib/parser.ts`)
- [x] Validator alamat dan sintaks (`lib/validator.ts`)
- [x] Simulator scan dengan self-holding dan TIM (`lib/simulator.ts`)
- [x] Halaman awal: editor, pemeriksaan, simulator (`app/page.tsx`)
- [ ] Prompt v2 dan endpoint AI
- [ ] RAG dari 5 manual Omron
- [ ] Gambar ladder SVG, mode latihan
- [ ] Uji di CX-Programmer

## Menjalankan
```bash
npm install
npm run dev        # buka http://localhost:3000
npx tsx lib/test.ts  # uji logika inti
```

## Batasan saat ini
- Rentang alamat di `lib/config.ts` perlu dicocokkan dengan manual W479/W480 untuk model CP1E yang dipakai.
- Simulator belum mendukung CNT, ANDLD, dan ORLD.
- Hasil simulator bukan pengganti uji di CX-Programmer.

## Sumber
Manual Omron (W446, W461, W483, W479, W480): lihat tautan di dokumen rancangan. File manual tidak disertakan di repo ini.
