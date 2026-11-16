import { type DraftOutput, type Mode } from "./schema";
import { periksaProgram, runTool, type Pemeriksaan } from "./tools";
import type { ChatFn, Msg } from "./llm";
import { tolakKeselamatan } from "./guard";
import { ambilSumber, type Terambil } from "./rag";
import type { Pencari } from "./rag-index";
import type { Chunk } from "./rag-chunk";
import { blokSumber, CATATAN_TANPA_SUMBER, keluaranDitolak, keluaranKlarifikasiGagal, MAX_PERBAIKAN, periksaKeluaran } from "./keluaran";

export const MAX_STEPS = 5; // batas jumlah pemanggilan model per permintaan

export interface TraceItem {
  langkah: number;
  jenis: "model" | "tool" | "perbaikan_format" | "retrieval";
  ringkas: string;
}
export interface DraftResult {
  ok: boolean;
  data?: DraftOutput;
  program?: string; // teks mnemonic hasil gabungan rung; hanya untuk status BERHASIL
  pemeriksaan?: Pemeriksaan; // dihitung ulang oleh sistem, bukan klaim model
  terambil?: Terambil[]; // chunk manual yang diambil retrieval (kosong kalau indeks belum ada)
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
  pencari?: Pencari; // tanpa pencari (indeks belum dibangun): draf tetap dibuat, tanpa bukti manual
  ambang?: number;
}): Promise<DraftResult> {
  const jejak: TraceItem[] = [];
  const tolak = tolakKeselamatan(opts.deskripsi);
  if (tolak) {
    // Ditolak di kode sebelum model dipanggil: tidak bergantung pada kepatuhan model.
    return { ok: true, data: keluaranDitolak(tolak), jejak };
  }
  const bersih = opts.deskripsi.replace(/<\/?(deskripsi|sumber)>/gi, "");

  // Retrieval: ambil potongan manual yang relevan sebelum model dipanggil (rancangan-sistem.md bagian 3 dan 6).
  let sumber: Chunk[] = [];
  let terambil: Terambil[] | undefined;
  if (opts.pencari) {
    try {
      const r = await ambilSumber(bersih, opts.pencari, opts.ambang ?? 0.3);
      sumber = r.dipakai.map((h) => h.chunk);
      terambil = r.terambil;
      jejak.push({ langkah: 0, jenis: "retrieval", ringkas: `${r.dipakai.length} dari ${r.hasil.length} chunk lolos ambang${r.dipakai.length === 0 ? " (tidak ditemukan di manual)" : ""}` });
    } catch (e) {
      jejak.push({ langkah: 0, jenis: "retrieval", ringkas: `Retrieval gagal, lanjut tanpa sumber: ${(e as Error).message}`.slice(0, 120) });
    }
  } else {
    jejak.push({ langkah: 0, jenis: "retrieval", ringkas: "Indeks manual belum tersedia; draf dibuat tanpa bukti manual." });
  }

  const messages: Msg[] = [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: `Mode output: ${opts.mode}\n\n<deskripsi>\n${bersih}\n</deskripsi>\n\n${blokSumber(sumber)}` },
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

    let galat: string[] = [];
    try {
      const cek = periksaKeluaran(extractJson(teks), opts.mode, sumber, { catatanTanpaSumber: CATATAN_TANPA_SUMBER });
      if (cek.ok) return { ok: true, data: cek.value, program: cek.program || undefined, pemeriksaan: cek.pemeriksaan, terambil, jejak };
      galat = cek.errors;
    } catch {
      galat = ["Jawaban bukan JSON valid."];
    }

    if (repairs < MAX_PERBAIKAN) {
      repairs++;
      const pesan = `Output tidak sesuai aturan: ${galat.join(" ")} Kirim ulang sebagai satu objek JSON saja.`;
      messages.push({ role: "user", content: pesan });
      jejak.push({ langkah, jenis: "perbaikan_format", ringkas: pesan.slice(0, 120) });
      continue;
    }
    // Tetap tidak valid: PERLU_KLARIFIKASI tanpa menampilkan draf.
    return { ok: true, data: keluaranKlarifikasiGagal(galat), terambil, galat: galat.join(" "), jejak };
  }
  return { ok: false, galat: `Batas ${MAX_STEPS} langkah tercapai sebelum ada jawaban akhir.`, terambil, jejak };
}
