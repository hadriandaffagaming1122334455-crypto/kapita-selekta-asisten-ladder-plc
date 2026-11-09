export const EXAMPLES: { title: string; description: string; program: string }[] = [
  {
    title: "Self-holding + timer 5 detik",
    description: "Tekan START (0.00): lampu 100.00 menyala setelah 5 detik. STOP (0.01) mematikan semuanya.",
    program: `// rung 1: self-holding
LD 0.00
OR W0.00
AND NOT 0.01
OUT W0.00

// rung 2: timer 5,0 detik
LD W0.00
TIM 0000 #0050

// rung 3: lampu
LD T0000
OUT 100.00`,
  },
  {
    title: "Pola tugas CX-Programmer (holding + TIM + buzzer)",
    description:
      "START 0.00 / RESET 0.01 mengunci Holding 10.00. L2 (100.01) menyala saat Holding aktif, L1 (100.00) saat tidak aktif, dan buzzer 100.12 berbunyi sampai timer 5 detik selesai.",
    program: `// rung 0: Holding (START 0.00, RESET 0.01)
LD 0.00
OR 10.00
AND NOT 0.01
OUT 10.00

// rung 1: timer delay 5 detik
LD 10.00
TIM 010 #0050

// rung 2: buzzer sampai delay selesai
LD 10.00
AND NOT T010
OUT 100.12

// rung 3: L1 sistem tidak berjalan
LD NOT 10.00
OUT 100.00

// rung 4: L2 sistem berjalan
LD 10.00
OUT 100.01`,
  },
];
