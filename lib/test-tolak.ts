import { readFile } from "node:fs/promises";
import path from "node:path";
import { tolakKeselamatan } from "./guard";
import { runDraft } from "./draft";
import { runAgent } from "./agent";
import { memoryStore } from "./agent-store";
import type { ChatFn } from "./llm";

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
  ok(d.ok && d.data?.status === "tidak_bisa" && d.data.alasan.includes("keselamatan") && d.data.program === "", "draft: emergency stop ditolak dengan alasan");
  const a = await runAgent({ deskripsi: "Buatkan program emergency stop untuk mesin press", mode: "penuh", systemPrompt: "s", chat, store: memoryStore() });
  ok(a.status === "selesai" && a.hasil?.status === "tidak_bisa" && a.trace.some((t) => t.jenis === "guardrail"), "agent: emergency stop ditolak dan tercatat di trace");
  ok(panggilan === 0, "model TIDAK dipanggil untuk permintaan keselamatan");

  // kehadiran aturan di prompt (bukan uji perilaku model)
  const baca = (f: string) => readFile(path.join(process.cwd(), "prompts", f), "utf8");
  for (const f of ["v4.md", "agent-v2.md"]) {
    const t = await baca(f);
    ok(/emergency stop/i.test(t) && /gambar/i.test(t) && t.includes("PERLU KLARIFIKASI"), `prompt ${f} memuat aturan keselamatan, gambar, dan klarifikasi`);
  }
  const v4 = await baca("v4.md");
  ok((v4.match(/"status":\s*"tidak_bisa"/g) ?? []).length >= 3, "prompt v4 memuat tiga contoh penolakan dan klarifikasi");
  ok(v4.includes("ANDLD") && v4.includes("CNT") && v4.includes("periksa_program"), "prompt v4 tetap memuat daftar instruksi dan kewajiban memakai alat");

  console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
  process.exit(fail === 0 ? 0 : 1);
})();
