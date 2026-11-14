// Komentar di akhir baris ("// START") menjadi nama simbol di diagram, seperti di CX-Programmer.
export const EXAMPLES: { title: string; description: string; program: string }[] = [
  {
    title: "Self-holding + timer 5 detik",
    description: "Tekan START (0.00): lampu 100.00 menyala setelah 5 detik. STOP (0.01) mematikan semuanya.",
    program: `// rung 0: self-holding
LD 0.00 // START
OR W0.00 // Holding
AND NOT 0.01 // STOP
OUT W0.00 // Holding

// rung 1: timer 5,0 detik
LD W0.00 // Holding
TIM 0000 #0050 // Timer 5 detik

// rung 2: lampu
LD T0000 // delay
OUT 100.00 // Lampu`,
  },
  {
    title: "Pola tugas CX-Programmer (holding + TIM + buzzer)",
    description:
      "START 0.00 / RESET 0.01 mengunci Holding 10.00. L2 (100.01) menyala saat Holding aktif, L1 (100.00) saat tidak aktif, dan buzzer 100.12 berbunyi sampai timer 5 detik selesai.",
    program: `// rung 0: Holding
LD 0.00 // START
OR 10.00 // Holding
AND NOT 0.01 // RESET
OUT 10.00 // Holding

// rung 1: timer delay 5 detik
LD 10.00 // Holding
TIM 010 #0050 // delay

// rung 2: buzzer sampai delay selesai
LD 10.00 // Holding
AND NOT T010 // delay
OUT 100.12 // buzzer

// rung 3: L1 sistem tidak berjalan
LD NOT 10.00 // Holding
OUT 100.00 // L1 Lampu sistem tidak berjalan

// rung 4: L2 sistem berjalan
LD 10.00 // Holding
OUT 100.01 // L2 Lampu sistem berjalan`,
  },
  {
    title: "Penghitung paket (CNT, ANDLD, ORLD)",
    description:
      "Contoh umum, bukan program tugas. START 0.00 menjalankan konveyor 10.00, STOP 0.01 menghentikan. Sensor paket 0.02 menghitung 3 paket (CNT), setelah itu konveyor berhenti dan buzzer 100.12 bunyi kecuali MUTE 0.05 ditekan. Reset hitungan di 0.03.",
    program: `// rung 0: konveyor, berhenti saat batch penuh
LD 0.00 // START
OR 10.00 // Konveyor
AND NOT 0.01 // STOP
AND NOT C0000 // Batch penuh
OUT 10.00 // Konveyor

// rung 1: hitung paket saat konveyor jalan
LD 0.02 // Sensor paket
AND 10.00 // Konveyor
LD 0.03 // Reset hitungan
CNT 0000 #0003 // Hitung 3 paket

// rung 2: motor konveyor
LD 10.00 // Konveyor
OUT 100.04 // Motor konveyor

// rung 3: buzzer = (batch penuh ATAU alarm manual) DAN BUKAN mute
LD C0000 // Batch penuh
OR 0.04 // Alarm manual
LD NOT 0.05 // Mute
ANDLD
OUT 100.12 // Buzzer

// rung 4: lampu jika salah satu jalur (A atau B) mendeteksi paket
LD 0.02 // Sensor paket A
AND 10.00 // Konveyor
LD 0.06 // Sensor paket B
AND 10.00 // Konveyor
ORLD
OUT 100.01 // Lampu deteksi`,
  },
  {
    title: "Mail sorting system (laporan UTS/UAS)",
    description:
      "Dari laporan tugas PLC. START 0.00 / RESET 0.01 mengunci Holding 10.00. Konveyor M5 (100.02) jalan, buzzer 100.12 bunyi 5 detik. Tahan pemilih paket A-D (0.02-0.05, di laporan W1.01-W1.04): pendorong M1-M4 (100.03-100.06) aktif 2 detik, lalu Box A-D (100.07-100.10) menyala. Tanpa paket terpilih, Box E (100.11) menyala.",
    program: `// Rung 0: memori penahan (self-holding), RESET memutus
LD 0.00 // START
OR 10.00 // Holding
AND NOT 0.01 // RESET
OUT 10.00 // Holding

// Rung 1: timer buzzer 5 detik
LD 10.00 // Holding
TIM 0010 #0050 // delay

// Rung 2: buzzer bunyi 5 detik pertama setelah START
LD 10.00 // Holding
AND NOT T0010 // delay
OUT 100.12 // buzzer

// Rung 3: L1 merah (standby)
LD NOT 10.00 // Holding
OUT 100.00 // L1

// Rung 4: L2 hijau (berjalan)
LD 10.00 // Holding
OUT 100.01 // L2

// Rung 5: konveyor M5
LD 10.00 // Holding
OUT 100.02 // M5

// Rung 6: pemilih paket A (prioritas tertinggi)
LD 0.02 // PAKET A
AND NOT 100.04 // M2
AND NOT 100.05 // M3
AND NOT 100.06 // M4
OUT W2.01 // memori A

// Rung 7: pemilih paket B
LD 0.03 // PAKET B
AND NOT 100.03 // M1
AND NOT 100.05 // M3
AND NOT 100.06 // M4
AND NOT W2.01 // memori A
OUT W2.02 // memori B

// Rung 8: pemilih paket C
LD 0.04 // PAKET C
AND NOT 100.03 // M1
AND NOT 100.04 // M2
AND NOT 100.06 // M4
AND NOT W2.01 // memori A
AND NOT W2.02 // memori B
OUT W2.03 // memori C

// Rung 9: pemilih paket D
LD 0.05 // PAKET D
AND NOT W2.01 // memori A
AND NOT W2.02 // memori B
AND NOT W2.03 // memori C
OUT W2.04 // memori D

// Rung 10-13: timer 2 detik tiap paket
LD 10.00 // Holding
AND W2.01 // memori A
TIM 0001 #0020 // timer A

LD 10.00 // Holding
AND W2.02 // memori B
TIM 0002 #0020 // timer B

LD 10.00 // Holding
AND W2.03 // memori C
TIM 0003 #0020 // timer C

LD 10.00 // Holding
AND W2.04 // memori D
TIM 0004 #0020 // timer D

// Rung 14-17: pendorong M1-M4 aktif selama timer belum selesai
LD 10.00 // Holding
AND W2.01 // memori A
AND NOT T0001 // timer A
OUT 100.03 // M1

LD 10.00 // Holding
AND W2.02 // memori B
AND NOT T0002 // timer B
OUT 100.04 // M2

LD 10.00 // Holding
AND W2.03 // memori C
AND NOT T0003 // timer C
OUT 100.05 // M3

LD 10.00 // Holding
AND W2.04 // memori D
AND NOT T0004 // timer D
OUT 100.06 // M4

// Rung 18-21: lampu Box A-D menyala setelah timer selesai
LD 10.00 // Holding
AND W2.01 // memori A
AND T0001 // timer A
OUT 100.07 // Box A

LD 10.00 // Holding
AND W2.02 // memori B
AND T0002 // timer B
OUT 100.08 // Box B

LD 10.00 // Holding
AND W2.03 // memori C
AND T0003 // timer C
OUT 100.09 // Box C

LD 10.00 // Holding
AND W2.04 // memori D
AND T0004 // timer D
OUT 100.10 // Box D

// Rung 22: Box E (default) kalau Box A-D mati
LD 10.00 // Holding
AND NOT 100.07 // Box A
AND NOT 100.08 // Box B
AND NOT 100.09 // Box C
AND NOT 100.10 // Box D
OUT 100.11 // Box E`,
  },
];
