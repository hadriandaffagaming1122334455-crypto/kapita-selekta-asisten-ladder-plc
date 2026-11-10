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
];
