import { parseProgram } from "./parser";
import { validate } from "./validator";

// Tool tunggal untuk lapisan 2. Batas akses: fungsi murni, hanya membaca teks yang
// diberikan model. Tidak menyentuh berkas, jaringan, atau variabel lingkungan.

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "periksa_program",
      description:
        "Memeriksa sintaks dan alamat sebuah program ladder (format mnemonic, satu instruksi per baris). " +
        "Mengembalikan valid atau tidak beserta daftar masalah per rung. Panggil sebelum memberi jawaban akhir.",
      parameters: {
        type: "object",
        properties: {
          program: { type: "string", description: "Teks program mnemonic yang diperiksa." },
        },
        required: ["program"],
        additionalProperties: false,
      },
    },
  },
];

export interface Pemeriksaan {
  valid: boolean;
  galat_sintaks: string[];
  masalah: { tingkat: "error" | "warning"; rung?: number; pesan: string }[];
}

export function periksaProgram(program: string): Pemeriksaan {
  const { program: parsed, errors } = parseProgram(program);
  const v = validate(parsed);
  return {
    valid: errors.length === 0 && v.valid,
    galat_sintaks: errors,
    masalah: v.issues.map((i) => ({ tingkat: i.severity, rung: i.rung, pesan: i.message })),
  };
}

// Menjalankan tool atas permintaan model. Selalu mengembalikan string JSON, tidak pernah melempar.
export function runTool(name: string, argsJson: string): string {
  if (name !== "periksa_program") return JSON.stringify({ galat: `Tool tidak dikenal: ${name}` });
  let args: unknown;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({ galat: "Argumen bukan JSON valid." });
  }
  const p = (args as { program?: unknown } | null)?.program;
  if (typeof p !== "string") return JSON.stringify({ galat: 'Argumen "program" harus string.' });
  return JSON.stringify(periksaProgram(p));
}
