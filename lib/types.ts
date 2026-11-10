// Tipe data inti. Sengaja memakai mnemonic Omron (LD, AND, OR, OUT, TIM).

export type Op = "LD" | "LD NOT" | "AND" | "AND NOT" | "OR" | "OR NOT" | "ANDLD" | "ORLD" | "OUT" | "TIM" | "CNT";

export interface Instruction {
  op: Op;
  arg: string; // alamat, contoh "0.00", "100.00", "W0.00", "T0000"/"C0000" (kontak), "0000" (nomor TIM/CNT); kosong untuk ANDLD/ORLD
  label?: string; // nama simbol/komentar dari "// ..." di akhir baris
  preset?: number; // hanya TIM/CNT: satuan 0.1 detik untuk TIM (#0050 = 5 detik); jumlah hitungan untuk CNT
}

export interface Rung {
  no: number;
  instructions: Instruction[];
}

export type Program = Rung[];

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  rung?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean; // true hanya jika tidak ada error DAN ada minimal satu rung
  issues: Issue[];
}
