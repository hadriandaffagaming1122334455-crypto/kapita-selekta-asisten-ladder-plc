import { checkOutput, type DraftOutput, type Mode } from "./schema";
import { periksaProgram, runTool, type Pemeriksaan } from "./tools";
import type { ChatFn, Msg } from "./llm";

export const MAX_STEPS = 5; // batas jumlah pemanggilan model per permintaan
const MAX_REPAIR = 1; // berapa kali model boleh diminta memperbaiki format

export interface TraceItem {
  langkah: number;
  jenis: "model" | "tool" | "perbaikan_format";
  ringkas: string;
}
export interface DraftResult {
  ok: boolean;
  data?: DraftOutput;
  pemeriksaan?: Pemeriksaan; // dihitung ulang oleh sistem, bukan klaim model
  galat?: string;
  jejak: TraceItem[];
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

export async function runDraft(opts: {
  deskripsi: string;
  mode: Mode;
  systemPrompt: string;
  chat: ChatFn;
}): Promise<DraftResult> {
  const jejak: TraceItem[] = [];
  const bersih = opts.deskripsi.replace(/<\/?deskripsi>/gi, "");
  const messages: Msg[] = [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: `Mode output: ${opts.mode}\n\n<deskripsi>\n${bersih}\n</deskripsi>` },
  ];
  let repairs = 0;

  for (let langkah = 1; langkah <= MAX_STEPS; langkah++) {
    const msg = await opts.chat(messages);
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const call of msg.tool_calls) {
        const hasil = runTool(call.function.name, call.function.arguments);
        messages.push({ role: "tool", tool_call_id: call.id, content: hasil });
        jejak.push({ langkah, jenis: "tool", ringkas: `${call.function.name} -> ${hasil.slice(0, 120)}` });
      }
      continue;
    }

    const teks = msg.content ?? "";
    jejak.push({ langkah, jenis: "model", ringkas: teks.slice(0, 120) });

    let parsed: unknown;
    let galat: string[] = [];
    try {
      parsed = extractJson(teks);
      const cek = checkOutput(parsed, opts.mode);
      if (cek.ok) {
        const pemeriksaan = cek.value.status === "draf" ? periksaProgram(cek.value.program) : undefined;
        return { ok: true, data: cek.value, pemeriksaan, jejak };
      }
      galat = cek.errors;
    } catch {
      galat = ["Jawaban bukan JSON valid."];
    }

    if (repairs < MAX_REPAIR) {
      repairs++;
      const pesan = `Output tidak sesuai format: ${galat.join(" ")} Kirim ulang sebagai satu objek JSON saja.`;
      messages.push({ role: "user", content: pesan });
      jejak.push({ langkah, jenis: "perbaikan_format", ringkas: pesan.slice(0, 120) });
      continue;
    }
    return { ok: false, galat: `Format output tidak valid: ${galat.join(" ")}`, jejak };
  }
  return { ok: false, galat: `Batas ${MAX_STEPS} langkah tercapai sebelum ada jawaban akhir.`, jejak };
}
