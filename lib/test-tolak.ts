import { readFile } from "node:fs/promises";
import path from "node:path";
import { tolakKeselamatan } from "./guard";
import { runDraft } from "./draft";
import { runAgent } from "./agent";
import { memoryStore } from "./agent-store";
import type { ChatFn } from "./llm";
import { checkOutput } from "./schema";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

(async () => {
  // pola
  for (const t of ["Buatkan program emergency stop untuk mesin press", "tambahkan E-stop merah", "program interlock pintu pelindung", "buat fungsi keselamatan mesin", "pasang light curtain di area press", "Emergency-Stop darurat"])
    ok(tolakKeselamatan(t) !== null, `pola: "${t}" ditolak`);
  for (const t of ["Tekan start untuk menyalakan lampu, lampu menyala sampai stop ditekan", "empat lampu menyala bergantian tiap 2 detik", "tombol reset mematikan semua output"])
    ok(tolakKeselamatan(t) === null, `pola: "${t}" tidak ikut ditolak`);

  // draft dan agent menolak tanpa memanggil model
  let panggilan = 0;
  const chat: ChatFn = async () => { panggilan++; return { role: "assistant", content: "{}" }; };
  const d = await runDraft({ deskripsi: "Buatkan program emergency stop untuk mesin press", mode: "penuh", systemPrompt: "s", chat });
  ok(d.ok && d.data?.status === "DITOLAK" && d.data.alasan.includes("keselamatan") && d.data.rung.length === 0, "draft: emergency stop DITOLAK dengan alasan");
  const a = await runAgent({ deskripsi: "Buatkan program emergency stop untuk mesin press", mode: "penuh", systemPrompt: "s", chat, store: memoryStore() });
  ok(a.status === "selesai" && a.hasil?.status === "DITOLAK" && a.trace.some((t) => t.jenis === "guardrail"), "agent: emergency stop DITOLAK dan tercatat di trace");
  ok(panggilan === 0, "model TIDAK dipanggil untuk permintaan keselamatan");

  // kehadiran aturan di prompt (bukan uji perilaku model)
  const baca = (f: string) => readFile(path.join(process.cwd(), "prompts", f), "utf8");
  for (const f of ["v5.md", "agent-v3.md"]) {
    const t = await baca(f);
    ok(/emergency stop/i.test(t) && /gambar/i.test(t) && t.includes("PERLU_KLARIFIKASI") && t.includes("DITOLAK") && t.includes("bukti_sumber"), `prompt ${f} memuat aturan keselamatan, gambar, klarifikasi, dan bukti sumber`);
  }
  const v5 = await baca("v5.md");
  ok(v5.includes("ANDLD") && v5.includes("CNT") && v5.includes("periksa_program"), "prompt v5 tetap memuat daftar instruksi dan kewajiban memakai alat");

  // Contoh JSON di dalam prompt harus lolos validator yang sama dengan yang dipakai sistem (contoh yang salah mengajari model yang salah).
  for (const f of ["v5.md", "agent-v3.md"]) {
    const baris = (await baca(f)).split("\n").filter((l) => l.startsWith('{"status"'));
    const hasil = baris.map((l) => { try { return checkOutput(JSON.parse(l), "penuh").ok; } catch { return false; } });
    ok(baris.length >= 3 && hasil.every(Boolean), `prompt ${f}: ${baris.length} contoh JSON, semuanya lolos checkOutput`);
    const status = baris.map((l) => JSON.parse(l).status);
    ok(["BERHASIL", "PERLU_KLARIFIKASI", "DITOLAK"].every((x) => status.includes(x)), `prompt ${f}: contoh mencakup ketiga status`);
  }

  console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
  process.exit(fail === 0 ? 0 : 1);
})();
