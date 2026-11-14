import { checkOutput, type Mode } from "./schema";
import { periksaProgram, type Pemeriksaan } from "./tools";
import type { ChatFn, Msg } from "./llm";
import { AGENT_TOOLS, SIMPAN_TOOL, DRAF_DIR, buatUsulan, jalankanAgentTool, simpanKeBerkas } from "./agent-tools";
import { ID_RE, newId, type Store, type TaskState, type TraceEntry, type UsulanSimpan } from "./agent-store";

export const MAX_LANGKAH = 8; // satu langkah = satu pemanggilan model
export const MAX_CALL_PER_LANGKAH = 3;
const RETRY_TOOL = 2; // dicoba ulang 2 kali (3 percobaan), lalu hasilnya dilaporkan sebagai galat ke model
const RETRY_MODEL = 1;
const MAX_KEGAGALAN_TOOL = 2; // tool gagal permanen dua kali: tugas dihentikan
const MAX_HASIL_TOOL = 1500; // hasil tool dipotong di konteks (konteks dikelola, tidak dibiarkan membesar)

export interface AgentOpts {
  deskripsi: string;
  mode: Mode;
  systemPrompt: string;
  chat: ChatFn;
  store: Store;
  simpanSebagai?: string;
  draftDir?: string;
  maxLangkah?: number;
  exec?: (name: string, argsJson: string) => string;
  id?: string;
}

const potong = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

async function retry<T>(fn: () => Promise<T>, n: number): Promise<T> {
  let err: unknown;
  for (let i = 0; i <= n; i++) {
    try { return await fn(); } catch (e) { err = e; }
  }
  throw err;
}

export function ringkasPersetujuan(u: UsulanSimpan): string {
  return (
    `Agent mengusulkan menulis berkas ${u.berkas} (${u.ukuranByte} byte). ` +
    (u.menimpa ? "PERINGATAN: berkas ini sudah ada dan isinya akan DITIMPA. " : "Berkas ini belum ada dan akan dibuat. ") +
    (u.periksaValid ? "Program lolos pemeriksaan sistem. " : "Program TIDAK lolos pemeriksaan sistem. ") +
    "Belum ada yang ditulis. Tinjau isinya lalu setujui atau tolak."
  );
}

