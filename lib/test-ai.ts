import { checkOutput } from "./schema";
import { periksaProgram, runTool } from "./tools";
import { runDraft, MAX_STEPS } from "./draft";
import type { ChatFn, Msg } from "./llm";
import { EXAMPLES } from "./examples";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

const good = {
  status: "draf", alasan: "", ringkasan: "Lampu menyala saat START.",
  program: EXAMPLES[0].program, penjelasan: ["Rung 1: self-holding."], asumsi: ["Alamat dipilih sendiri."], perlu_dicek: ["Uji di CX-Programmer."],
};

// --- schema ---
ok(checkOutput(good, "penuh").ok, "schema: output benar diterima (penuh)");
ok(!checkOutput({ ...good, extra: 1 }, "penuh").ok, "schema: field tambahan ditolak");
const { perlu_dicek: _drop, ...tanpa } = good; void _drop;
ok(!checkOutput(tanpa, "penuh").ok, "schema: field hilang ditolak");
ok(!checkOutput({ ...good, status: "mungkin" }, "penuh").ok, "schema: status di luar nilai ditolak");
ok(!checkOutput(good, "ringkas").ok, "schema: mode ringkas menolak penjelasan berisi");
ok(checkOutput({ ...good, penjelasan: [] }, "ringkas").ok, "schema: mode ringkas diterima jika penjelasan kosong");
ok(!checkOutput({ ...good, penjelasan: [], ringkasan: "x".repeat(241) }, "ringkas").ok, "schema: ringkasan > 240 karakter ditolak (ringkas)");
ok(!checkOutput({ ...good, program: "" }, "penuh").ok, "schema: draf tanpa program ditolak");
ok(checkOutput({ ...good, status: "tidak_bisa", alasan: "Butuh CNT.", program: "", penjelasan: [], perlu_dicek: [] }, "penuh").ok, "schema: tidak_bisa valid diterima");
ok(!checkOutput({ ...good, status: "tidak_bisa", alasan: "", program: "" }, "penuh").ok, "schema: tidak_bisa tanpa alasan ditolak");
ok(!checkOutput("bukan objek", "penuh").ok, "schema: non-objek ditolak");

// --- tool ---
ok(periksaProgram(EXAMPLES[0].program).valid, "tool: contoh valid lolos");
ok(!periksaProgram("LD 9.99\nOUT 100.00").valid, "tool: alamat salah terdeteksi");
ok(!periksaProgram("XYZ 0.00").valid, "tool: instruksi tak dikenal terdeteksi");
ok(JSON.parse(runTool("periksa_program", "{bukan json")).galat !== undefined, "tool: argumen rusak tidak melempar");
ok(JSON.parse(runTool("hapus_semua", "{}")).galat !== undefined, "tool: tool tak dikenal ditolak");

// --- alur draft dengan model tiruan ---
const toolCall = (id: string, program: string): Msg => ({
  role: "assistant", content: null,
  tool_calls: [{ id, type: "function", function: { name: "periksa_program", arguments: JSON.stringify({ program }) } }],
});
const final = (o: unknown): Msg => ({ role: "assistant", content: JSON.stringify(o) });
const urut = (...msgs: Msg[]): ChatFn => { let i = 0; return async () => msgs[Math.min(i++, msgs.length - 1)]; };
const base = { deskripsi: "lampu menyala setelah start", mode: "penuh" as const, systemPrompt: "sistem" };

(async () => {
  let r = await runDraft({ ...base, chat: urut(toolCall("a", "LD 9.99\nOUT 100.00"), toolCall("b", good.program), final(good)) });
  ok(r.ok && r.jejak.filter((j) => j.jenis === "tool").length === 2, "alur: model memanggil tool dua kali lalu menjawab");
  ok(r.ok && r.pemeriksaan?.valid === true, "alur: pemeriksaan dihitung ulang oleh sistem");

  const salah = { ...good, program: "LD 9.99\nOUT 100.00" };
  r = await runDraft({ ...base, chat: urut(final(salah)) });
  ok(r.ok && r.pemeriksaan?.valid === false, "alur: program salah tetap ditandai tidak valid oleh sistem");

  r = await runDraft({ ...base, chat: urut({ role: "assistant", content: "bukan json" }, final(good)) });
  ok(r.ok && r.jejak.some((j) => j.jenis === "perbaikan_format"), "alur: format salah diperbaiki satu kali");

  r = await runDraft({ ...base, chat: urut({ role: "assistant", content: "bukan json" }) });
  ok(!r.ok && !!r.galat, "alur: format salah dua kali berakhir gagal dengan pesan");

  let panggilan = 0;
  const berputar: ChatFn = async () => { panggilan++; return toolCall("x" + panggilan, "LD 0.00\nOUT 100.00"); };
  r = await runDraft({ ...base, chat: berputar });
  ok(!r.ok && panggilan === MAX_STEPS, `alur: model berputar dihentikan pada batas ${MAX_STEPS} langkah`);

  r = await runDraft({ ...base, mode: "ringkas", chat: urut(final({ ...good, penjelasan: [] })) });
  ok(r.ok, "alur: mode ringkas berjalan");

  console.log(fail === 0 ? "\nSEMUA LULUS" : `\n${fail} GAGAL`);
  process.exit(fail === 0 ? 0 : 1);
})();
