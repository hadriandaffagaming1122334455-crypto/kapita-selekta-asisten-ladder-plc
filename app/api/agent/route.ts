import { readFile } from "node:fs/promises";
import path from "node:path";
import { runAgent } from "@/lib/agent";
import { fileStore, ID_RE } from "@/lib/agent-store";
import { bersihkanDeskripsi, NAMA_BERKAS_RE } from "@/lib/guard";
import { gatewayChat } from "@/lib/llm";
import type { Mode } from "@/lib/schema";

const store = fileStore(path.join(process.cwd(), "data", "tugas"));

// Mulai tugas agent. Body: { deskripsi, mode?, simpanSebagai? }
export async function POST(req: Request) {
  let body: { deskripsi?: unknown; mode?: unknown; simpanSebagai?: unknown };
  try { body = await req.json(); } catch { return Response.json({ galat: "Body bukan JSON." }, { status: 400 }); }

  const d = bersihkanDeskripsi(body.deskripsi); // lapis 1
  if (!d.ok) return Response.json({ galat: d.alasan }, { status: 400 });
  if (body.mode !== undefined && body.mode !== "penuh" && body.mode !== "ringkas") return Response.json({ galat: 'Mode harus "penuh" atau "ringkas".' }, { status: 400 });
  const mode: Mode = body.mode === "ringkas" ? "ringkas" : "penuh";
  let simpanSebagai: string | undefined;
  if (body.simpanSebagai !== undefined) {
    if (typeof body.simpanSebagai !== "string" || !NAMA_BERKAS_RE.test(body.simpanSebagai)) return Response.json({ galat: "simpanSebagai hanya boleh huruf kecil, angka, dan tanda hubung (maks 40 karakter)." }, { status: 400 });
    simpanSebagai = body.simpanSebagai;
  }

  let chat;
  try { chat = gatewayChat(); } catch { return Response.json({ galat: "Gateway belum dikonfigurasi. Isi .env.local lalu jalankan ulang." }, { status: 503 }); }

  try {
    const systemPrompt = await readFile(path.join(process.cwd(), "prompts", "agent-v1.md"), "utf8");
    const state = await runAgent({ deskripsi: d.teks, mode, systemPrompt, chat, store, simpanSebagai });
    return Response.json(state);
  } catch {
    return Response.json({ galat: "Agent gagal dijalankan." }, { status: 502 });
  }
}

// Baca state tugas. /api/agent?id=...
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return Response.json({ galat: "ID tugas tidak valid." }, { status: 400 });
  const state = await store.load(id);
  return state ? Response.json(state) : Response.json({ galat: "Tugas tidak ditemukan." }, { status: 404 });
}
