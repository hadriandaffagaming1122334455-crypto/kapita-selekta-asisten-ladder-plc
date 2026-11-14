import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { DraftOutput, Mode } from "./schema";
import type { Pemeriksaan } from "./tools";

// State tugas disimpan DI LUAR percakapan, sebagai berkas JSON yang bisa dibaca langsung.

export type Status =
  | "berjalan"
  | "selesai"
  | "menunggu_persetujuan"
  | "disimpan"
  | "ditolak"
  | "batas_langkah"
  | "gagal";

export interface TraceEntry {
  langkah: number;
  waktu: string;
  jenis: "model" | "tool" | "tool_gagal" | "guardrail" | "sistem" | "manusia";
  ringkas: string;
}

export interface UsulanSimpan {
  nama: string;
  berkas: string; // jalur relatif yang akan ditulis, ditampilkan apa adanya ke manusia
  isi: string;
  menimpa: boolean; // true = berkas dengan nama itu sudah ada dan akan ditimpa
  ukuranByte: number;
  periksaValid: boolean;
}

export interface TaskState {
  id: string;
  dibuat: string;
  deskripsi: string;
  mode: Mode;
  status: Status;
  langkah: number;
  maxLangkah: number;
  pesan: string; // penjelasan status untuk pengguna
  programTerbaru: string; // program terakhir yang dikirim agent ke tool
  periksaTerakhir?: Pemeriksaan;
  simulasiProgram?: string; // program terakhir yang berhasil disimulasikan
  simulasiTerakhir?: unknown;
  kegagalanTool: number;
  simpanSebagai?: string;
  usulanSimpan?: UsulanSimpan;
  hasil?: DraftOutput;
  trace: TraceEntry[];
}

export interface Store {
  save(s: TaskState): Promise<void>;
  load(id: string): Promise<TaskState | null>;
}

export const ID_RE = /^[a-z0-9-]{8,40}$/;
export const newId = () => randomUUID();

export function fileStore(dir: string): Store {
  return {
    async save(s) {
      if (!ID_RE.test(s.id)) throw new Error("ID tugas tidak valid.");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${s.id}.json`);
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(s, null, 2), "utf8");
      await rename(tmp, file); // tulis ke berkas sementara lalu ganti, agar tidak setengah tertulis
    },
    async load(id) {
      if (!ID_RE.test(id)) return null;
      try {
        return JSON.parse(await readFile(path.join(dir, `${id}.json`), "utf8")) as TaskState;
      } catch {
        return null;
      }
    },
  };
}

export function memoryStore(): Store & { all: Map<string, TaskState> } {
  const all = new Map<string, TaskState>();
  return {
    all,
    async save(s) { all.set(s.id, JSON.parse(JSON.stringify(s))); },
    async load(id) { const v = all.get(id); return v ? JSON.parse(JSON.stringify(v)) : null; },
  };
}
