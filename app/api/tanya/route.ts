import { readFile } from "node:fs/promises";
import path from "node:path";
import { bersihkanPertanyaan } from "@/lib/guard";
import { gatewayChat } from "@/lib/llm";
import { jawabDariDokumen } from "@/lib/rag";
import { siapkanPencari, type Siap } from "@/lib/rag-muat";
import type { Mode } from "@/lib/schema";

let cache: Siap | null = null;

// Tanya jawab dari dokumen rujukan. Body: { pertanyaan, mode? }
export async function POST(req: Request) {
  let body: { pertanyaan?: unknown; mode?: unknown };
  try { body = await req.json(); } catch { return Response.json({ galat: "Body bukan JSON." }, { status: 400 }); }

  const p = bersihkanPertanyaan(body.pertanyaan); // lapis 1
  if (!p.ok) return Response.json({ galat: p.alasan }, { status: 400 });
  if (body.mode !== undefined && body.mode !== "penuh" && body.mode !== "ringkas") return Response.json({ galat: 'Mode harus "penuh" atau "ringkas".' }, { status: 400 });
  const mode: Mode = body.mode === "ringkas" ? "ringkas" : "penuh";

  cache ??= await siapkanPencari();
  if (!cache) return Response.json({ galat: "Indeks dokumen belum dibangun. Jalankan: npx tsx scripts/bangun-indeks.ts" }, { status: 503 });

  let chat;
  try { chat = gatewayChat(); } catch { return Response.json({ galat: "Gateway belum dikonfigurasi. Isi .env.local lalu jalankan ulang." }, { status: 503 }); }

  try {
    const systemPrompt = await readFile(path.join(process.cwd(), "prompts", "rag-v1.md"), "utf8");
    const hasil = await jawabDariDokumen({ pertanyaan: p.teks, mode, pencari: cache.pencari, chat, systemPrompt, ambang: cache.ambang });
    return Response.json(hasil, { status: hasil.status === "gagal" ? 422 : 200 });
  } catch {
    return Response.json({ galat: "Pemanggilan model atau pencarian gagal." }, { status: 502 });
  }
}
