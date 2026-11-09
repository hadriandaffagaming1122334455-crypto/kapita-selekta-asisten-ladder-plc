import type { Instruction, Op, Program, Rung } from "./types";

const OPS: Op[] = ["LD NOT", "AND NOT", "OR NOT", "LD", "AND", "OR", "OUT", "TIM", "CNT"];

/**
 * Format teks (satu instruksi per baris, baris kosong atau "// rung" memisahkan rung):
 *
 *   LD 0.00
 *   OR W0.00
 *   AND NOT 0.01
 *   OUT W0.00
 *
 *   LD W0.00
 *   TIM 0000 #0050
 */
export function parseProgram(text: string): { program: Program; errors: string[] } {
  const errors: string[] = [];
  const program: Program = [];
  let current: Instruction[] = [];

  const flush = () => {
    if (current.length > 0) {
      program.push({ no: program.length + 1, instructions: current } as Rung);
      current = [];
    }
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const cut = raw.indexOf("//");
    const line = (cut >= 0 ? raw.slice(0, cut) : raw).trim().toUpperCase();
    const label = cut >= 0 ? raw.slice(cut + 2).trim() : "";
    if (line === "") return flush();

    const op = OPS.find((o) => line === o || line.startsWith(o + " "));
    if (!op) {
      errors.push(`Baris ${i + 1}: instruksi tidak dikenal "${raw.trim()}"`);
      return;
    }
    const rest = line.slice(op.length).trim().split(/\s+/).filter(Boolean);
    if (rest.length === 0) {
      errors.push(`Baris ${i + 1}: ${op} butuh alamat`);
      return;
    }
    const ins: Instruction = { op, arg: rest[0] };
    if (label) ins.label = label;
    if (op === "TIM" || op === "CNT") {
      const m = /^#(\d{1,4})$/.exec(rest[1] ?? "");
      if (!m) {
        errors.push(`Baris ${i + 1}: ${op} butuh nilai set seperti #0050`);
        return;
      }
      ins.preset = parseInt(m[1], 10);
    }
    current.push(ins);
  });
  flush();
  return { program, errors };
}