export async function runAgent(o: AgentOpts): Promise<TaskState> {
  const max = o.maxLangkah ?? MAX_LANGKAH;
  const draftDir = o.draftDir ?? DRAF_DIR;
  const exec = o.exec ?? jalankanAgentTool;
  const state: TaskState = {
    id: o.id ?? newId(), dibuat: new Date().toISOString(), deskripsi: o.deskripsi, mode: o.mode,
    status: "berjalan", langkah: 0, maxLangkah: max, pesan: "", programTerbaru: "", kegagalanTool: 0,
    simpanSebagai: o.simpanSebagai, trace: [],
  };
  const catat = (jenis: TraceEntry["jenis"], ringkas: string) =>
    state.trace.push({ langkah: state.langkah, waktu: new Date().toISOString(), jenis, ringkas: potong(ringkas, 300) });
  const akhiri = async (status: TaskState["status"], pesan: string) => {
    state.status = status; state.pesan = pesan; catat("sistem", `${status}: ${pesan}`);
    await o.store.save(state);
    return state;
  };

  const tools: unknown[] = o.simpanSebagai ? [...AGENT_TOOLS, SIMPAN_TOOL] : AGENT_TOOLS;
  const messages: Msg[] = [
    { role: "system", content: o.systemPrompt },
    {
      role: "user",
      content:
        `Mode output: ${o.mode}\n` +
        (o.simpanSebagai ? `Simpan hasil akhir dengan nama: ${o.simpanSebagai}\n` : "Pengguna tidak meminta penyimpanan berkas.\n") +
        `\n<deskripsi>\n${o.deskripsi}\n</deskripsi>`,
    },
  ];
  let repairs = 0;
  await o.store.save(state);

  while (state.langkah < max) {
    state.langkah++;
    let msg: Msg;
    try {
      msg = await retry(() => o.chat(messages, tools), RETRY_MODEL);
    } catch (e) {
      catat("sistem", `Model gagal: ${(e as Error).message}`);
      return akhiri("gagal", "Pemanggilan model gagal setelah dicoba ulang. Tidak ada tindakan yang dijalankan.");
    }
    messages.push(msg);

    // ---- model meminta tool ----
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const [i, call] of msg.tool_calls.entries()) {
        const name = call.function.name;
        const balas = (isi: object) => messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(isi) });

        if (i >= MAX_CALL_PER_LANGKAH) {
          balas({ galat: `Maksimal ${MAX_CALL_PER_LANGKAH} panggilan tool per langkah.` });
          catat("guardrail", `Panggilan ke-${i + 1} (${name}) ditolak: melebihi batas per langkah.`);
          continue;
        }

        let program: string | undefined;
        try { const p = (JSON.parse(call.function.arguments) as { program?: unknown }).program; if (typeof p === "string") program = p; } catch { /* diabaikan, tool yang menolak */ }

        if (name === "simpan_draf") {
          if (!o.simpanSebagai) { balas({ galat: "Tool tidak tersedia." }); catat("guardrail", "simpan_draf ditolak: pengguna tidak meminta penyimpanan."); continue; }
          if (program === undefined) { balas({ galat: 'Argumen "program" wajib string.' }); continue; }
          const cek = periksaProgram(program);
          if (!cek.valid) { balas({ galat: "Program belum lolos periksa_program, tidak bisa diusulkan." }); catat("guardrail", "simpan_draf ditolak: program tidak valid."); continue; }
          if (state.simulasiProgram?.trim() !== program.trim()) { balas({ galat: "Program ini belum disimulasikan. Jalankan simulasikan_program dulu." }); catat("guardrail", "simpan_draf ditolak: belum disimulasikan."); continue; }
          try {
            state.usulanSimpan = await buatUsulan(draftDir, o.simpanSebagai, program, cek.valid);
          } catch (e) {
            catat("guardrail", `simpan_draf ditolak: ${(e as Error).message}`);
            return akhiri("gagal", `Usulan penyimpanan ditolak: ${(e as Error).message}`);
          }
          state.programTerbaru = program;
          catat("tool", `simpan_draf diusulkan ke ${state.usulanSimpan.berkas} (menimpa: ${state.usulanSimpan.menimpa}); menunggu manusia`);
          return akhiri("menunggu_persetujuan", ringkasPersetujuan(state.usulanSimpan)); // BERHENTI: tidak ada yang ditulis
        }

        if (name !== "periksa_program" && name !== "simulasikan_program") {
          balas({ galat: `Tool tidak tersedia: ${name}` });
          catat("guardrail", `Tool tidak dikenal ditolak: ${name}`);
          continue;
        }

        // ---- jalankan tool dengan percobaan ulang ----
        let out: string | undefined;
        let galatTool = "";
        for (let t = 0; t <= RETRY_TOOL; t++) {
          try { out = exec(name, call.function.arguments); break; } catch (e) { galatTool = (e as Error).message; catat("tool_gagal", `${name} percobaan ${t + 1} gagal: ${galatTool}`); }
        }
        if (out === undefined) {
          state.kegagalanTool++;
          balas({ galat: `Tool ${name} gagal setelah ${RETRY_TOOL + 1} percobaan.` });
          if (state.kegagalanTool >= MAX_KEGAGALAN_TOOL) return akhiri("gagal", `Tool gagal permanen ${state.kegagalanTool} kali (${name}). Tugas dihentikan.`);
          continue;
        }
        catat("tool", `${name} -> ${potong(out, 160)}`);
        if (program !== undefined) state.programTerbaru = program;
        try {
          const parsed = JSON.parse(out) as Record<string, unknown>;
          if (name === "periksa_program" && typeof parsed.valid === "boolean") state.periksaTerakhir = parsed as unknown as Pemeriksaan;
          if (name === "simulasikan_program" && parsed.hasil !== undefined && program !== undefined) { state.simulasiProgram = program; state.simulasiTerakhir = parsed; }
        } catch { /* hasil bukan JSON, tidak dicatat ke state */ }
        messages.push({ role: "tool", tool_call_id: call.id, content: potong(out, MAX_HASIL_TOOL) });
      }
      await o.store.save(state); // state tugas ditulis tiap langkah
      continue;
    }

    // ---- jawaban akhir ----
    const teks = msg.content ?? "";
    catat("model", teks);
    let galat: string[] = [];
    try {
      const cek = checkOutput(extractJson(teks), o.mode);
      if (cek.ok) {
        state.hasil = cek.value;
        if (cek.value.status === "tidak_bisa") return akhiri("selesai", `Agent tidak menyusun draf: ${cek.value.alasan}`);
        state.programTerbaru = cek.value.program;
        state.periksaTerakhir = periksaProgram(cek.value.program); // dihitung ulang oleh sistem, bukan klaim model
        const lolos = state.periksaTerakhir.valid;
        const tambahan = o.simpanSebagai ? " Draf tidak disimpan karena tidak melalui usulan penyimpanan." : "";
        return akhiri("selesai", (lolos ? "Selesai. Program akhir lolos pemeriksaan sistem." : "Selesai, TETAPI program akhir TIDAK lolos pemeriksaan sistem. Jangan dipakai sebelum diperbaiki.") + tambahan);
      }
      galat = cek.errors;
    } catch { galat = ["Jawaban bukan JSON valid."]; }

    if (repairs < 1) {
      repairs++;
      messages.push({ role: "user", content: `Output tidak sesuai format: ${galat.join(" ")} Kirim ulang sebagai satu objek JSON saja.` });
      catat("guardrail", `Format jawaban akhir ditolak: ${galat.join(" ")}`);
      continue;
    }
    return akhiri("gagal", `Format jawaban akhir tidak valid setelah diperbaiki sekali: ${galat.join(" ")}`);
  }

  return akhiri(
    "batas_langkah",
    `Agent berhenti setelah ${max} langkah sebelum menyelesaikan tugas. Program terakhir yang diperiksa tersimpan di state (programTerbaru). Tidak ada tindakan yang dijalankan.`
  );
}

