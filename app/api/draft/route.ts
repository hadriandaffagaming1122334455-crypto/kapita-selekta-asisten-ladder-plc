import { readFile } from "node:fs/promises";
import path from "node:path";
import { runDraft } from "@/lib/draft";
import { gatewayChat } from "@/lib/llm";
import type { Mode } from "@/lib/schema";

const MAX_DESKRIPSI = 1500;

export async function POST(req: Request) {
  let body: { deskripsi?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ galat: "Body bukan JSON." }, { status: 400 });
  }

  const deskripsi = typeof body.deskripsi === "string" ? body.deskripsi.trim() : "";
  if (deskripsi === "" || deskripsi.length > MAX_DESKRIPSI) {
    return Response.json({ galat: `Deskripsi wajib diisi, maksimal ${MAX_DESKRIPSI} karakter.` }, { status: 400 });
  }
  const mode: Mode = body.mode === "ringkas" ? "ringkas" : "penuh";
  if (body.mode !== undefined && body.mode !== "penuh" && body.mode !== "ringkas") {
    return Response.json({ galat: 'Mode harus "penuh" atau "ringkas".' }, { status: 400 });
  }

  let chat;
  try {
    chat = gatewayChat();
  } catch {
    return Response.json({ galat: "Gateway belum dikonfigurasi. Isi .env.local lalu jalankan ulang." }, { status: 503 });
  }

  try {
    const systemPrompt = await readFile(path.join(process.cwd(), "prompts", "v3.md"), "utf8");
    const hasil = await runDraft({ deskripsi, mode, systemPrompt, chat });
    return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
  } catch {
    return Response.json({ galat: "Pemanggilan model gagal." }, { status: 502 });
  }
}
