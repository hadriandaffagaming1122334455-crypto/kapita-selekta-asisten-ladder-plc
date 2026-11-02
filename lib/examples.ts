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
];