// ---- keputusan manusia atas usulan simpan_draf ----

const sedangDiproses = new Set<string>();

export async function putuskan(
  store: Store, id: string, keputusan: "setuju" | "tolak", draftDir: string = DRAF_DIR
): Promise<{ status: number; state?: TaskState; galat?: string }> {
  if (!ID_RE.test(id)) return { status: 400, galat: "ID tugas tidak valid." };
  if (sedangDiproses.has(id)) return { status: 409, galat: "Tugas sedang diproses." };
  sedangDiproses.add(id);
  try {
    const state = await store.load(id);
    if (!state) return { status: 404, galat: "Tugas tidak ditemukan." };
    if (state.status !== "menunggu_persetujuan" || !state.usulanSimpan || !state.simpanSebagai) {
      return { status: 409, galat: `Tugas tidak sedang menunggu persetujuan (status: ${state.status}).` };
    }
    const catat = (ringkas: string) =>
      state.trace.push({ langkah: state.langkah, waktu: new Date().toISOString(), jenis: "manusia", ringkas });
    const u = state.usulanSimpan;

    if (keputusan === "tolak") {
      state.status = "ditolak"; state.pesan = "Usulan penyimpanan ditolak. Tidak ada yang ditulis."; catat("Manusia menolak usulan.");
      await store.save(state);
      return { status: 200, state };
    }

    // Cek ulang saat persetujuan: isi usulan harus masih valid dan nama harus sama dengan permintaan awal.
    if (u.nama !== state.simpanSebagai || !periksaProgram(u.isi).valid) {
      state.status = "gagal"; state.pesan = "Persetujuan dibatalkan: usulan tidak lolos pemeriksaan ulang. Tidak ada yang ditulis.";
      catat("Pemeriksaan ulang saat persetujuan gagal.");
      await store.save(state);
      return { status: 422, state, galat: state.pesan };
    }
    await simpanKeBerkas(draftDir, u.nama, u.isi);
    state.status = "disimpan"; state.pesan = `Disimpan ke ${u.berkas}.`; catat(`Manusia menyetujui; ${u.berkas} ditulis (menimpa: ${u.menimpa}).`);
    await store.save(state);
    return { status: 200, state };
  } finally {
    sedangDiproses.delete(id);
  }
}
